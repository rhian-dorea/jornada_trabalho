-- Negar privilégios herdados; RLS e grants são duas barreiras independentes.
begin;
revoke all on public.perfis,public.perfil_equipes,public.funcionarios,public.jornadas,
  public.auditoria,public.migracoes_locais from anon,authenticated;
revoke all on all sequences in schema public from anon,authenticated;
revoke execute on function public.auditar_alteracao() from public,anon,authenticated;

alter table public.perfis enable row level security;
alter table public.perfil_equipes enable row level security;
alter table public.funcionarios enable row level security;
alter table public.jornadas enable row level security;
alter table public.auditoria enable row level security;
alter table public.migracoes_locais enable row level security;

create or replace function public.meu_perfil() returns text
language sql stable security definer set search_path = '' as $$
  select p.perfil from public.perfis p where p.id = auth.uid() and p.ativo
$$;

create or replace function public.pode_ver_equipe(p_equipe text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when public.meu_perfil() = 'administrador' then true
    when public.meu_perfil() in ('gestor','visualizacao') and p_equipe is not null
      then exists(select 1 from public.perfil_equipes pe
        where pe.usuario_id = auth.uid() and pe.equipe = p_equipe)
    else false end
$$;

create or replace function public.pode_gerir_equipe(p_equipe text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when public.meu_perfil() = 'administrador' then true
    when public.meu_perfil() = 'gestor' and p_equipe is not null
      then exists(select 1 from public.perfil_equipes pe
        where pe.usuario_id = auth.uid() and pe.equipe = p_equipe)
    else false end
$$;

create policy perfis_proprio on public.perfis for select to authenticated
  using (id = (select auth.uid()));
create policy equipes_proprias on public.perfil_equipes for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy funcionarios_escopo on public.funcionarios for select to authenticated
  using (public.pode_ver_equipe(equipe));
create policy jornadas_escopo on public.jornadas for select to authenticated
  using (exists(select 1 from public.funcionarios f where f.id=funcionario_id
    and public.pode_ver_equipe(f.equipe)));
create policy auditoria_admin on public.auditoria for select to authenticated
  using ((select public.meu_perfil())='administrador');
create policy migracoes_admin on public.migracoes_locais for select to authenticated
  using ((select public.meu_perfil())='administrador');

grant select on public.perfis,public.perfil_equipes,public.funcionarios,
  public.jornadas,public.auditoria,public.migracoes_locais to authenticated;
revoke execute on function public.meu_perfil(),public.pode_ver_equipe(text),
  public.pode_gerir_equipe(text) from public,anon;
grant execute on function public.meu_perfil(),public.pode_ver_equipe(text),
  public.pode_gerir_equipe(text) to authenticated;

-- Contas e perfis são criados no Dashboard/SQL Editor, nunca por uma chave no browser.
commit;
