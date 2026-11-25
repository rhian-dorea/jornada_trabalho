# Controle de Escalas e DSR

Planejamento de trabalho, folgas e descanso semanal remunerado (DSR), com calendário mensal e semanal, cadastro de funcionários e validação das alterações no Supabase.

**Stack:** HTML, CSS e JavaScript em módulos; Supabase Auth e PostgreSQL. O frontend é estático, sem etapa de build.

> Esta documentação descreve a branch `codex/dsr-quatro-folgas-mensais`. Recursos novos dependem das migrações 007, 008 e 009. Publicar o código não executa scripts SQL nem substitui os dados cadastrados no banco.

## Documentação

| Preciso de… | Consulte |
| --- | --- |
| Entender DSR, feriados, bloqueios e referências legais | [Guia operacional e legal](docs/GUIA_OPERACIONAL_E_LEGAL.md) |
| Conferir a implementação da transição 5×2 | [DSR mensal e transição](docs/DSR_5X2.md) |
| Preparar banco, contas e equipes | [Configuração do Supabase](docs/CONFIGURACAO_SUPABASE.md) |
| Publicar e manter a instalação | [Implantação, backup e manutenção](docs/IMPLANTACAO.md) |
| Consultar validações técnicas | [Regras de negócio](docs/REGRAS_DE_NEGOCIO.md) e [matriz de homologação](tests/VALIDACAO_SUPABASE.md) |
| Ver o histórico | [Atualizações](UPDATES.md) |

## Recursos

- **Mensal:** nomes completos de todas as pessoas em Trabalho, Folga, Descanso e Feriado não trabalhado. Células crescem conforme a equipe.
- **Semanal:** uma linha por funcionário; no celular, lista organizada por dia. A semana começa na segunda e termina no domingo.
- **Resumo individual:** dias trabalhados, dias sem trabalho, folgas, motivos de descanso, feriados não trabalhados e situação do DSR mensal.
- **Feriados:** somente nacionais, com nome e fundo próprio. Sábados e domingos recebem destaque suave.
- **Funcionários:** cadastro, edição, cargos adicionais, desativação e reativação, preservando histórico.
- **Proteção de edição:** permissões por perfil/equipe, conferência de versão e auditoria no banco.

Nesta versão não há tela de Administração/Configurações, cadastro de horários de jornada nem botões de exportação CSV/PDF.

## Uso diário

1. Entre com uma conta autorizada. Não há cadastro público de usuários.
2. Abra **Escalas**, selecione Mensal ou Semanal e navegue pelas datas. **Hoje** retorna ao período atual.
3. No mês, clique no dia para consultar a equipe daquela data. Na semana, clique na célula para consultar o funcionário da linha.
4. Escolha **Trabalho**, **Folga** ou **Remover**, conforme as permissões. Folga marcada em feriado é exibida como feriado não trabalhado e soma zero DSR.
5. Confira o resumo de DSR e os avisos antes de considerar a escala concluída.
6. Use **Funcionários → Novo funcionário** para cadastrar pessoas, caso seu perfil seja Administrador.

Após uma gravação, os dados são recarregados. A aba visível também sincroniza a cada 60 segundos, ao voltar para ela e pelo botão **Atualizar**. Alterações simultâneas no mesmo registro geram conflito de versão para revisão.

## Situações e contagem

| Situação | Origem | Soma DSR? | Soma dia sem trabalho? |
| --- | --- | --- | --- |
| Trabalho | Lançamento gravado | Não | Não |
| Folga | Lançamento gravado | Sim, fora de feriado | Sim |
| Descanso obrigatório | Cálculo da escala | Sim, fora de feriado | Sim |
| Feriado não trabalhado | Lançamento individual gravado | Não | Sim |
| Apenas o feriado no cabeçalho | Calendário nacional | Não | Não |
| Vazio sem descanso calculado | Nenhum lançamento | Não | Não confirmado |

