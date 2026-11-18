# Atualizações

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
