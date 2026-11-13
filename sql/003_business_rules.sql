-- Todas as gravações públicas passam por RPCs. Gatilhos também protegem alterações
-- feitas por SQL administrativo e validam operações retroativas.
begin;
create or replace function public.marcar_atualizacao() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
create trigger atualizar_funcionarios before update on public.funcionarios
for each row execute function public.marcar_atualizacao();
create trigger atualizar_jornadas before update on public.jornadas
for each row execute function public.marcar_atualizacao();

create or replace function public.validar_janela(p_funcionario uuid,p_data date) returns void
language plpgsql set search_path = '' as $$
declare v_inicio date; v_sexo text;
begin
  select sexo into v_sexo from public.funcionarios where id=p_funcionario;
  for v_inicio in select (p_data + g.n)::date from generate_series(-6,0) g(n) loop
    if (select count(*) from public.jornadas
        where funcionario_id=p_funcionario and situacao='trabalho'
          and data between v_inicio and v_inicio+6)=7 then
      raise exception 'Bloqueado: mais de seis dias consecutivos de trabalho perto de %',p_data
        using errcode='23514';
    end if;
  end loop;
  if v_sexo='F' and exists(
    select 1 from public.jornadas a join public.jornadas b
      on b.funcionario_id=a.funcionario_id and b.data=a.data+7
    where a.funcionario_id=p_funcionario and a.situacao='trabalho'
      and b.situacao='trabalho' and extract(dow from a.data)=0
      and (a.data between p_data-7 and p_data+7 or b.data between p_data-7 and p_data+7)
  ) then
    raise exception 'Bloqueado: dois domingos consecutivos de trabalho perto de %',p_data
      using errcode='23514';
  end if;
end $$;

create or replace function public.validar_jornada_trigger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then perform public.validar_janela(old.funcionario_id,old.data); end if;
  if tg_op <> 'DELETE' then perform public.validar_janela(new.funcionario_id,new.data); end if;
  return coalesce(new,old);
end $$;
create trigger validar_jornadas after insert or update or delete on public.jornadas
for each row execute function public.validar_jornada_trigger();

create or replace function public.validar_sexo_trigger() returns trigger
language plpgsql set search_path = '' as $$
declare v_data date;
begin
  if new.sexo='F' and old.sexo is distinct from new.sexo then
    for v_data in select data from public.jornadas
      where funcionario_id=new.id and situacao='trabalho'
        and extract(dow from data)=0 loop
      perform public.validar_janela(new.id,v_data);
    end loop;
  end if;
  return new;
end $$;
create trigger validar_sexo after update of sexo on public.funcionarios
for each row execute function public.validar_sexo_trigger();

create or replace function public.salvar_funcionario(
  p_id uuid,p_nome text,p_sexo text,p_cargo text default '',
  p_matricula text default null,p_equipe text default null,p_ativo boolean default true,
  p_versao timestamptz default null
) returns public.funcionarios language plpgsql security definer set search_path = '' as $$
declare v public.funcionarios;
begin
  if public.meu_perfil() is distinct from 'administrador' then raise exception 'Sem permissão para alterar funcionários' using errcode='42501'; end if;
  if p_nome is null or length(btrim(p_nome)) not between 1 and 60 or
     p_sexo not in ('M','F') or length(coalesce(p_cargo,''))>40 then
    raise exception 'Dados de funcionário inválidos' using errcode='22023';
  end if;
  if p_id is null then
    insert into public.funcionarios(nome,sexo,cargo,matricula,equipe,ativo)
      values(btrim(p_nome),p_sexo,btrim(coalesce(p_cargo,'')),nullif(btrim(p_matricula),''),nullif(btrim(p_equipe),''),true)
      returning * into v;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
    select * into v from public.funcionarios where id=p_id for update;
    if not found then raise exception 'Funcionário não encontrado' using errcode='P0002'; end if;
    if p_versao is distinct from v.atualizado_em then
      raise exception 'Conflito: funcionário alterado por outra pessoa. Recarregue os dados.' using errcode='40001';
    end if;
    update public.funcionarios set nome=btrim(p_nome),sexo=p_sexo,cargo=btrim(coalesce(p_cargo,'')),
      matricula=nullif(btrim(p_matricula),''),equipe=nullif(btrim(p_equipe),''),ativo=p_ativo
      where id=p_id returning * into v;
  end if;
  return v;
end $$;