Dois motivos de descanso no mesmo dia não duplicam o total. **9 DSR + 1 feriado não trabalhado em outra data = 10 dias sem trabalho**. Se um dos nove descansos cair em feriado, o total será 8 DSR e 9 dias sem trabalho.

O descanso calculado não grava uma folga no banco. Ele pode mudar quando a escala muda. Nos dias de descanso calculado ou de exceção, a interface desabilita o lançamento de Folga porque o estado já está indicado; registros antigos podem ser corrigidos.

## Regras desta branch

| Período | Mínimo mensal por funcionário | Validação semanal |
| --- | --- | --- |
| Até novembro/2026 | 4 DSR | Regras anteriores de sequência e domingos |
| Dezembro/2026 inteiro | 9 DSR, por decisão da empresa | Regra 5×2 a partir de 16/12/2026 |
| Janeiro/2027 em diante | 9 DSR, inclusive fevereiro | Dois DSR por semana de segunda a domingo |

A semana de transição é **14–20/12/2026**: seus descansos anteriores a 16/12 entram na conferência semanal. O código bloqueia lançamentos que consumam as datas necessárias para atingir o mínimo. Enquanto as folgas não forem lançadas ou calculadas como descanso obrigatório, o indicador permanece pendente. Não existe geração automática de uma escala completa.

Todos os cargos têm bloqueio de sete dias consecutivos. O revezamento que impede dois domingos consecutivos aplica-se somente às mulheres, sem exceção por cargo; homens não recebem esse bloqueio. As verificações incluem viradas de mês e ano e inserções retroativas.

**Limite mensal e aprovação no sistema não comprovam conformidade trabalhista.** As metas de 4/9, o tratamento de dezembro inteiro e as exceções antigas são regras do produto. O [guia legal](docs/GUIA_OPERACIONAL_E_LEGAL.md) explica as diferenças, as fontes e o que a aplicação ainda não valida.

### Por que uma data sem aviso pode bloquear Trabalho?

O calendário mostra o ciclo anterior à data. Ao tentar lançar Trabalho, a validação considera também os trabalhos posteriores: preencher um intervalo pode unir duas sequências.

Exemplo da Lara: Trabalho em **16–19/11 e 21–23/11**. Trabalhar também no dia 20 produziria **oito dias seguidos, de 16 a 23**, apesar das folgas em 14 e 24. Se o dia 22 for descanso, trabalhar no dia 20 poderá formar apenas seis dias, de 16 a 21, desde que as demais regras sejam atendidas.

## Acesso e cargos

| Perfil de acesso | Permissões |
| --- | --- |
| Administrador | Consulta a instalação, cadastra/edita funcionários e altera jornadas |
| Gestor | Consulta e altera jornadas das equipes autorizadas; não cadastra funcionários |
| Funcionário (`funcionario`; legado `visualizacao`) | Consulta as equipes autorizadas |

Perfil de acesso e cargo são campos diferentes. O cadastro oferece **Despachante, Supervisor, Coordenador e Analista**, com opção para outros cargos. Funcionários sem equipe ficam disponíveis apenas ao Administrador até receberem uma equipe.

Podem existir vários administradores, cada um com sua própria conta no Supabase Auth e perfil ativo em `public.perfis`. Criar contas, promover Gestor a Administrador e atribuir equipes são operações feitas no Supabase, conforme o guia de configuração.

## Executar localmente

**Requisitos:** projeto Supabase configurado, servidor HTTP local e acesso à CDN do SDK. Node.js é necessário para os testes, não para compilar a aplicação.

1. Siga o [guia de configuração](docs/CONFIGURACAO_SUPABASE.md). Em banco novo, aplique os scripts **001 a 010 na ordem**. Em banco existente com 001–006, aplique somente **007, 008, 009 e depois 010** em homologação antes da produção.
2. Configure a URL e a **chave publicável** em `js/config.js`. Nunca inclua senha de banco ou chave `service_role` no frontend.
3. Crie a conta inicial no Supabase Auth e seu perfil Administrador.
4. Inicie um servidor na raiz:

   ```bash
   python -m http.server 8000
   ```

