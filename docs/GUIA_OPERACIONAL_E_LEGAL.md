# Guia de escalas, DSR e feriados

**Controle de Escalas e DSR · versão documental de 25/11/2026**

**Implementação de referência:** branch `codex/dsr-quatro-folgas-mensais`.

Este guia explica a operação do sistema e relaciona seus controles às fontes oficiais consultadas. A configuração da empresa, o comportamento do código e as exigências legais são apresentados separadamente. Não constitui parecer jurídico nem certificação de conformidade de uma escala.

## 1. O que significa cada situação

**DSR** é descanso semanal remunerado. Na aplicação, sua contagem é individual e usa datas distintas de Folga ou descanso obrigatório calculado. Não é uma contagem de feriados nem de todo dia sem lançamento.

| Situação | Registro no banco | Consequência operacional |
| --- | --- | --- |
| Trabalho | `trabalho` | Conta dia de trabalho |
| Folga | `folga` | Em dia comum soma DSR; em feriado soma somente dia sem trabalho |
| Descanso obrigatório | Calculado, sem gravação automática | Conta um DSR; pode desaparecer com a alteração da escala |
| Feriado não trabalhado | `feriado` | Conta um dia sem trabalho, sem DSR adicional |
| Vazio sem descanso calculado | Nenhum | Não confirma trabalho nem DSR |

Um mesmo descanso com motivo de dias consecutivos e de domingos conta **uma vez**, apesar de os dois motivos poderem aparecer no calendário. A contagem usa dias inteiros; a interface não apura as horas efetivas de repouso.

## 2. Calendário e planejamento

O mês mostra todos os nomes em cada grupo de situação. Na semana, cada linha pertence a um funcionário. Ambas as visões começam na segunda-feira e terminam no domingo; no celular, a semana vira uma lista por dia.

O cabeçalho identifica o feriado nacional, mas não altera automaticamente a escala de ninguém. Uma pessoa pode trabalhar nessa data, outra pode ter DSR e outra pode ter feriado não trabalhado. Cada registro deve refletir a situação daquela pessoa.

O resumo mostra DSR realizado/planejado e pendência. “Mínimo atendido” significa que a contagem passou na política mensal do produto; não significa que todas as obrigações trabalhistas foram verificadas.

## 3. Política mensal adotada pela empresa

| Referência | Política implementada |
| --- | --- |
| Até novembro/2026 | Mínimo de 4 DSR por funcionário no mês |
| Dezembro/2026 inteiro | Mínimo de 9 DSR, inclusive antes de 16/12 para a meta mensal |
| Meses seguintes | Mínimo de 9 DSR, inclusive fevereiro |
| A partir de 16/12/2026 | Conferência de dois DSR em cada semana de segunda a domingo |

**Os números fixos 4 e 9 são escolhas internas.** Não se deve apresentar quatro como piso legal suficiente em qualquer mês, nem nove como obrigação mensal universal prevista em lei. O número de descansos juridicamente devido depende da distribuição semanal, do regime aplicável e das condições coletivas.

Na análise de planejamento fornecida, a fórmula `arredondar para cima(dias do mês × 2 ÷ 7)` resulta em 8 para 28 dias e 9 para 29–31 dias. A empresa escolheu um mínimo fixo de nove na nova etapa, mais exigente que esse exemplo em fevereiro de 28 dias. Essa fórmula de planejamento não autoriza concentrar todos os descansos no fim do mês.

### Dezembro e a semana de transição

A meta de nove para dezembro inteiro é uma antecipação interna. A conferência semanal da nova etapa começa na semana **14–20/12/2026**, que contém a data de mudança, e considera os descansos dessa semana inteira. Essa convenção de calendário do produto não é um cálculo legal universal de proporcionalidade de dezembro.

Novos lançamentos não podem consumir as datas necessárias para completar o mínimo mensal ou semanal. As datas vazias ainda não identificadas como descanso mantêm o indicador pendente. A aplicação não distribui uma escala completa nem oferece um fechamento formal de mês.

## 4. Por que uma tentativa de Trabalho é bloqueada

Há duas perguntas diferentes no código:

1. **O que mostrar na data?** O calendário considera o ciclo anterior e, na etapa 5×2, as datas que precisam ficar reservadas como DSR na semana.
2. **O que aconteceria ao trabalhar nessa data?** A validação considera os trabalhos anteriores e posteriores. Preencher um intervalo pode unir dois blocos.

### Exemplo: Lara em 20/11/2026

| Datas | Situação |
| --- | --- |
| 14/11 | Folga |
| 15/11 | Sem trabalho |
| 16–19/11 | Trabalho: quatro dias |
| 20/11 | Data que se pretende alterar para Trabalho |
| 21–23/11 | Trabalho: três dias |
| 24/11 | Folga |

