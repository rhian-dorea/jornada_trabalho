# Arquitetura e análise do sistema original

## Inventário anterior à alteração

O arquivo original tem um único documento com CSS e JavaScript embutidos. Elementos principais: cabeçalho, KPIs, alertas, seletor mensal/semanal, navegação de período, grade/calendário, modal diário e configurações (funcionários, CSV e limpeza geral). Eventos: clique em células/dias, botões de navegação, cadastro/edição/exclusão, copiar/importar CSV e apagar todos os dados.

`S.emps` guarda `{id,name,sex,role}` e `S.rec[id][AAAA-MM-DD]` guarda `T` ou `F`. `save()` grava tudo em `escala_dsr_v2`; a leitura aceita `escala_dsr_v1`. A primeira execução introduz dados de demonstração. `importCSV()` identifica funcionários pelo nome e altera o estado local linha a linha; registros inválidos podem ser ignorados. `setSt()` valida e muda o estado; `render()` recalcula a grade e alertas; `openDay()` mostra os botões. O calendário mensal inclui dias adjacentes; o semanal começa domingo. `pos`, `run`, `sunV`, `check` e `info` calculam sequências e alertas. A regra original bloqueia o sétimo dia e dois domingos consecutivos para mulheres, inclusive nas bordas dos meses quando o histórico local está presente.

Dependências originais: `importCSV → check → run/W/st`; `setSt → check/save/render/openDay`; `render → info/pos/run/sunV/st`; `cfg → S.emps/S.rec`; todos dependem do estado global `S`. Riscos identificados: armazenamento local isolado e sujeito a perda; ausência de autenticação/RLS; exclusão física e limpeza geral; dados de exemplo automáticos; importação parcial e silenciosa; inconsistência por múltiplos usuários; ausência de auditoria. O código original permanece somente no workspace para comparação e não é publicado.

## Implementação atual

`index.html` e o CSS oferecem Escalas e Funcionários. `app.js` controla a exibição e as interações; `data.js` isola consultas e RPCs; `rules.js` faz pré-validação; `settings.js` define padrões e calcula cobertura. `csv.js` e `migration.js` continuam como utilitários legados. A confirmação decisiva ocorre nas funções e gatilhos SQL de `003_business_rules.sql`, `004_cargos_excecoes.sql` e `006_configuracoes_empresa.sql`. O HTML original permanece somente no workspace, ignorado pelo Git por conter dados de demonstração.

Fluxo: Supabase Auth autentica o usuário → `perfis` determina papel e estado ativo → RLS filtra funcionários/jornadas por equipe → consulta paginada pelo período, com margem de quatorze dias para cobrir três domingos consecutivos → calendário. A cada gravação, uma RPC verifica papel e equipe, serializa a operação por funcionário com advisory lock, compara `atualizado_em`, altera o registro e aciona os gatilhos de validação e auditoria. Erro causa rollback da transação. A interface só mostra sucesso após a RPC responder. Dados são recarregados a cada minuto e ao voltar à aba; o botão Atualizar permite recarga imediata. Realtime foi dispensado para manter configuração e superfície de acesso menores; o atraso esperado é de até um minuto enquanto a aba está visível.

`data` é `DATE`, sem conversão UTC no cliente. Os valores locais `T`/`F` são convertidos para `trabalho`/`folga` no banco. Funcionários são desativados, mantendo jornadas. A auditoria registra alterações em funcionários, jornadas, perfis e equipes; só administradores a consultam. `migracoes_locais` associa IDs legados a UUIDs e torna reimportação idempotente mesmo se a chave local passar de v1 para v2. Nenhum dado operacional novo é salvo em `localStorage`.

As chaves publicáveis e URL podem estar no frontend. O PostgreSQL aplica RLS e grants mesmo quando a API é chamada diretamente. Nenhuma chave administrativa deve ser publicada.
