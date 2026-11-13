# Implantação, backup e manutenção

## GitHub Pages

1. Crie um repositório privado se o código ainda incluir informações internas. Não publique CSV, backups, dados de funcionários, senhas, tokens ou chave secreta.
2. Ajuste `js/config.js` com **somente** a URL e a chave publicável do projeto. São valores destinados ao navegador; a proteção real está no Auth e na RLS.
3. Envie `index.html`, `css/`, `js/`, `sql/` e `docs/` para a raiz do repositório. O arquivo original é histórico; a página publicada é `index.html`.
4. Em **Settings → Pages**, selecione publicação da branch principal e pasta `/ (root)`. Aguarde a URL HTTPS do Pages. O site usa caminhos relativos e funciona em `/nome-do-repositorio/`.
5. Configure essa URL e `.../index.html` em **Authentication → URL Configuration** do Supabase. Faça login, logout, recarga e recuperação de senha na URL publicada. Verifique CSS e JS no navegador.
6. Para atualizar, faça backup antes de mudanças de banco, execute novos scripts SQL e publique a revisão dos arquivos. Evite reenviar scripts de criação sobre banco já inicializado.

## Migração do navegador antigo

Abra o novo site **no mesmo navegador e mesma origem** do HTML antigo para que o `localStorage` esteja acessível. Uma URL diferente tem armazenamento isolado. Nesse caso, abra o console do navegador na página antiga, execute `copy(localStorage.getItem('escala_dsr_v2') || localStorage.getItem('escala_dsr_v1'))` e salve o texto copiado em um arquivo `.json` em local seguro. Na página nova, selecione esse arquivo em **JSON de backup da origem antiga**. Entre como administrador, abra Configurações, confira quantidades, erros e possível conteúdo de demonstração, clique em **Baixar backup**, confirme que o arquivo foi salvo, depois clique em **Confirmar migração**. O lote é transacional; erro reverte tudo. O armazenamento local original não é apagado. A tabela `migracoes_locais` evita duplicar IDs legados em nova tentativa. Não misture arquivos locais de origens diferentes sem avaliar colisões de IDs. Faça a migração com acesso restrito, pois o backup contém dados pessoais.

## Backup e restauração

- Para legado local, conserve o JSON baixado em local seguro.
- Para o banco, use o backup/restore gerenciado do plano Supabase ou `pg_dump`/`pg_restore` com credenciais administrativas **fora do navegador**, conforme a [documentação oficial de backups](https://supabase.com/docs/guides/platform/backups). Verifique disponibilidade e retenção do plano contratado.
- Teste restauração em projeto separado antes de usar em produção. A exportação CSV da interface é uma cópia dos lançamentos autorizados, não um backup completo de perfis, permissões e auditoria.
- Antes de restaurar, suspenda alterações dos usuários; preserve cópia do estado atual; registre quem realizou a operação.

## Operação

O botão **Atualizar** força leitura. A aba visível atualiza automaticamente a cada 60 segundos. Conflitos de versão exigem revisão e nova tentativa. Um erro de rede não grava em armazenamento local. Para revogar acesso, desative o perfil no SQL Editor e, se necessário, revogue as sessões no painel Auth. Revise periodicamente `auditoria`, usuários ativos, equipes e backups. Desativar funcionário mantém o histórico e permite reativação. Exclusão física requer procedimento SQL administrativo específico e backup prévio; a aplicação não expõe esse comando.

## Verificações antes de produção

Rode `npm test`. No projeto Supabase real, execute a matriz manual do final de `CONFIGURACAO_SUPABASE.md`, incluindo acesso direto à API e duas sessões concorrentes. Confirme também que o projeto e os serviços externos permanecem disponíveis no plano escolhido; limites e preços de serviços podem mudar.
