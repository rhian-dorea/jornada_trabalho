# Controle de Escalas e DSR

Sistema web para planejar jornadas, consultar quem trabalha em cada dia e acompanhar folgas e descansos exigidos pelas regras da escala. A interface tem **Escalas** e **Funcionários**. O site é estático; autenticação, dados e validação definitiva ficam no **Supabase (Auth + PostgreSQL)**.

## Como o sistema funciona

1. **Acesso:** o usuário entra com e-mail e senha. A conta precisa existir no Supabase Auth e ter um perfil ativo na tabela `public.perfis`. O sistema não oferece cadastro público de contas.
2. **Consulta da escala:** em **Escalas**, escolha a visão mensal ou semanal e navegue entre períodos. O mês mostra o nome completo de todas as pessoas escaladas para trabalhar em cada dia; as células crescem conforme a equipe. As duas visões usam a mesma busca por nome/cargo e filtros de equipe/cargo. **Hoje** volta ao período atual. Os dias abaixo da cobertura mínima recebem um indicador no próprio calendário.
3. **Lançamento diário:** clique em um dia do mês para ver todas as pessoas dessa data ou numa célula da semana para ver apenas o funcionário daquela linha. O lançamento oferece **Trabalho**, **Folga** e **Remover**, conforme o perfil de acesso. Nesta versão não há cadastro de horários de jornada.
4. **Funcionários:** consulte a lista, busque por nome, cargo, equipe ou matrícula e filtre ativos/desativados. O administrador pode usar **Novo funcionário**, editar os dados e desativar ou reativar uma pessoa. A desativação preserva as jornadas anteriores.
5. **Exportação:** **Exportar CSV** gera os lançamentos do período e filtros atuais em formato UTF-8 compatível com Excel. **Imprimir / PDF** abre a impressão do navegador; escolha “Salvar como PDF”.
6. **Sincronização:** após uma gravação, o navegador recarrega os dados do banco. Ele também atualiza a aba visível a cada 60 segundos, ao voltar para ela e quando o usuário clica em **Atualizar**.

A pré-validação no navegador mostra bloqueios e avisos rapidamente. Cada alteração passa novamente pelas funções SQL do banco, que conferem permissões, regras e versão do registro antes de confirmar. Se duas pessoas editarem o mesmo registro, a versão antiga provoca um conflito para revisão em vez de sobrescrever a alteração mais recente.

## O que aparece no calendário

| Situação | Significado |
| --- | --- |
| **Trabalho** | Existe um lançamento de trabalho gravado para a pessoa e o dia. |
| **Folga** | Existe um lançamento explícito de folga gravado. |
| **Descanso obrigatório ⛔** | A escala existente impediria um novo lançamento de trabalho nessa data. É um estado calculado, **não** uma folga gravada automaticamente. |
| **Aviso ⚠** | Supervisor ou Coordenador está em uma exceção permitida: por padrão, 7º dia seguido ou 2º domingo seguido. O motivo completo fica no detalhe do dia. |
| **Sem lançamento** | Não há trabalho nem folga registrados, e a data não apresenta bloqueio calculado. |

Nos dias de descanso necessário ou de exceção, a interface desabilita o botão **Folga** porque o motivo já aparece na escala. Folgas registradas anteriormente continuam visíveis e podem ser corrigidas. Um dia sem lançamento não conta como dia trabalhado.

### Regras de escala

| Cargo do funcionário | Dias consecutivos de trabalho | Domingos consecutivos de trabalho |
| --- | --- | --- |
| Cargo comum | Até 6; o 7º é bloqueado. | Para mulheres, o 2º domingo é bloqueado. |
| Supervisor ou Coordenador | O 7º é permitido com aviso vermelho; o 8º é bloqueado. | O 2º é permitido com aviso vermelho; o 3º é bloqueado, independentemente do sexo. |

Esses limites são os **padrões** armazenados no Supabase. As verificações consideram viradas de semana, mês e ano, inclusive lançamentos retroativos. Alterar sexo ou cargo é recusado se isso tornar jornadas existentes inválidas. Veja os detalhes em [Regras de negócio](docs/REGRAS_DE_NEGOCIO.md). Essas regras são requisitos operacionais do sistema; não representam uma verificação completa da legislação trabalhista.

## Perfis de acesso e cargos

**Perfil de acesso** é a permissão da pessoa que entra no sistema. **Cargo** pertence ao funcionário da escala e define se as exceções de Supervisor/Coordenador se aplicam. Um gestor do sistema não é automaticamente um Supervisor na escala.

| Perfil | O que pode fazer |
| --- | --- |
| **Administrador** | Consulta todos os funcionários e equipes, cadastra/edita funcionários e altera jornadas. |
| **Gestor** | Consulta as equipes atribuídas e altera as jornadas dessas equipes. Não cadastra funcionários. |
| **Funcionário** (`funcionario`; legado `visualizacao`) | Consulta apenas as equipes atribuídas, sem alterar dados. |

Funcionários sem equipe aparecem apenas para o administrador até receberem uma equipe. O cadastro oferece **Despachante, Supervisor, Coordenador e Analista**, além da opção de criar outros cargos. Nomes antigos no feminino são apresentados no masculino; o script `005_normalizar_cargos.sql` atualiza os registros antigos no banco quando executado.