create or replace function public.salvar_jornada(
  p_funcionario uuid,p_data date,p_situacao text,p_versao timestamptz default null
) returns public.jornadas language plpgsql security definer set search_path = '' as $$
declare v public.jornadas; v_equipe text; v_ativo boolean; v_exists boolean;
begin
  if auth.uid() is null then raise exception 'Sessão expirada' using errcode='42501'; end if;
  if p_data is null or (p_situacao is not null and p_situacao not in ('trabalho','folga')) then
    raise exception 'Jornada inválida' using errcode='22023';
  end if;
  -- O mesmo bloqueio serializa gestores, importações e mudanças cadastrais.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_funcionario::text,0));
  select equipe,ativo into v_equipe,v_ativo from public.funcionarios where id=p_funcionario;
  if not found then raise exception 'Funcionário inexistente' using errcode='23503'; end if;
  if not public.pode_gerir_equipe(v_equipe) then raise exception 'Sem permissão para esta equipe' using errcode='42501'; end if;
  select * into v from public.jornadas where funcionario_id=p_funcionario and data=p_data for update;
  v_exists:=found;
  if not v_ativo and (public.meu_perfil()<>'administrador' or not v_exists) then
    raise exception 'Funcionário desativado; somente administrador corrige histórico existente' using errcode='42501';
  end if;
  if v_exists then
    if p_versao is distinct from v.atualizado_em then
      raise exception 'Conflito: jornada alterada por outra pessoa. Recarregue os dados.' using errcode='40001';
    end if;
    if p_situacao is null then
      delete from public.jornadas where id=v.id;
      return null;
    end if;
    if v.situacao=p_situacao then return v; end if;
    update public.jornadas set situacao=p_situacao,atualizado_por=auth.uid()
      where id=v.id returning * into v;
  else
    if p_versao is not null then raise exception 'Conflito: jornada removida por outra pessoa' using errcode='40001'; end if;
    if p_situacao is null then return null; end if;
    insert into public.jornadas(funcionario_id,data,situacao,criado_por,atualizado_por)
      values(p_funcionario,p_data,p_situacao,auth.uid(),auth.uid()) returning * into v;
  end if;
  return v;
end $$;

