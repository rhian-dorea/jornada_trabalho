-- Correção após 010. Não adiciona colunas e não altera funcionários ou jornadas.
begin;
create or replace function public.validar_janela(p_funcionario uuid,p_data date) returns void
language plpgsql set search_path = '' as $$
declare v_inicio date; v_sexo text; v_empresa text; v_regras jsonb;
  v_dias integer:=6; v_domingos integer:=1; v_pair record;
  v_fim timestamp; v_inicio_proximo timestamp; v_interjornada integer:=11;
begin
  -- JSON permite ler o campo opcional sem exigir a migração multiempresa.
  select f.sexo,pg_catalog.to_jsonb(f)->>'empresa_id' into v_sexo,v_empresa
    from public.funcionarios f where f.id=p_funcionario;
  if v_empresa is not null and pg_catalog.to_regclass('public.empresas') is not null then
    execute 'select regras from public.empresas where id=$1::uuid' into v_regras using v_empresa;
    v_interjornada:=coalesce((v_regras->>'interjornada')::integer,11);
  end if;
  v_dias:=6;
  v_domingos:=1;
  for v_inicio in select (p_data + g.n)::date from pg_catalog.generate_series(-v_dias,0) g(n) loop
    if (select count(*) from public.jornadas where funcionario_id=p_funcionario and situacao='trabalho'
      and data between v_inicio and v_inicio+v_dias)=v_dias+1 then
      raise exception 'Bloqueado: mais de % dias consecutivos perto de %',v_dias,p_data using errcode='23514';
    end if;
  end loop;
  if v_sexo='F' then
    for v_inicio in select (p_data + g.n*7)::date from pg_catalog.generate_series(-v_domingos,v_domingos) g(n)
      where extract(dow from p_data + g.n*7)=0 loop
      if (select count(*) from public.jornadas where funcionario_id=p_funcionario and situacao='trabalho'
        and extract(dow from data)=0 and data between v_inicio and v_inicio+v_domingos*7)=v_domingos+1 then
        raise exception 'Bloqueado: mais de % domingos consecutivos perto de %',v_domingos,p_data using errcode='23514';
      end if;
    end loop;
  end if;
  -- Horários são opcionais: instalações antigas podem não ter essas colunas.
  for v_pair in
    select pg_catalog.to_jsonb(a) as anterior,pg_catalog.to_jsonb(b) as proxima
      from public.jornadas a join public.jornadas b
        on b.funcionario_id=a.funcionario_id and b.data=a.data+1
      where a.funcionario_id=p_funcionario and a.situacao='trabalho' and b.situacao='trabalho'
        and a.data between p_data-1 and p_data
        and pg_catalog.to_jsonb(a)->>'inicio' is not null and pg_catalog.to_jsonb(a)->>'fim' is not null
        and pg_catalog.to_jsonb(b)->>'inicio' is not null
  loop
    v_fim:=(v_pair.anterior->>'data')::date+(v_pair.anterior->>'fim')::time;
    if (v_pair.anterior->>'fim')::time <= (v_pair.anterior->>'inicio')::time then
      v_fim:=v_fim+interval '1 day';
    end if;
    v_inicio_proximo:=(v_pair.proxima->>'data')::date+(v_pair.proxima->>'inicio')::time;
    if v_inicio_proximo-v_fim<pg_catalog.make_interval(hours=>v_interjornada) then
      raise exception 'Bloqueado: interjornada inferior a % horas perto de %',v_interjornada,p_data using errcode='23514';
    end if;
  end loop;
end $$;

-- Limpa somente os campos que existirem no tipo da linha, sem exigir colunas opcionais.
create or replace function public.limpar_turno_folga() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.situacao<>'trabalho' then
    new:=pg_catalog.jsonb_populate_record(new,'{"turno_nome":null,"inicio":null,"fim":null}'::jsonb);
  end if;
  return new;
end $$;
commit;
