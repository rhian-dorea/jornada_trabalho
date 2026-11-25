-- Aplicar após 007. Novo registro individual de feriado não trabalhado, sem DSR.
begin;
alter table public.jornadas drop constraint if exists jornadas_situacao_check;
alter table public.jornadas add constraint jornadas_situacao_check
  check (situacao in ('trabalho','folga','feriado'));
create or replace function public.limpar_turno_folga() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.situacao<>'trabalho' then
    new.turno_nome:=null; new.inicio:=null; new.fim:=null;
  end if;
  return new;
end $$;
create or replace function public.salvar_jornada(
  p_funcionario uuid,p_data date,p_situacao text,p_versao timestamptz default null
) returns public.jornadas language plpgsql security definer set search_path = '' as $$
declare v public.jornadas; v_equipe text; v_ativo boolean; v_exists boolean;
begin
  if auth.uid() is null then raise exception 'Sessão expirada' using errcode='42501'; end if;
  if p_data is null or (p_situacao is not null and p_situacao not in ('trabalho','folga','feriado')) then
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

commit;
