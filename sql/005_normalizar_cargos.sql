-- Padroniza cargos antigos para uma única opção masculina na interface e no banco.
-- Execute após 004_cargos_excecoes.sql.
begin;

update public.funcionarios
set cargo = case
  when translate(lower(btrim(cargo)), 'áàâãéêíóôõúç', 'aaaaeeiooouc') in ('supervisor', 'supervisora') then 'Supervisor'
  when translate(lower(btrim(cargo)), 'áàâãéêíóôõúç', 'aaaaeeiooouc') in ('coordenador', 'coordenadora', 'coodenador', 'coodenadora') then 'Coordenador'
  else cargo
end
where translate(lower(btrim(cargo)), 'áàâãéêíóôõúç', 'aaaaeeiooouc') in
  ('supervisor', 'supervisora', 'coordenador', 'coordenadora', 'coodenador', 'coodenadora')
  and cargo is distinct from case
    when translate(lower(btrim(cargo)), 'áàâãéêíóôõúç', 'aaaaeeiooouc') in ('supervisor', 'supervisora') then 'Supervisor'
    else 'Coordenador'
  end;

commit;
