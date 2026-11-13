-- Execute em um projeto Supabase novo, pelo SQL Editor.
begin;
create extension if not exists pgcrypto;

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  perfil text not null check (perfil in ('administrador','gestor','visualizacao')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.perfil_equipes (
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  equipe text not null check (length(btrim(equipe)) between 1 and 80),
  primary key (usuario_id,equipe)
);

create table public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 60),
  matricula text unique,
  sexo text not null check (sexo in ('M','F')),
  cargo text not null default '' check (length(cargo) <= 40),
  equipe text check (equipe is null or length(btrim(equipe)) between 1 and 80),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint matricula_valida check (matricula is null or length(btrim(matricula)) between 1 and 80)
);

create table public.jornadas (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete restrict,
  data date not null,
  situacao text not null check (situacao in ('trabalho','folga')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  atualizado_por uuid references auth.users(id),
  unique (funcionario_id,data)
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid,
  operacao text not null,
  tabela text not null,
  registro_id text not null,
  valores_anteriores jsonb,
  valores_novos jsonb,
  criado_em timestamptz not null default now()
);

-- O mapeamento torna a migração local repetível sem identificar funcionários por nome.
create table public.migracoes_locais (
  origem text not null,
  legado_id text not null,
  funcionario_id uuid not null references public.funcionarios(id) on delete restrict,
  criado_em timestamptz not null default now(),
  primary key (origem,legado_id),
  unique (legado_id)
);

create index jornadas_periodo_idx on public.jornadas (data,funcionario_id);
create index jornadas_funcionario_data_idx on public.jornadas (funcionario_id,data) include (situacao);
create index funcionarios_equipe_idx on public.funcionarios (equipe,ativo);
create index auditoria_data_idx on public.auditoria (criado_em desc);

create or replace function public.auditar_alteracao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.auditoria(usuario_id,operacao,tabela,registro_id,valores_anteriores,valores_novos)
  values(auth.uid(),tg_op,tg_table_name,
    coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'usuario_id',to_jsonb(old)->>'usuario_id'),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end $$;

create trigger auditar_funcionarios after insert or update or delete on public.funcionarios
for each row execute function public.auditar_alteracao();
create trigger auditar_jornadas after insert or update or delete on public.jornadas
for each row execute function public.auditar_alteracao();
create trigger auditar_perfis after insert or update or delete on public.perfis
for each row execute function public.auditar_alteracao();
create trigger auditar_equipes after insert or update or delete on public.perfil_equipes
for each row execute function public.auditar_alteracao();

revoke all on public.perfis,public.perfil_equipes,public.funcionarios,public.jornadas,
  public.auditoria,public.migracoes_locais from anon,authenticated;
alter table public.perfis enable row level security;
alter table public.perfil_equipes enable row level security;
alter table public.funcionarios enable row level security;
alter table public.jornadas enable row level security;
alter table public.auditoria enable row level security;
alter table public.migracoes_locais enable row level security;
revoke execute on function public.auditar_alteracao() from public,anon,authenticated;
commit;
