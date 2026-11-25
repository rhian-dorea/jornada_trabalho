# Atualizações

## 2026-11-25 — regras uniformes e análise abaixo do calendário

- Bloqueio de sete dias para todos; bloqueio de dois domingos apenas para mulheres, independentemente do cargo, com verificação entre meses e anos. Migração 010 alinha PostgreSQL.
- Feriado de descanso mantém o motivo de dias/domingo, mas soma zero DSR. Novas Folgas em feriado são gravadas como feriado.
- Calendário acima da análise, com datas e totais de DSR e feriados separados por funcionário. Cores dos nomes preservadas.
- 34 testes JavaScript e testes PostgreSQL de sexo, cargo e virada de mês aprovados.


## 2026-11-25 — cor de feriado restrita ao calendário

- As caixinhas de funcionários em folga no feriado voltam ao verde de Folga, inclusive os estados equivalentes na semana e no detalhe. Trabalho e descanso mantêm suas cores habituais.
- O destaque dourado permanece na célula/cabeçalho do feriado; a contagem de DSR não foi alterada.

## 2026-11-25 — feriado excluído de DSR em qualquer situação

- Regra corrigida conforme orientação mais recente: feriado nacional nunca soma DSR, mesmo marcado como Folga ou com descanso por dias/domingo. Contagem mensal, semanal e resumo usam a mesma exclusão.
- Folgas antigas em feriados aparecem como feriado não trabalhado sem alterar os registros no banco. Removido o botão de marcação Feriado não trabalhado; continuam Trabalho, Folga e Remover.
- Limites SQL mensal/semanal também excluem as datas nacionais. Nova migração 009 para instalações que já aplicaram 007/008; aplicar antes de publicar a correção.
- A nova política substitui a orientação anterior de contar coincidência. É regra interna, não conclusão jurídica universal.


## 2026-11-25 — documentação operacional e referências legais

- README reorganizado com índice de guias, uso diário, contagem, transição, implantação, permissões e estrutura dos módulos.
- Criado guia operacional e legal com exemplos de DSR/feriados, sequência da Lara, lista nacional e referências oficiais consultadas em 25/11/2026.
- Explicitadas as políticas internas de quatro/nove DSR e dezembro inteiro, as exceções históricas e os controles não implementados. Guias técnicos alinhados à nova documentação.
- Alterações restritas à documentação; comportamento da aplicação e banco preservados.


## 2026-11-25 — DSR mensal, transição 5×2 e feriados nacionais

- Desenvolvimento na branch `codex/dsr-quatro-folgas-mensais`, sem atualização da main ou do banco de produção.
- Mínimo individual de quatro DSR até novembro/2026 e nove desde dezembro/2026 inteiro, conforme decisão do usuário. Dois DSR por semana a partir de 16/12, incluindo a semana de transição 14–20/12.
- DSR conta datas distintas de Folga ou descanso automático; feriado sozinho não acrescenta DSR. Novo registro individual de feriado não trabalhado, preservando os registros anteriores.
- Calendários mensal, semanal e celular mostram somente os feriados nacionais, com cor e nome.
- Migrações 007 e 008 preparadas e testadas em PostgreSQL 17 descartável, incluindo RPC, inserção, alteração, remoção, meses de tamanhos diferentes, mínimos semanal/mensal e transição. 28 testes JavaScript aprovados.
- Documentadas as fontes legais e as escolhas internas que não representam limites legais universais.


## 2026-11-24 — separar ciclo exibido e validação de lançamento

- Corrigida a interpretação anterior: o calendário e o resumo mostram o descanso pelo ciclo anterior à data, sem somar trabalhos futuros. Folga e ausência de trabalho interrompem os dias consecutivos.
- Na escala enviada, 20/11 não mostra descanso por dias; 29/11, após a folga em 28, mantém apenas o motivo de domingos quando 22/11 tem trabalho.
- A validação de um novo Trabalho permanece bidirecional para impedir que uma edição una blocos acima do limite. A mudança substitui a interpretação documentada em “verificação do recálculo da Lara”.