-- CSV inteiro em uma transação. Nomes ambíguos exigem resolução antes da importação.
create or replace function public.importar_csv(p_linhas jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb; v_id uuid; v_total integer:=0; v_novos integer:=0;
  v_existente public.jornadas; v_nome text; v_sexo text; v_cargo text; v_data date; v_situacao text;
begin
  if public.meu_perfil() is distinct from 'administrador' then raise exception 'Importação exclusiva do administrador' using errcode='42501'; end if;
  if jsonb_typeof(p_linhas)<>'array' or jsonb_array_length(p_linhas)>5000 then
    raise exception 'Lote CSV inválido ou acima de 5000 linhas' using errcode='22023';
  end if;
  for r in select value from jsonb_array_elements(p_linhas) loop
    v_total:=v_total+1;
    v_nome:=btrim(r->>'nome'); v_sexo:=r->>'sexo'; v_cargo:=coalesce(r->>'cargo','');
    v_data:=(r->>'data')::date; v_situacao:=r->>'situacao';
    if length(v_nome) not between 1 and 60 or v_sexo not in ('M','F') or
      length(v_cargo)>40 or v_situacao not in ('trabalho','folga') then
      raise exception 'Linha %: campos inválidos',v_total using errcode='22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('csv:'||lower(v_nome)||':'||v_sexo||':'||v_cargo,0));
    select id into v_id from public.funcionarios where lower(nome)=lower(v_nome)
      and sexo=v_sexo and cargo=v_cargo and ativo limit 2;
    if (select count(*) from public.funcionarios where lower(nome)=lower(v_nome)
      and sexo=v_sexo and cargo=v_cargo and ativo)>1 then
      raise exception 'Linha %: funcionário ambíguo; use a migração por identificador',v_total using errcode='22023';
    end if;
    if v_id is null then
      if exists(select 1 from public.funcionarios where lower(nome)=lower(v_nome)
        and sexo=v_sexo and cargo=v_cargo and not ativo) then
        raise exception 'Linha %: funcionário desativado; reative ou resolva manualmente',v_total using errcode='22023';
      end if;
      -- Uma coincidência parcial de nome não é tratada como a mesma pessoa.
      insert into public.funcionarios(nome,sexo,cargo) values(v_nome,v_sexo,v_cargo) returning id into v_id;
      v_novos:=v_novos+1;
    end if;
    select * into v_existente from public.jornadas where funcionario_id=v_id and data=v_data;
    if found then
      if v_existente.situacao<>v_situacao then
        raise exception 'Linha %: já existe lançamento diferente; corrija manualmente',v_total using errcode='23505';
      end if;
    else
      begin
        perform public.salvar_jornada(v_id,v_data,v_situacao,null);
      exception when others then
        raise exception 'Linha %: %',v_total,sqlerrm using errcode='22023';
      end;
    end if;
    v_id:=null;
  end loop;
  return jsonb_build_object('linhas',v_total,'funcionarios_novos',v_novos);
end $$;

-- Exigir confirmação na interface; o RPC aplica tudo ou nada.
create or replace function public.migrar_local(p_origem text,p_funcionarios jsonb,p_jornadas jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e jsonb; j jsonb; v_id uuid; v_novos integer:=0; v_lancamentos integer:=0;
  v_atual public.jornadas;
begin
  if public.meu_perfil() is distinct from 'administrador' then raise exception 'Migração exclusiva do administrador' using errcode='42501'; end if;
  if p_origem not in ('escala_dsr_v1','escala_dsr_v2') or
    jsonb_typeof(p_funcionarios)<>'array' or jsonb_typeof(p_jornadas)<>'array' or
    jsonb_array_length(p_funcionarios)>5000 or jsonb_array_length(p_jornadas)>20000 then
    raise exception 'Lote de migração inválido' using errcode='22023';
  end if;
  for e in select value from jsonb_array_elements(p_funcionarios) loop
    if coalesce(e->>'id','')='' or length(coalesce(e->>'nome','')) not between 1 and 60
      or e->>'sexo' not in ('M','F') or length(coalesce(e->>'cargo',''))>40 then
      raise exception 'Funcionário legado inválido: %',e->>'id' using errcode='22023';
    end if;
    select funcionario_id into v_id from public.migracoes_locais
      where legado_id=e->>'id';
    if v_id is null then
      insert into public.funcionarios(nome,sexo,cargo)
        values(e->>'nome',e->>'sexo',coalesce(e->>'cargo','')) returning id into v_id;
      insert into public.migracoes_locais(origem,legado_id,funcionario_id)
        values(p_origem,e->>'id',v_id);
      v_novos:=v_novos+1;
    end if;
  end loop;
  for j in select value from jsonb_array_elements(p_jornadas) loop
    if coalesce(j->>'legado_id','')='' or
      coalesce(j->>'situacao','') not in ('trabalho','folga') or
      coalesce(j->>'data','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Jornada legada inválida: % em %',j->>'legado_id',j->>'data' using errcode='22023';
    end if;
    select funcionario_id into v_id from public.migracoes_locais
      where legado_id=j->>'legado_id';
    if v_id is null then raise exception 'Jornada aponta para funcionário inexistente: %',j->>'legado_id' using errcode='23503'; end if;
    select * into v_atual from public.jornadas where funcionario_id=v_id and data=(j->>'data')::date;
    if found then
      if v_atual.situacao<>j->>'situacao' then
        raise exception 'Conflito na migração: % em %',j->>'legado_id',j->>'data' using errcode='23505';
      end if;
    else
      begin
        perform public.salvar_jornada(v_id,(j->>'data')::date,j->>'situacao',null);
      exception when others then
        raise exception 'Legado % em %: %',j->>'legado_id',j->>'data',sqlerrm using errcode='22023';
      end;
      v_lancamentos:=v_lancamentos+1;
    end if;
  end loop;
  return jsonb_build_object('funcionarios_novos',v_novos,'jornadas_novas',v_lancamentos);
end $$;

revoke execute on function public.marcar_atualizacao(),public.validar_janela(uuid,date),
  public.validar_jornada_trigger(),public.validar_sexo_trigger(),
  public.salvar_funcionario(uuid,text,text,text,text,text,boolean,timestamptz),
  public.salvar_jornada(uuid,date,text,timestamptz),public.importar_csv(jsonb),
  public.migrar_local(text,jsonb,jsonb) from public,anon;
grant execute on function public.salvar_funcionario(uuid,text,text,text,text,text,boolean,timestamptz),
  public.salvar_jornada(uuid,date,text,timestamptz),public.importar_csv(jsonb),
  public.migrar_local(text,jsonb,jsonb) to authenticated;
commit;