Com Trabalho no dia 20, o intervalo **16–23/11 teria oito dias consecutivos**. A folga do dia 14 interrompe a sequência anterior; a do dia 24 ocorre depois desses oito dias. Se o dia 22 também virar descanso, trabalhar no dia 20 poderá formar seis dias, de 16 a 21, sujeito às demais regras.

Um feriado no cabeçalho não interrompe a sequência quando existe Trabalho gravado. Uma Folga, um Feriado não trabalhado ou uma data sem Trabalho interrompem a contagem de dias trabalhados. Um vazio que impede uma sequência não é, por esse motivo sozinho, confirmação de DSR efetivamente concedido.

## 5. DSR e feriado: exemplos de contagem

| Escala individual | Total de DSR | Dias sem trabalho confirmados/calculados |
| --- | ---: | ---: |
| Nove DSR, sem outro afastamento | 9 | 9 |
| Um feriado coincide com um dos nove descansos | 8 | 9 |
| Nove DSR e outro dia registrado como Feriado não trabalhado | 9 | 10 |
| Nove DSR e Trabalho no feriado | 9 | 9 |

Na marcação diária, use Trabalho, Folga ou Remover. Folga em feriado nacional será exibida como feriado não trabalhado e soma zero DSR. O mesmo vale para descanso por dias seguidos ou domingos nessa data. Esta política interna substitui a regra anterior de coincidência: nenhum feriado entra no contador.

