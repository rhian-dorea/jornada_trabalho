-- Banco descartável já preparado com dsr_mensal.sql e sex_rest_rules.sql.
\ir ../sql/011_compatibilidade_banco_legado.sql
-- Novo schema: ainda deve validar a interjornada configurada.
update public.empresas set regras='{"interjornada":12}';
do $$
declare v_id uuid:='88888888-8888-8888-8888-888888888888'; v public.jornadas;
begin
 insert into public.funcionarios(id,equipe,ativo,sexo,cargo) values(v_id,'A',true,'F','Despachante');
 perform public.salvar_jornada(v_id,date '2026-11-10','trabalho',null);
 update public.jornadas set turno_nome='Teste',inicio='10:00',fim='22:00' where funcionario_id=v_id and data=date '2026-11-10';
 perform public.salvar_jornada(v_id,date '2026-11-11','trabalho',null);
 begin
  update public.jornadas set turno_nome='Teste',inicio='09:00',fim='17:00' where funcionario_id=v_id and data=date '2026-11-11';
  raise exception 'Falha: não aplicou interjornada configurada de 12 horas';
 exception when check_violation then null; end;
end $$;
-- Simula o banco do usuário, sem empresa_id, empresas ou horários opcionais.
alter table public.funcionarios drop column empresa_id;
drop table public.empresas;
alter table public.jornadas drop column turno_nome;
alter table public.jornadas drop column inicio;
alter table public.jornadas drop column fim;
do $$
declare v_id uuid:='99999999-8888-7777-6666-555555555555'; v public.jornadas; v_dia date;
begin
 insert into public.funcionarios(id,equipe,ativo,sexo,cargo) values(v_id,'A',true,'F','Despachante');
 v:=public.salvar_jornada(v_id,date '2026-11-28','trabalho',null);
 v:=public.salvar_jornada(v_id,date '2026-11-28','folga',v.atualizado_em);
 v:=public.salvar_jornada(v_id,date '2026-11-28','feriado',v.atualizado_em);
 perform public.salvar_jornada(v_id,date '2026-11-28',null,v.atualizado_em);
 for v_dia in select date '2026-11-16'+g.n from generate_series(0,5) g(n) loop
  perform public.salvar_jornada(v_id,v_dia,'trabalho',null);
 end loop;
 begin
  perform public.salvar_jornada(v_id,date '2026-11-22','trabalho',null);
  raise exception 'Falha: permitiu sete dias no schema legado';
 exception when check_violation then null; end;
 perform public.salvar_jornada(v_id,date '2026-11-29','trabalho',null);
 begin
  perform public.salvar_jornada(v_id,date '2026-12-06','trabalho',null);
  raise exception 'Falha: permitiu dois domingos no schema legado';
 exception when check_violation then null; end;
end $$;
select 'Schema novo e legado, Trabalho/Folga/Feriado/Remover e regras preservadas: OK' as resultado;
