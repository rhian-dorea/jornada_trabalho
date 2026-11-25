-- Aplicar após 009. Seis dias para todos; domingos consecutivos somente para mulheres.
begin;
create or replace function public.validar_janela(p_funcionario uuid,p_data date) returns void
language plpgsql set search_path = '' as $$
declare v_inicio date; v_sexo text; v_cargo text; v_empresa uuid; v_regras jsonb;
  v_extendido boolean; v_dias integer; v_domingos integer; v_a public.jornadas; v_b public.jornadas;
  v_fim timestamp; v_inicio_proximo timestamp;
begin
  select sexo,translate(lower(btrim(cargo)),'áàâãéêíóôõúç','aaaaeeiooouc'),empresa_id
    into v_sexo,v_cargo,v_empresa from public.funcionarios where id=p_funcionario;
  select regras into v_regras from public.empresas where id=v_empresa;
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

commit;
