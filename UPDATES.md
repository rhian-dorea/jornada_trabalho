# Atualizações

## 2026-11-17 — calendário e configurações

- A visão mensal usa células compactas, indicadores de cobertura e acesso ao detalhe; a semanal usa estados curtos e lista por dia no celular.
- Busca e filtros de equipe/cargo atuam nas duas visões. O resumo, tema escuro, impressão/PDF e exportação CSV foram adicionados.
- Configurações de empresa, turnos, limites de descanso, interjornada e cobertura são persistidas no Supabase pela migração `006_configuracoes_empresa.sql`.
- A migração adiciona `empresa_id` sem modificar IDs ou jornadas existentes. A instalação continua isolada por projeto Supabase.
- Testes locais: `npm test`; análise sintática: `node --check` e `pglast` para o SQL. Execução da migração e testes de permissão com um Supabase de homologação permanecem necessários.
