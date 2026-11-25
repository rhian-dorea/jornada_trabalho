-- Executar apenas em um banco descartável vazio: psql -v ON_ERROR_STOP=1 -f tests/dsr_mensal.sql
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql as $$select '99999999-9999-9999-9999-999999999999'::uuid$$;
create function public.meu_perfil() returns text language sql as $$select 'administrador'::text$$;
create function public.pode_gerir_equipe(text) returns boolean language sql as $$select true$$;
create table public.funcionarios(id uuid primary key,equipe text,ativo boolean);
create table public.jornadas (
  id uuid primary key default gen_random_uuid(), funcionario_id uuid not null,
  data date not null, situacao text not null check(situacao in ('trabalho','folga')),
  atualizado_em timestamptz default now(), atualizado_por uuid, criado_por uuid,
  turno_nome text, inicio time, fim time,
  unique(funcionario_id,data)
);
\ir ../sql/007_dsr_mensal.sql
\ir ../sql/008_feriado_nao_trabalhado.sql
create trigger limpar_turno_folga before insert or update on public.jornadas
for each row execute function public.limpar_turno_folga();

do $$
declare v_id uuid := '11111111-1111-1111-1111-111111111111';
  v_mes date; v_dias integer; v_minimo integer; v_extra date; v_primeiro date; v_segundo date; v_dia date;
begin
  foreach v_mes in array array[date '2025-02-01',date '2024-02-01',date '2026-11-01',date '2026-12-01',date '2027-02-01',date '2028-02-01'] loop
    v_dias := (v_mes+interval '1 month')::date-v_mes;
    v_minimo := public.dsr_minimo_mensal(v_mes);
    for v_dia in select v_mes+g.n from generate_series(0,v_dias-1) g(n)
      where v_mes<date '2026-12-01' or extract(isodow from v_mes+g.n)<6
      order by 1 limit v_dias-v_minimo loop
      insert into public.jornadas(funcionario_id,data,situacao) values(v_id,v_dia,'trabalho');
    end loop;
    select min(v_mes+g.n) into v_extra from generate_series(0,v_dias-1) g(n)
      where (v_mes<date '2026-12-01' or extract(isodow from v_mes+g.n)<6)
        and not exists(select 1 from public.jornadas where funcionario_id=v_id and data=v_mes+g.n);
    select min(data) into v_primeiro from public.jornadas where funcionario_id=v_id and data>=v_mes and data<v_mes+interval '1 month';
    select min(data) into v_segundo from public.jornadas where funcionario_id=v_id and data>v_primeiro and data<v_mes+interval '1 month';
    begin
      insert into public.jornadas(funcionario_id,data,situacao) values(v_id,v_extra,'trabalho');
      raise exception 'Falha: permitiu consumir um dos quatro dias reservados';
    exception when check_violation then null;
    end;
    update public.jornadas set situacao='folga' where funcionario_id=v_id and data=v_primeiro;
    insert into public.jornadas(funcionario_id,data,situacao) values(v_id,v_extra,'trabalho');
    begin
      update public.jornadas set situacao='trabalho' where funcionario_id=v_id and data=v_primeiro;
      raise exception 'Falha: permitiu substituir a quarta folga por trabalho';
    exception when check_violation then null;
    end;
    -- Remover uma jornada permite correções e libera novamente uma data.
    delete from public.jornadas where funcionario_id=v_id and data=v_segundo;
    update public.jornadas set situacao='trabalho' where funcionario_id=v_id and data=v_primeiro;
    -- Outro funcionário tem sua própria contagem.
    insert into public.jornadas(funcionario_id,data,situacao) values('22222222-2222-2222-2222-222222222222',v_mes,'trabalho');
  end loop;
end $$;
select 'DSR mensal: inserção, alteração, exclusão, meses e funcionários validados' as resultado;

do $$
declare v_id uuid := '33333333-3333-3333-3333-333333333333'; v_dia date; v public.jornadas;
begin
  insert into public.funcionarios values(v_id,'A',true);
  for v_dia in select date '2026-12-14'+g.n from generate_series(0,4) g(n) loop
    perform public.salvar_jornada(v_id,v_dia,'trabalho',null);
  end loop;
  begin
    perform public.salvar_jornada(v_id,date '2026-12-19','trabalho',null);
    raise exception 'Falha: permitiu sexto dia ocupado na semana';
  exception when check_violation then null; end;
  begin
    perform public.salvar_jornada(v_id,date '2026-12-19','feriado',null);
    raise exception 'Falha: feriado foi usado para substituir DSR';
  exception when check_violation then null; end;
  v:=public.salvar_jornada(v_id,date '2026-12-19','folga',null);
  begin
    perform public.salvar_jornada(v_id,date '2026-12-19','feriado',v.atualizado_em);
    raise exception 'Falha: permitiu remover DSR obrigatório';
  exception when check_violation then null; end;
  perform public.salvar_jornada(v_id,date '2026-12-20','folga',null);
  v:=public.salvar_jornada(v_id,date '2026-11-20','feriado',null);
  if v.situacao<>'feriado' then raise exception 'Falha: RPC não preservou feriado'; end if;
  perform public.salvar_jornada(v_id,date '2026-11-20',null,v.atualizado_em);
  v:=public.salvar_jornada(v_id,date '2026-11-20','trabalho',null);
  update public.jornadas set turno_nome='Antigo',inicio='08:00',fim='17:00' where id=v.id;
  v:=public.salvar_jornada(v_id,date '2026-11-20','feriado',v.atualizado_em);
  if v.turno_nome is not null or v.inicio is not null or v.fim is not null then
    raise exception 'Falha: horário legado não foi limpo ao registrar feriado';
  end if;
  v_id:='44444444-4444-4444-4444-444444444444';
  for v_dia in select date '2026-12-10'+g.n from generate_series(0,5) g(n) loop
    insert into public.jornadas(funcionario_id,data,situacao) values(v_id,v_dia,'trabalho');
  end loop;
  begin
    insert into public.jornadas(funcionario_id,data,situacao) values(v_id,date '2026-12-16','trabalho');
    raise exception 'Falha: permitiu sete dias consecutivos cruzando a transição';
  exception when check_violation then null; end;
end $$;
select '5x2, transição, feriado separado de DSR e RPC validados' as resultado;
