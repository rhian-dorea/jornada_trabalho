# Configuração do Supabase

1. Crie uma conta em [Supabase](https://supabase.com/dashboard) e escolha **New project**. Escolha organização, nome, região e senha forte do banco. Guarde essa senha fora do repositório.
2. Após a criação, abra **Project Settings → API Keys**. Copie a **Project URL** e a **publishable key** (`sb_publishable_...`). Em instalações com painel antigo, a chave `anon` pública pode existir, mas prefira a publicável. Jamais copie `secret`, `service_role`, senha do banco ou token de usuário para o código.
3. Edite somente `js/config.js`: defina `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` como strings. Esses valores são públicos; a segurança dos dados depende das políticas do banco.
4. Abra **SQL Editor → New query**. Em projeto vazio, execute, na ordem, `sql/001_schema.sql`, `sql/002_security.sql`, `sql/003_business_rules.sql`, `sql/004_cargos_excecoes.sql` e `sql/005_normalizar_cargos.sql`. Cada arquivo deve terminar sem erro. Em projeto existente, execute os scripts novos ainda não aplicados; o `005` padroniza Supervisor e Coordenador nos registros antigos.
5. Em **Database → Table Editor**, confira `funcionarios`, `jornadas`, `perfis`, `perfil_equipes`, `auditoria` e `migracoes_locais`. Confira as políticas RLS em cada tabela. No SQL Editor, execute `select tablename,rowsecurity from pg_tables where schemaname='public';`; todas essas tabelas devem apresentar `true`.
6. Em **Authentication → Providers → Email**, habilite login por e-mail/senha e desative **Allow new users to sign up** em **Authentication → Settings/General** (o nome pode variar no painel). O frontend não oferece cadastro público, mas desativá-lo no Auth é obrigatório.
7. Em **Authentication → URL Configuration**, configure **Site URL** com a URL HTTPS exata do GitHub Pages, inclusive `/nome-do-repositorio/`. Adicione nas **Redirect URLs** a URL `https://usuario.github.io/repositorio/index.html`. Para testes locais, adicione `http://localhost:8000/index.html`. Não use curingas amplos em produção.
8. Em **Authentication → Users → Add user**, crie o primeiro usuário com e-mail e senha temporária, ou envie convite pelo painel. Copie o UUID desse usuário. No SQL Editor, execute:

```sql
insert into public.perfis(id,nome,perfil,ativo)
values ('UUID-DO-USUARIO-CRIADO-NO-AUTH','Nome do administrador','administrador',true);
```

9. Para outros usuários, crie cada conta em **Authentication → Users** e depois insira o perfil pelo SQL Editor. Exemplos:

```sql
insert into public.perfis(id,nome,perfil,ativo)
values ('UUID-DO-GESTOR','Nome do gestor','gestor',true);

insert into public.perfil_equipes(usuario_id,equipe)
values ('UUID-DO-GESTOR','Equipe A');
```

Para alterar papel ou bloquear acesso, use `update public.perfis set perfil='visualizacao' where id='UUID';` ou `update public.perfis set ativo=false where id='UUID';`. Para mudar o escopo, adicione/remova linhas em `perfil_equipes`. Execute essas ações apenas no painel administrativo por pessoa com acesso autorizado ao projeto. Mudanças de perfil e equipe são auditadas. Um administrador do aplicativo não recebe chave secreta nem permissão para se promover via API.

10. Para recuperação de senha, configure o template de e-mail e remetente em **Authentication → Email Templates**. O método `resetPasswordForEmail` envia o usuário de volta a `index.html`; a página exibe o formulário para nova senha. Para uso empresarial e volume maior, configure SMTP próprio conforme a [documentação de e-mail do Supabase](https://supabase.com/docs/guides/auth/auth-smtp). Sem entrega de e-mail configurada, convites e recuperação podem não chegar.
11. Sirva o site localmente (`python -m http.server 8000`) e entre com o administrador. Crie um funcionário, registre e corrija uma jornada, recarregue a página. No Table Editor, confira as tabelas `funcionarios`, `jornadas` e `auditoria`.
12. Teste com usuário `visualizacao`, gestor da Equipe A, gestor de outra equipe e usuário sem perfil. Verifique via interface **e via chamadas diretas à Data API**: anônimo não lê, visualização não grava, gestor não lê equipe alheia, perfil inativo não recebe dados, e inserção direta em `jornadas` ou alteração de `perfis` falha. Verifique também as regras de sete dias e domingos usando a RPC. Esses testes dependem do projeto Supabase real e não foram executados neste ambiente.

## Atenção à configuração de API

Em **Settings → Data API**, mantenha `public` exposto para as consultas e RPCs usadas pelo frontend. Os grants e RLS dos scripts restringem o acesso. Não conceda `INSERT`, `UPDATE` ou `DELETE` das tabelas a `authenticated` ou `anon`. A chave publicável autoriza acesso ao projeto, mas não substitui o token de login nem contorna RLS.

Referências: [instalação do SDK](https://supabase.com/docs/reference/javascript/installing), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funções SQL](https://supabase.com/docs/guides/database/functions), [redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls), [configuração do Auth](https://supabase.com/docs/guides/auth/general-configuration).
