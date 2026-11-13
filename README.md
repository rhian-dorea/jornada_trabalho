# Controle de Escalas e DSR

Aplicação estática baseada no arquivo original `Controle_de_Escalas_e_DSR.html`. Mantém calendário mensal e semanal, lançamento de trabalho/folga, alertas, cadastro e CSV. O PostgreSQL do Supabase é a fonte dos dados. O navegador consulta períodos e só lê `localStorage` quando o administrador inicia uma migração.

## Estrutura

- `index.html`, `css/style.css`: interface original adaptada para login e estados de sincronização.
- `js/app.js`, `js/rules.js`: calendário, interações e pré-validação visual.
- `js/data.js`, `js/config.js`: acesso ao Supabase e configuração pública.
- `js/csv.js`, `js/migration.js`: CSV e migração local com backup.
- `sql/001_schema.sql`, `002_security.sql`, `003_business_rules.sql`: banco, RLS e operações transacionais. Execute nessa ordem.
- `tests/frontend.test.mjs`: testes locais do navegador e regras em JavaScript.
- `docs/`: arquitetura, regras, configuração e implantação.
- `Controle_de_Escalas_e_DSR.html`: arquivo original preservado apenas localmente e ignorado pelo Git porque contém registros de demonstração.

## Executar

1. Siga [CONFIGURACAO_SUPABASE.md](docs/CONFIGURACAO_SUPABASE.md).
2. Informe URL e chave publicável em `js/config.js`. Nunca use chave secreta.
3. Sirva esta pasta por HTTP local, por exemplo `python -m http.server 8000`, e abra `http://localhost:8000/`.
4. Rode `npm test` com Node.js instalado. O teste não exige instalação de dependências.

Para publicar no GitHub Pages, siga [IMPLANTACAO.md](docs/IMPLANTACAO.md). O serviço precisa de conexão com Supabase e CDN do SDK. A recuperação de senha por e-mail depende da configuração de e-mail do Supabase.

## Perfis

Administrador consulta e altera todos os funcionários e jornadas, importa CSV e consulta auditoria. Gestor consulta e altera jornadas das equipes atribuídas. Visualização só consulta as equipes atribuídas. Funcionários sem equipe aparecem apenas ao administrador, até serem atribuídos a uma equipe.

As validações de seis dias e domingos são regras operacionais deste sistema; não substituem uma análise completa de conformidade trabalhista.