5. Abra `http://localhost:8000/`, entre e confira cadastro e lançamento diário.

Para GitHub Pages ou outro host estático, siga [Implantação](docs/IMPLANTACAO.md). Configure a URL de redirecionamento no Supabase Auth para recuperação de senha. Mantenha as versões dos arquivos no HTML/imports atualizadas para evitar cache antigo.

## Dados e segurança

```text
Navegador → Supabase Auth → perfil ativo → RLS por equipe → leitura
Alteração → RPC → permissão + versão + regras → gravação + auditoria
```

Funcionários, jornadas e perfis são persistidos no Supabase. Atualizar o frontend conserva os registros quando a configuração aponta para o mesmo projeto. Scripts de migração são aplicados separadamente; faça backup antes de executá-los.

A auditoria fica no banco, sem tela própria nesta versão. Os utilitários legados de CSV/migração permanecem no repositório, sem controles na interface atual.

**Uma empresa por projeto Supabase:** `empresa_id` prepara a estrutura, mas não garante isolamento de vários clientes no mesmo banco. Essa evolução exige revisar políticas RLS, RPCs, chaves e auditoria, além de testes de isolamento.

## Verificação

```bash
npm test
```

A suíte cobre sequências de trabalho, domingos, correções retroativas, DSR mensal/semanal, transição, feriados, contagem sem duplicidade e utilitários legados. As migrações 007/008 também foram testadas em PostgreSQL 17 descartável.

`tests/dsr_mensal.sql` cria tabelas, funções e roles de teste: **execute apenas em banco descartável vazio**. A validação completa de RLS, permissões e concorrência no Supabase de homologação continua necessária, conforme a [matriz](tests/VALIDACAO_SUPABASE.md).

## Estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `index.html`, `css/`, `assets/` | Interface e identidade visual |
| `js/app.js`, `js/calendar-state.js` | Navegação, calendários e edição |
| `js/rules.js` | Dias consecutivos, domingos e avisos |
| `js/schedule-policy.js`, `js/monthly-dsr.js` | Datas de transição e DSR |
| `js/holidays.js`, `js/monthly-summary.js` | Feriados nacionais e totais |
| `js/data.js`, `js/config.js`, `js/settings.js` | Supabase e parâmetros |
| `sql/001_…` a `sql/008_…` | Schema, permissões, auditoria e validações |
| `docs/`, `tests/` | Guias, fontes e testes |

O HTML original com dados de demonstração permanece fora do versionamento.


## Atualização de 25/11/2026 — análise individual e regras uniformes

O calendário fica acima da análise mensal. Cada funcionário tem listas separadas de datas DSR e feriados, com totais próprios e indicação de feriado trabalhado, não trabalhado ou sem lançamento. Nenhuma data de feriado entra em DSR.

Sete dias consecutivos são bloqueados para todos os cargos, inclusive antes da transição 5×2. Dois domingos consecutivos são bloqueados somente para mulheres, sem exceção de cargo. Homens não têm bloqueio de domingos consecutivos. Ambas as verificações cruzam o mês e o ano e consideram lançamentos retroativos.

Em feriado de descanso, o motivo de sete dias ou dois domingos permanece visível, mas o dia é classificado como feriado e soma zero DSR. Ao marcar Folga num feriado, o novo registro é salvo como `feriado`. O estado dos registros antigos é apresentado corretamente sem reescrevê-los.

Aplicar `sql/010_seis_dias_domingos_mulheres.sql` após 009 para alinhar a validação do banco. Esta atualização substitui as descrições anteriores de exceções por cargo. As metas mensais de 4/9 e a data da etapa 5×2 permanecem as já definidas.
