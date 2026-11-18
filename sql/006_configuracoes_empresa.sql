-- Aplicar após 005_normalizar_cargos.sql. Preserva IDs, jornadas e RPCs anteriores.
begin;

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 120),
  logo_url text not null default '',
  cor_primaria text not null default '#2457a7' check (cor_primaria ~ '^#[0-9A-Fa-f]{6}$'),
  tema text not null default 'light' check (tema in ('light','dark')),
  regras jsonb not null default '{"dias":6,"domingos":1,"dias_lideranca":7,"domingos_lideranca":2,"interjornada":11}',
  turnos jsonb not null default '[{"nome":"Comercial","inicio":"08:00","fim":"17:00","cor":"#2457a7"}]',
  cobertura jsonb not null default '{"geral":[1,1,1,1,1,1,1],"equipes":{}}',
  feriados jsonb not null default '[]',
  atualizado_em timestamptz not null default now()
);

insert into public.empresas(id,nome) values ('00000000-0000-4000-8000-000000000001','Controle de Escalas');

alter table public.perfis drop constraint if exists perfis_perfil_check;
alter table public.perfis add constraint perfis_perfil_check
  check (perfil in ('administrador','gestor','visualizacao','funcionario'));
create or replace function public.pode_ver_equipe(p_equipe text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when public.meu_perfil() = 'administrador' then true
    when public.meu_perfil() in ('gestor','visualizacao','funcionario') and p_equipe is not null
      then exists(select 1 from public.perfil_equipes pe
        where pe.usuario_id = auth.uid() and pe.equipe = p_equipe)
    else false end
$$;

-- Campo de preparação. Cada instalação existente continua com uma empresa por projeto.
alter table public.perfis add column empresa_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.empresas(id);
alter table public.funcionarios add column empresa_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.empresas(id);
alter table public.jornadas add column empresa_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.empresas(id);
alter table public.perfil_equipes add column empresa_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.empresas(id);
alter table public.auditoria add column empresa_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.empresas(id);
alter table public.migracoes_locais add column empresa_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.empresas(id);

alter table public.jornadas add column turno_nome text;
alter table public.jornadas add column inicio time;
alter table public.jornadas add column fim time;
alter table public.jornadas add constraint horario_coerente check (
  (turno_nome is null and inicio is null and fim is null) or
  (situacao='trabalho' and turno_nome is not null and inicio is not null and fim is not null)
);
create index funcionarios_empresa_equipe_idx on public.funcionarios(empresa_id,equipe,ativo);
create index jornadas_empresa_data_idx on public.jornadas(empresa_id,data);

create or replace function public.limpar_turno_folga() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.situacao='folga' then new.turno_nome:=null; new.inicio:=null; new.fim:=null; end if;
  return new;
end $$;
create trigger limpar_turno_folga before insert or update on public.jornadas
  for each row execute function public.limpar_turno_folga();

alter table public.empresas enable row level security;
revoke all on public.empresas from anon,authenticated;
grant select on public.empresas to authenticated;
create policy empresa_ler on public.empresas for select to authenticated
  using (exists (select 1 from public.perfis p where p.id=auth.uid() and p.ativo and p.empresa_id=empresas.id));

create or replace function public.salvar_configuracoes(p_dados jsonb) returns public.empresas
language plpgsql security definer set search_path = '' as $$
declare v public.empresas; k text; n integer; jornada record; item jsonb; weekday text; team text;
begin
  if public.meu_perfil() is distinct from 'administrador' then
    raise exception 'Somente administrador altera configurações' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_dados->>'nome',''))) not between 1 and 120 or
     coalesce(p_dados->>'cor_primaria','') !~ '^#[0-9A-Fa-f]{6}$' or
     coalesce(p_dados->>'tema','') not in ('light','dark') or
     (coalesce(p_dados->>'logo_url','')<>'' and p_dados->>'logo_url' !~ '^https://') or
     coalesce(jsonb_typeof(p_dados->'turnos'),'')<>'array' or
     coalesce(jsonb_typeof(p_dados->'cobertura'),'')<>'object' or
     coalesce(jsonb_typeof(p_dados->'feriados'),'')<>'array' then
    raise exception 'Configuração inválida' using errcode='22023';
  end if;
  foreach k in array array['dias','domingos','dias_lideranca','domingos_lideranca','interjornada'] loop
    if coalesce(p_dados->'regras'->>k,'') !~ '^[0-9]{1,2}$' then
      raise exception 'Regra inválida: %',k using errcode='22023';
    end if;
    n:=(p_dados->'regras'->>k)::integer;
    if n>24 or (k<>'interjornada' and n<1) then
      raise exception 'Regra fora dos limites: %',k using errcode='22023';
    end if;
  end loop;
  if jsonb_array_length(p_dados->'turnos')>30 then raise exception 'Limite de 30 turnos' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_dados->'turnos') loop
    if length(btrim(coalesce(item->>'nome',''))) not between 1 and 40 or
       coalesce(item->>'inicio','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
       coalesce(item->>'fim','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
       coalesce(item->>'cor','') !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'Turno inválido' using errcode='22023';
    end if;
  end loop;
  if coalesce(jsonb_typeof(p_dados->'cobertura'->'geral'),'')<>'array' or
     jsonb_array_length(p_dados->'cobertura'->'geral')<>7 or
     coalesce(jsonb_typeof(p_dados->'cobertura'->'equipes'),'')<>'object' then
    raise exception 'Cobertura inválida' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_dados->'cobertura'->'geral') loop
    if item::text !~ '^([0-9]|[1-9][0-9]|1[0-9][0-9]|200)$' then
      raise exception 'Cobertura geral inválida' using errcode='22023';
    end if;
  end loop;
  for team,weekday in select key,value::text from jsonb_each(p_dados->'cobertura'->'equipes') loop
    if length(btrim(team)) not between 1 and 80 or weekday !~ '^\[[0-9, ]+\]$' or
       jsonb_array_length((p_dados->'cobertura'->'equipes')->team)<>7 then
      raise exception 'Cobertura de equipe inválida' using errcode='22023';
    end if;
    for item in select value from jsonb_array_elements((p_dados->'cobertura'->'equipes')->team) loop
      if item::text !~ '^([0-9]|[1-9][0-9]|1[0-9][0-9]|200)$' then
        raise exception 'Cobertura de equipe inválida' using errcode='22023';
      end if;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(p_dados->'feriados') loop
    if coalesce(item->>'data','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or
       length(btrim(coalesce(item->>'nome',''))) not between 1 and 80 then
      raise exception 'Feriado inválido' using errcode='22023';
    end if;
  end loop;
  select * into v from public.empresas where id=(select empresa_id from public.perfis where id=auth.uid()) for update;
  if not found then raise exception 'Empresa não encontrada' using errcode='P0002'; end if;
  update public.empresas set nome=btrim(p_dados->>'nome'),logo_url=coalesce(p_dados->>'logo_url',''),
    cor_primaria=p_dados->>'cor_primaria',tema=p_dados->>'tema',regras=p_dados->'regras',
    turnos=p_dados->'turnos',cobertura=p_dados->'cobertura',feriados=p_dados->'feriados',atualizado_em=now()
    where id=v.id returning * into v;
  for jornada in select funcionario_id,data from public.jornadas where empresa_id=v.id and situacao='trabalho' loop
    perform public.validar_janela(jornada.funcionario_id,jornada.data);
  end loop;
  return v;
end $$;

create or replace function public.validar_janela(p_funcionario uuid,p_data date) returns void
language plpgsql set search_path = '' as $$
declare v_inicio date; v_sexo text; v_cargo text; v_empresa uuid; v_regras jsonb;
  v_extendido boolean; v_dias integer; v_domingos integer; v_a public.jornadas; v_b public.jornadas;
  v_fim timestamp; v_inicio_proximo timestamp;
begin
  select sexo,translate(lower(btrim(cargo)),'áàâãéêíóôõúç','aaaaeeiooouc'),empresa_id
    into v_sexo,v_cargo,v_empresa from public.funcionarios where id=p_funcionario;
  select regras into v_regras from public.empresas where id=v_empresa;
  v_extendido:=coalesce(v_cargo in ('supervisor','coordenador'),false);
  v_dias:=case when v_extendido then (v_regras->>'dias_lideranca')::integer else (v_regras->>'dias')::integer end;
  v_domingos:=case when v_extendido then (v_regras->>'domingos_lideranca')::integer else (v_regras->>'domingos')::integer end;
  for v_inicio in select (p_data + g.n)::date from pg_catalog.generate_series(-v_dias,0) g(n) loop
    if (select count(*) from public.jornadas where funcionario_id=p_funcionario and situacao='trabalho'
      and data between v_inicio and v_inicio+v_dias)=v_dias+1 then
      raise exception 'Bloqueado: mais de % dias consecutivos perto de %',v_dias,p_data using errcode='23514';
    end if;
  end loop;
  if v_extendido or v_sexo='F' then
    for v_inicio in select (p_data + g.n*7)::date from pg_catalog.generate_series(-v_domingos,v_domingos) g(n)
      where extract(dow from p_data + g.n*7)=0 loop
      if (select count(*) from public.jornadas where funcionario_id=p_funcionario and situacao='trabalho'
        and extract(dow from data)=0 and data between v_inicio and v_inicio+v_domingos*7)=v_domingos+1 then
        raise exception 'Bloqueado: mais de % domingos consecutivos perto de %',v_domingos,p_data using errcode='23514';
      end if;
    end loop;
  end if;
  for v_a in select * from public.jornadas where funcionario_id=p_funcionario and situacao='trabalho'
    and data between p_data-1 and p_data+1 and inicio is not null loop
    select * into v_b from public.jornadas where funcionario_id=p_funcionario and situacao='trabalho'
      and data=v_a.data+1 and inicio is not null;
    if found then
      v_fim:=v_a.data+v_a.fim;
      if v_a.fim<=v_a.inicio then v_fim:=v_fim+interval '1 day'; end if;
      v_inicio_proximo:=v_b.data+v_b.inicio;
      if v_inicio_proximo-v_fim<make_interval(hours=>(v_regras->>'interjornada')::integer) then
        raise exception 'Bloqueado: interjornada inferior a % horas perto de %',v_regras->>'interjornada',p_data using errcode='23514';
      end if;
    end if;
  end loop;
end $$;

create or replace function public.salvar_jornada_com_turno(
  p_funcionario uuid,p_data date,p_situacao text,p_versao timestamptz,p_turno text
) returns public.jornadas language plpgsql security definer set search_path = '' as $$
declare v public.jornadas; v_turno jsonb; v_empresa uuid;
begin
  if p_situacao<>'trabalho' then raise exception 'Turno exige trabalho' using errcode='22023'; end if;
  v:=public.salvar_jornada(p_funcionario,p_data,p_situacao,p_versao);
  select empresa_id into v_empresa from public.funcionarios where id=p_funcionario;
  select value into v_turno from public.empresas e, jsonb_array_elements(e.turnos)
    where e.id=v_empresa and value->>'nome'=p_turno limit 1;
  if v_turno is null then raise exception 'Turno inexistente' using errcode='22023'; end if;
  update public.jornadas set turno_nome=p_turno,inicio=(v_turno->>'inicio')::time,
    fim=(v_turno->>'fim')::time,atualizado_por=auth.uid() where id=v.id returning * into v;
  return v;
end $$;

revoke execute on function public.salvar_configuracoes(jsonb),
  public.salvar_jornada_com_turno(uuid,date,text,timestamptz,text),public.limpar_turno_folga() from public,anon;
grant execute on function public.salvar_configuracoes(jsonb),
  public.salvar_jornada_com_turno(uuid,date,text,timestamptz,text) to authenticated;
commit;
