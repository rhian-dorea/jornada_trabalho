# Implantação, backup e manutenção

## GitHub Pages

1. Crie um repositório privado se o código ainda incluir informações internas. Não publique CSV, backups, dados de funcionários, senhas, tokens ou chave secreta.
2. Ajuste `js/config.js` com **somente** a URL e a chave publicável do projeto. São valores destinados ao navegador; a proteção real está no Auth e na RLS.
3. Envie `index.html`, `assets/`, `css/`, `js/`, `sql/` e `docs/` para a raiz do repositório. O arquivo original é histórico; a página publicada é `index.html`.
4. Em **Settings → Pages**, selecione publicação da branch principal e pasta `/ (root)`. Aguarde a URL HTTPS do Pages. O site usa caminhos relativos e funciona em `/nome-do-repositorio/`.
5. Configure essa URL e `.../index.html` em **Authentication → URL Configuration** do Supabase. Faça login, logout, recarga e recuperação de senha na URL publicada. Verifique CSS e JS no navegador.
6. Para atualizar, faça backup antes de mudanças de banco, execute novos scripts SQL e publique a revisão dos arquivos. Evite reenviar scripts de criação sobre banco já inicializado.

## Migração do navegador antigo

A interface atual não oferece botão de migração. Se houver dados de uma versão antiga no navegador, preserve um backup antes de qualquer operação. Na página antiga, abra o console e execute `copy(localStorage.getItem('escala_dsr_v2') || localStorage.getItem('escala_dsr_v1'))`; salve o conteúdo em um arquivo `.json` protegido. A migração exige um procedimento administrativo separado que valide o arquivo e chame a função `migrar_local` com uma conta autorizada. A função aplica o lote em uma transação; erros revertem todas as alterações. A tabela `migracoes_locais` associa IDs antigos aos novos UUIDs e evita duplicações em nova tentativa. Não misture arquivos de origens diferentes sem avaliar colisões de IDs.

## Backup e restauração

- Para legado local, conserve o JSON baixado em local seguro.
- Para o banco, use o backup/restore gerenciado do plano Supabase ou `pg_dump`/`pg_restore` com credenciais administrativas **fora do navegador**, conforme a [documentação oficial de backups](https://supabase.com/docs/guides/platform/backups). Verifique disponibilidade e retenção do plano contratado.
- Teste restauração em projeto separado antes de usar em produção. Um CSV de lançamentos, quando obtido por procedimento administrativo, não substitui um backup completo de perfis, permissões e auditoria.
- Antes de restaurar, suspenda alterações dos usuários; preserve cópia do estado atual; registre quem realizou a operação.

## Operação

O botão **Atualizar** força leitura. A aba visível atualiza automaticamente a cada 60 segundos. Conflitos de versão exigem revisão e nova tentativa. Um erro de rede não grava em armazenamento local. Para revogar acesso, desative o perfil no SQL Editor e, se necessário, revogue as sessões no painel Auth. Revise periodicamente `auditoria`, usuários ativos, equipes e backups. Desativar funcionário mantém o histórico e permite reativação. Exclusão física requer procedimento SQL administrativo específico e backup prévio; a aplicação não expõe esse comando.

## Verificações antes de produção

Rode `npm test`. No projeto Supabase real, execute a matriz manual do final de `CONFIGURACAO_SUPABASE.md`, incluindo acesso direto à API e duas sessões concorrentes. Confirme também que o projeto e os serviços externos permanecem disponíveis no plano escolhido; limites e preços de serviços podem mudar.
