-- Execute após 003_business_rules.sql, inclusive em projetos já instalados.
-- Supervisor/Coordenador: até 7 dias seguidos e até 2 domingos seguidos.
begin;

create or replace function public.validar_janela(p_funcionario uuid,p_data date) returns void
language plpgsql set search_path = '' as $$
declare v_inicio date; v_sexo text; v_cargo text; v_extendido boolean; v_janela integer;
begin
  select sexo,translate(lower(btrim(cargo)),'áàâãéêíóôõúç','aaaaeeiooouc') into v_sexo,v_cargo
    from public.funcionarios where id=p_funcionario;
  v_extendido:=coalesce(v_cargo in
    ('supervisor','supervisora','coordenador','coordenadora','coodenador','coodenadora'),false);
  v_janela:=case when v_extendido then 8 else 7 end;

  for v_inicio in select (p_data + g.n)::date
    from pg_catalog.generate_series(1-v_janela,0) g(n) loop
    if (select count(*) from public.jornadas
        where funcionario_id=p_funcionario and situacao='trabalho'
          and data between v_inicio and v_inicio+v_janela-1)=v_janela then
      raise exception 'Bloqueado: mais de % dias consecutivos de trabalho perto de %',
        v_janela-1,p_data using errcode='23514';
    end if;
  end loop;

  if v_extendido and exists(
    select 1 from public.jornadas a
    join public.jornadas b on b.funcionario_id=a.funcionario_id and b.data=a.data+7
    join public.jornadas c on c.funcionario_id=a.funcionario_id and c.data=a.data+14
    where a.funcionario_id=p_funcionario and a.situacao='trabalho'
      and b.situacao='trabalho' and c.situacao='trabalho'
      and extract(dow from a.data)=0 and p_data between a.data and c.data
  ) then
    raise exception 'Bloqueado: três domingos consecutivos de trabalho perto de %',p_data
      using errcode='23514';
  end if;

  if not v_extendido and v_sexo='F' and exists(
    select 1 from public.jornadas a
    join public.jornadas b on b.funcionario_id=a.funcionario_id and b.data=a.data+7
    where a.funcionario_id=p_funcionario and a.situacao='trabalho'
      and b.situacao='trabalho' and extract(dow from a.data)=0
      and (a.data between p_data-7 and p_data+7 or b.data between p_data-7 and p_data+7)
  ) then
    raise exception 'Bloqueado: dois domingos consecutivos de trabalho perto de %',p_data
      using errcode='23514';
  end if;
end $$;

create or replace function public.validar_sexo_trigger() returns trigger
language plpgsql set search_path = '' as $$
declare v_data date;
begin
  if new.sexo is distinct from old.sexo or new.cargo is distinct from old.cargo then
    for v_data in select data from public.jornadas
      where funcionario_id=new.id and situacao='trabalho' loop
      perform public.validar_janela(new.id,v_data);
    end loop;
  end if;
  return new;
end $$;

drop trigger validar_sexo on public.funcionarios;
create trigger validar_sexo after update of sexo,cargo on public.funcionarios
for each row execute function public.validar_sexo_trigger();

revoke execute on function public.validar_janela(uuid,date),public.validar_sexo_trigger()
  from public,anon,authenticated;
commit;