A distinção acima descreve a classificação operacional definida para o sistema. A remuneração ou compensação de trabalho em feriado é matéria própria: a Lei 605/1949, art. 9º, disciplina pagamento em dobro ou outra folga nas hipóteses ali previstas. A aplicação não calcula folha nem quita essas obrigações. [Lei 605/1949](https://www.planalto.gov.br/ccivil_03/leis/l0605.htm).

## 6. Feriados nacionais exibidos

| Data | Feriado | Fundamento |
| --- | --- | --- |
| 01/01 | Confraternização Universal | Lei 662/1949, redação atual |
| 21/04 | Tiradentes | Lei 662/1949, redação atual |
| 01/05 | Dia do Trabalho | Lei 662/1949, redação atual |
| 07/09 | Independência do Brasil | Lei 662/1949, redação atual |
| 12/10 | Nossa Senhora Aparecida | Lei 6.802/1980 |
| 02/11 | Finados | Lei 662/1949, redação atual |
| 15/11 | Proclamação da República | Lei 662/1949, redação atual |
| 20/11 | Dia Nacional de Zumbi e da Consciência Negra | Lei 14.759/2023; calendário nacional desde 2024 |
| 25/12 | Natal | Lei 662/1949, redação atual |

Fontes: [Lei 662/1949](https://www.planalto.gov.br/ccivil_03/leis/l0662.htm), [Lei 6.802/1980](https://www.planalto.gov.br/ccivil_03/leis/l6802.htm) e [Lei 14.759/2023](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14759.htm).

Por escolha de escopo, esta versão não mostra feriados estaduais ou municipais. Carnaval, Corpus Christi e Sexta-Feira da Paixão não são incluídos como feriados nacionais gerais. Isso não significa que uma empresa possa desconsiderar feriados válidos na sua localidade: a Lei 9.093/1995 contempla a data magna estadual e os feriados religiosos declarados por lei municipal. [Lei 9.093/1995, arts. 1º e 2º](https://www.planalto.gov.br/ccivil_03/leis/l9093.htm).

## 7. Referências legais e alcance

As fontes foram consultadas em **25/11/2026**. Os parágrafos seguintes são sínteses, não transcrições integrais.

### Descanso e intervalo entre jornadas

Os arts. 66 e 67 da CLT tratam, respectivamente, do intervalo mínimo de 11 horas entre jornadas e do repouso semanal de 24 horas. A aplicação atual usa datas e não permite cadastrar os horários efetivos: por isso, não comprova a duração desses intervalos. [CLT](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm).

A Lei 605/1949 trata do descanso semanal remunerado e dos feriados. A quantidade mensal isolada não substitui a verificação do repouso semanal. [Lei 605/1949, art. 1º](https://www.planalto.gov.br/ccivil_03/leis/l0605.htm).

O Tema 265 do TST reafirma que conceder o repouso após o sétimo dia consecutivo de trabalho viola a garantia constitucional e implica pagamento em dobro. As exceções antigas por cargo foram removidas; o título de Supervisor ou Coordenador **não é autorização legal genérica** para sete dias seguidos. [TST, Tema 265](https://www.tst.jus.br/documents/d/guest/irr265-2-pdf).

### Transição para dois repousos semanais

A EC 141/2026 prevê dois dias de repouso semanal, um preferencialmente aos domingos, e contém condições de vigência e de compensação coletiva. A referência geral de início da nova obrigação é 16/12/2026; situações especiais devem ser avaliadas pelos dispositivos aplicáveis, não apenas pela data do produto. [EC 141/2026, arts. 1º e 10](https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc141.htm).

A orientação oficial do MTE de 23/11/2026 informa dois repousos semanais e limite geral de 42 horas a partir de 16/12/2026, com redução para 40 horas em 16/12/2027. Também descreve condições para compensação coletiva e regimes especiais. O aplicativo implementa conferência de datas; não apura horas nem presume a existência de acordo coletivo. [Orientação do MTE](https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2026/novembro/governo-federal-publica-portaria-com-regras-complementares-para-aplicacao-da-escala-5x2).

### Domingos e atividade econômica

O art. 386 da CLT trata do revezamento quinzenal para favorecer o repouso dominical das empregadas. Essa regra não deve ser substituída apenas pela soma de domingos não trabalhados no mês. [CLT, art. 386](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm).

No comércio, os arts. 6º e 6º-A da Lei 10.101/2000 tratam do trabalho em domingos e feriados, incluindo condições relativas à legislação municipal e à negociação coletiva. O aplicativo não identifica o enquadramento sindical nem verifica a autorização de funcionamento. [Lei 10.101/2000](https://www.planalto.gov.br/ccivil_03/leis/l10101compilado.htm).

### O que o sistema não certifica

Não são apurados: horas efetivas, intervalos por horário, remuneração, compensações, convenção coletiva, enquadramento da atividade, férias, afastamentos ou feriados locais. Uma escala sem bloqueio ainda exige revisão dessas condições. As permissões históricas por cargo e as metas mensais não devem ser apresentadas ao cliente como validação jurídica universal.

## 8. Implantação e rastreabilidade

Com 001–006 já aplicados, executar **007, 008, 009 e depois 010** em homologação antes de publicar o frontend desta branch. Depois, aplicar `009_feriados_fora_dsr.sql` para a exclusão dos feriados de DSR. A primeira migração adiciona os limites DSR/5×2; a segunda permite Feriado não trabalhado e mantém Trabalho/Folga. Nenhuma delas reescreve jornadas existentes.

O planejamento ocorre no navegador, mas o banco aplica a validação definitiva. RPCs conferem acesso e versão do registro; os gatilhos verificam regras e registram auditoria. Uma gravação recusada não é confirmada.

| Regra | Arquivo principal |
| --- | --- |
| Data de transição e meta mensal | `js/schedule-policy.js` |
| DSR mensal e semanal | `js/monthly-dsr.js` |
| Sequências e domingos | `js/rules.js` |
| Datas nacionais | `js/holidays.js` |
| Totais de dias sem trabalho | `js/monthly-summary.js` |
| Proteção no PostgreSQL | `sql/007_dsr_mensal.sql` e `sql/008_feriado_nao_trabalhado.sql` |

Para validar a aplicação, seguir [DSR e testes da transição](DSR_5X2.md), [Configuração do Supabase](CONFIGURACAO_SUPABASE.md) e [matriz de homologação](../tests/VALIDACAO_SUPABASE.md). O arquivo `tests/dsr_mensal.sql` cria fixtures e só deve ser usado em banco descartável vazio.


## Atualização de 25/11/2026 — análise individual e regras uniformes

O calendário fica acima da análise mensal. Cada funcionário tem listas separadas de datas DSR e feriados, com totais próprios e indicação de feriado trabalhado, não trabalhado ou sem lançamento. Nenhuma data de feriado entra em DSR.

Sete dias consecutivos são bloqueados para todos os cargos, inclusive antes da transição 5×2. Dois domingos consecutivos são bloqueados somente para mulheres, sem exceção de cargo. Homens não têm bloqueio de domingos consecutivos. Ambas as verificações cruzam o mês e o ano e consideram lançamentos retroativos.

Em feriado de descanso, o motivo de sete dias ou dois domingos permanece visível, mas o dia é classificado como feriado e soma zero DSR. Ao marcar Folga num feriado, o novo registro é salvo como `feriado`. O estado dos registros antigos é apresentado corretamente sem reescrevê-los.

Aplicar `sql/010_seis_dias_domingos_mulheres.sql` após 009 para alinhar a validação do banco. Esta atualização substitui as descrições anteriores de exceções por cargo. As metas mensais de 4/9 e a data da etapa 5×2 permanecem as já definidas.