É possível ter **mais de um administrador**. Cada um precisa de uma conta própria no Supabase Auth e de um registro com perfil `administrador` em `public.perfis`. A criação de contas, a mudança de gestor para administrador e a atribuição de equipes são feitas por alguém com acesso administrativo ao projeto Supabase. Essas operações não ficam na interface do aplicativo; veja [Configuração do Supabase](docs/CONFIGURACAO_SUPABASE.md).

## Instalação local

**Pré-requisitos:** projeto Supabase, servidor HTTP local (Python ou equivalente) e Node.js apenas para executar os testes. Não há etapa de compilação nem dependências npm obrigatórias para abrir a aplicação.

1. Siga [Configuração do Supabase](docs/CONFIGURACAO_SUPABASE.md). Em projeto novo, execute os scripts `sql/001_schema.sql` a `sql/006_configuracoes_empresa.sql` **na ordem numérica**. Em projeto existente, execute apenas os scripts novos que faltam. Faça backup antes da migração. Colocar os arquivos no repositório não os executa no banco.
2. Em [`js/config.js`](js/config.js), informe a URL e a **chave publicável** do projeto. O arquivo já contém valores públicos de uma instalação; substitua-os ao configurar outra. Nunca coloque `service_role`, senha do banco ou outro segredo no frontend.
3. Crie o primeiro usuário no Supabase Auth e seu perfil `administrador` em `public.perfis`. Configure os perfis e as equipes dos demais usuários conforme o guia.
4. Na raiz do repositório, inicie um servidor HTTP:

   ```bash
   python -m http.server 8000
   ```

5. Abra `http://localhost:8000/`, entre com o administrador, cadastre um funcionário e teste uma jornada. Depois confira o resultado em outra sessão autorizada.

Para publicar, siga [Implantação, backup e manutenção](docs/IMPLANTACAO.md). O site publicado precisa alcançar o Supabase e carregar o SDK JavaScript pela CDN. Configure a URL publicada nos redirecionamentos do Supabase Auth, especialmente para recuperação de senha.

## Dados, segurança e auditoria

```text
Navegador → Supabase Auth → perfil ativo → RLS por equipe → leitura da escala
Navegador → função SQL (RPC) → permissão + versão + regras → gravação + auditoria
```

O PostgreSQL guarda funcionários, jornadas, perfis, equipes autorizadas e auditoria. As políticas de **Row Level Security (RLS)** filtram as leituras. As funções SQL conferem o perfil e a equipe, validam a escala e comparam a versão do registro. Uma falha reverte a operação. A auditoria é gravada no banco, mas não há uma tela de consulta à auditoria nesta versão; a consulta administrativa pode ser feita no Supabase.

O navegador não usa `localStorage` como fonte dos dados operacionais; a sessão de autenticação é gerenciada pelo SDK do Supabase. Os arquivos `js/csv.js` e `js/migration.js` e as funções SQL correspondentes permanecem no repositório para compatibilidade. A exportação CSV da interface contém os lançamentos visíveis; não substitui um backup completo do banco.

### Limite para uso por várias empresas

`006_configuracoes_empresa.sql` adiciona `empresa_id` aos dados operacionais e a tabela `empresas`, preenchendo todos os registros antigos com a empresa da instalação. **A implantação continua com uma empresa por projeto Supabase.** Para reunir clientes numa base compartilhada, é preciso adaptar todas as políticas RLS, RPCs, chaves únicas, auditoria e importações para restringir cada operação por `empresa_id`, além de testar isolamento entre clientes. O campo sozinho não fornece esse isolamento.

### Fontes de dados futuras

O projeto já usa Supabase. Para importar uma planilha Google Sheets com abas `Escala`, `_Registros` e `_Funcionarios`, mapeie funcionários por identificador estável para `funcionarios` e cada data/situação para `jornadas`, valide conflitos e execute a carga em homologação antes da produção. Para Firebase, substitua `js/data.js` por consultas/transações do Firestore, implemente regras de segurança por equipe e mova a validação transacional de `sql/006_configuracoes_empresa.sql` para um backend confiável; não confie só na pré-validação do navegador.

## Testes e validação

Execute os testes locais com:

```bash
npm test
```

Eles cobrem regras de escala, limites configuráveis, cobertura, CSV e migração local. **A validação com um projeto Supabase real ainda está pendente**: execute a [matriz de validação](tests/VALIDACAO_SUPABASE.md) em homologação, incluindo permissões via API, conflitos entre sessões, regras do banco e restauração de backup, antes de declarar prontidão para produção.

## Organização do repositório

| Caminho | Responsabilidade |
| --- | --- |
| `index.html`, `css/style.css`, `assets/` | Telas, estilos e identidade visual. |
| `js/app.js`, `js/calendar-state.js`, `js/rules.js`, `js/settings.js` | Navegação, calendário, regras, cobertura e configurações. |
| `js/data.js`, `js/config.js` | Comunicação com Supabase e configuração pública. |
| `js/csv.js`, `js/migration.js` | Utilitários de CSV e migração local, sem controles na interface atual. |
| `sql/001_schema.sql` a `sql/006_configuracoes_empresa.sql` | Tabelas, segurança, funções transacionais, regras, cargos e configurações. |
| `tests/`, `docs/` | Testes, matriz de homologação e documentação de instalação e operação. |

O arquivo original `Controle_de_Escalas_e_DSR.html` permanece apenas no workspace e é ignorado pelo Git porque contém dados de demonstração.