## 2026-11-24 — verificação do recálculo da Lara

- Reproduzida a escala com Trabalho em 16–19 e 21–23, e Folga em 24/11. Preencher o dia 20 ainda formaria oito dias de trabalho: o bloqueio permanece correto nesse cenário.
- Adicionado teste para folga e remoção em 24/11 e para interrupção em 22/11; quando o bloco cai para seis dias, o aviso do dia 20 desaparece. Regras de produção preservadas.

## 2026-11-19 — descanso preventivo restaurado

- Restaurado o descanso calculado em datas que uniriam blocos de trabalho antes e depois, incluindo Lara em 20/11/26.
- O calendário e o detalhe exibem o limite da regra (7 dias / 2 domingos), sem informar que o descanso é um dia trabalhado. A validação de gravação continua verificando a sequência completa.

## 2026-11-19 — destaque dos fins de semana

- Sábado e domingo recebem fundo azul claro no mês e nos cabeçalhos semanais, inclusive no celular. Células semanais vazias acompanham o destaque; as situações registradas mantêm suas cores.
- O tema escuro usa uma tonalidade equivalente com contraste adequado.

## 2026-11-19 — atualização dos arquivos no navegador

- HTML referencia versões do CSS, aplicativo, regras e estado do calendário para evitar reutilizar arquivos antigos após o deploy.
- Conferido no GitHub Pages: o código publicado já começa na segunda-feira; os arquivos são servidos com cache de até 600 segundos.

## 2026-11-19 — ordem dos dias

- Calendários mensal e semanal começam na segunda-feira e terminam no domingo, inclusive no celular.
- Alinhamento das datas e intervalo consultado acompanham a nova ordem; o destaque do domingo permanece no último dia.

## 2026-11-19 — reinício dos ciclos de descanso

- Avisos no calendário e no resumo contam somente a sequência anterior à data, sem juntar jornadas futuras através de um descanso.
- Um dia sem trabalho interrompe os dias consecutivos; um domingo sem trabalho interrompe os domingos consecutivos.
- A validação ao salvar continua verificando os dois lados da data, alinhada ao SQL, para impedir que edições retroativas unam sequências inválidas. Não há alteração de dados ou migração SQL.
- Testes cobrem a escala da Lara, reinício dos ciclos, limites de liderança e viradas de mês/ano.

## 2026-11-17 — calendário e configurações

- A visão mensal usa células compactas, indicadores de cobertura e acesso ao detalhe; a semanal usa estados curtos e lista por dia no celular.
- Busca e filtros de equipe/cargo atuam nas duas visões. Tema escuro, impressão/PDF e exportação CSV foram adicionados.
- Dados de empresa, limites de descanso e cobertura são persistidos no Supabase pela migração `006_configuracoes_empresa.sql`.
- A migração adiciona `empresa_id` sem modificar IDs ou jornadas existentes. A instalação continua isolada por projeto Supabase.
- Testes locais: `npm test`; análise sintática: `node --check` e `pglast` para o SQL. Execução da migração e testes de permissão com um Supabase de homologação permanecem necessários.

## Ajustes da interface

- A navegação contém apenas Escalas e Funcionários; a tela de Configurações foi removida.
- O calendário mensal mostra o nome completo de todas as pessoas escaladas para trabalhar em cada dia, sem contador ocultando os demais.
- Os cards de resumo acima do calendário foram removidos. A paleta agora distingue trabalho, folga, aviso e descanso com cores mais sóbrias, inclusive no tema escuro.
- A identidade principal foi atualizada para azul escuro empresarial no cabeçalho, navegação, ações e estados de trabalho.
- O lançamento de jornada não mostra turno nem horário; o calendário e o CSV exibem apenas situação e dados do funcionário.
- Dias sem pessoas escaladas mostram “—” sem alerta “Faltam 1”. Na semana, o detalhe da célula mostra somente o funcionário da linha; o detalhe geral fica no mês.
