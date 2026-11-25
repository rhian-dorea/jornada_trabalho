-- Aplica a todos os cargos. Não altera registros existentes nem gera folgas fictícias.
begin;
create or replace function public.dsr_minimo_mensal(p_data date) returns integer
language sql immutable set search_path = '' as $$
  select case when p_data >= date '2026-12-01' then 9 else 4 end
$$;
create or replace function public.validar_dsr_mensal_trigger() returns trigger
language plpgsql set search_path = '' as $$
declare v_inicio date; v_fim date; v_dias integer; v_trabalho integer; v_minimo integer;
  v_semana date; v_janela date;
begin
  if new.situacao not in ('trabalho','feriado') then return new; end if;
  if tg_op = 'UPDATE' then
    if old.situacao = new.situacao and old.funcionario_id = new.funcionario_id and old.data = new.data then
      return new;
    end if;
  end if;
  -- Mesmo bloqueio das RPCs para serializar a contagem por funcionário.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.funcionario_id::text,0));
  v_inicio := pg_catalog.date_trunc('month',new.data)::date;
  v_fim := (v_inicio + interval '1 month')::date;
  v_dias := v_fim - v_inicio;
  v_minimo := public.dsr_minimo_mensal(new.data);
  select count(*) into v_trabalho from public.jornadas
    where funcionario_id = new.funcionario_id and situacao in ('trabalho','feriado')
      and data >= v_inicio and data < v_fim;
  if v_dias - v_trabalho < v_minimo then
    raise exception 'Bloqueado: são obrigatórias pelo menos % folgas DSR no mês. Restariam apenas % dias para DSR.',v_minimo,v_dias-v_trabalho
      using errcode='23514';
  end if;
  v_semana := new.data - (extract(isodow from new.data)::integer-1);
  if v_semana+6 >= date '2026-12-16' then
    select count(*) into v_trabalho from public.jornadas
      where funcionario_id=new.funcionario_id and data between v_semana and v_semana+6
        and situacao in ('trabalho','feriado');
    if v_trabalho > 5 then
      raise exception 'Bloqueado: a escala 5x2 exige dois DSR por semana; feriado não trabalhado não substitui DSR.' using errcode='23514';
    end if;
  end if;
  if new.situacao='trabalho' then
    for v_janela in select new.data+g.n from pg_catalog.generate_series(-6,0) g(n) loop
      if v_janela+6 >= date '2026-12-16' and
        (select count(*) from public.jornadas where funcionario_id=new.funcionario_id
          and situacao='trabalho' and data between v_janela and v_janela+6)=7 then
        raise exception 'Bloqueado: sete dias consecutivos não são permitidos na escala 5x2.' using errcode='23514';
      end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists validar_dsr_mensal on public.jornadas;
create trigger validar_dsr_mensal after insert or update on public.jornadas
for each row execute function public.validar_dsr_mensal_trigger();
revoke execute on function public.validar_dsr_mensal_trigger(),public.dsr_minimo_mensal(date) from public,anon,authenticated;
commit;
