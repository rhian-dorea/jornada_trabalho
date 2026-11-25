-- Complemento exclusivo para o banco descartável criado por dsr_mensal.sql.
alter table public.funcionarios add column sexo text default 'M';
alter table public.funcionarios add column cargo text default '';
alter table public.funcionarios add column empresa_id uuid default '00000000-0000-4000-8000-000000000001';
create table public.empresas(id uuid primary key,regras jsonb);
insert into public.empresas values('00000000-0000-4000-8000-000000000001','{"dias":6,"dias_lideranca":7,"domingos":1,"domingos_lideranca":2,"interjornada":11}');
\ir ../sql/010_seis_dias_domingos_mulheres.sql
create function public.fixture_validar_jornada() returns trigger language plpgsql as $$
begin perform public.validar_janela(new.funcionario_id,new.data); return new; end $$;
create trigger fixture_validar_jornada after insert or update on public.jornadas
for each row execute function public.fixture_validar_jornada();
do $$
declare v_mulher uuid:='55555555-5555-5555-5555-555555555555';
 v_homem uuid:='66666666-6666-6666-6666-666666666666';
 v_outro uuid:='77777777-7777-7777-7777-777777777777'; v_dia date;
begin
 insert into public.funcionarios(id,equipe,ativo,sexo,cargo) values
 (v_mulher,'A',true,'F','Coordenador'),(v_homem,'A',true,'M','Supervisor'),(v_outro,'A',true,'M','Supervisor');
 perform public.salvar_jornada(v_mulher,date '2026-11-29','trabalho',null);
 begin
  perform public.salvar_jornada(v_mulher,date '2026-12-06','trabalho',null);
  raise exception 'Falha: permitiu dois domingos para mulher coordenadora na virada de mês';
 exception when check_violation then null; end;
 for v_dia in select d from (values(date '2026-11-22'),(date '2026-11-29'),(date '2026-12-06')) t(d) loop
  perform public.salvar_jornada(v_homem,v_dia,'trabalho',null);
 end loop;
 for v_dia in select date '2026-10-28'+g.n from generate_series(0,5) g(n) loop
  perform public.salvar_jornada(v_outro,v_dia,'trabalho',null);
 end loop;
 begin
  perform public.salvar_jornada(v_outro,date '2026-11-03','trabalho',null);
  raise exception 'Falha: permitiu sete dias para supervisor na virada de mês';
 exception when check_violation then null; end;
end $$;
select 'Sexo, cargo e virada de mês validados no PostgreSQL' as resultado;
