# DSR, transição e feriados — implementação

Para conceitos, exemplos e análise das referências, consulte o [Guia operacional e legal](GUIA_OPERACIONAL_E_LEGAL.md). Este arquivo detalha a política da branch e sua validação.

## Política definida pela empresa

- Até novembro/2026: mínimo de **4 DSR por funcionário no mês**.
- Desde dezembro/2026 inteiro: mínimo de **9 DSR**, inclusive em fevereiro. É uma escolha da empresa, mais exigente que o piso de 8 de um fevereiro de 28 dias usado no exemplo da análise fornecida.
- Desde **16/12/2026**: dois DSR por semana de segunda a domingo. Na transição, a semana 14–20/12 é conferida inteira e seus descansos anteriores a 16/12 entram na conta.
- As regras são individuais e valem também para Supervisor e Coordenador. Na nova etapa não se permite trabalhar sete dias consecutivos. Dois descansos semanais podem ser separados; não são obrigatoriamente sábado e domingo.
- Conta-se uma data por DSR: Folga (`F`) ou descanso automático por dias, domingos ou reserva 5×2, sempre excluindo feriados nacionais. Dois motivos no mesmo dia não duplicam o total. Vazio sem descanso calculado não conta.
- Trabalho e feriado não trabalhado ocupam datas que não poderão ser usadas como DSR. O navegador e o gatilho SQL bloqueiam lançamentos que deixem menos datas disponíveis que o mínimo. Escalas incompletas continuam com indicador de pendência: o sistema não escolhe nem grava folgas automaticamente.

## Feriado e DSR são separados

O calendário exibe apenas os nove feriados nacionais gerais, conforme as Leis 662/1949 (redação da Lei 10.607/2002), 6.802/1980 e 14.759/2023. O dia 20/11 entra como nacional a partir de 2024. A lista destina-se à escala contemporânea; não reconstrói toda a vigência histórica das leis.

Não se incluem feriados estaduais, municipais ou pontos facultativos. Carnaval, Corpus Christi e Sexta-Feira da Paixão não são tratados como feriados nacionais gerais; a Lei 9.093/1995 remete os feriados religiosos à lei municipal. Os feriados adicionais anteriormente armazenados em `empresas.feriados` são preservados no banco, mas não são exibidos nesta modalidade nacional.

| Registro individual | DSR | Dias sem trabalho |
| --- | --- | --- |
| Folga/descanso em dia comum | +1 | +1 |
| Feriado não trabalhado (`H`, banco `feriado`) | +0 | +1 |
| Apenas a marcação do feriado no cabeçalho | +0 | +0 |
| Trabalho em feriado | +0 | +0 |

Exemplo: nove DSR e um feriado não trabalhado em outra data resultam em **9 DSR e 10 dias sem trabalho**. Se um desses nove descansos cair em feriado, serão **8 DSR e 9 dias sem trabalho**; é necessário outro DSR em dia comum. Não se altera a escala de outras pessoas ao marcar o feriado de um funcionário.

## Instalação e validação

1. Em homologação com os scripts 001–006, aplicar `sql/007_dsr_mensal.sql` e `sql/008_feriado_nao_trabalhado.sql`, nessa ordem, antes de usar o novo frontend. Aplicar também `sql/009_feriados_fora_dsr.sql` para excluir feriados da reserva de DSR. O novo tipo mantém os lançamentos `trabalho` e `folga` anteriores.
2. Executar `npm test`. Verificar novembro (4), dezembro inteiro (9), fevereiro (9), semanas que cruzam mês/ano e a semana 14–20/12.
3. Em feriado nacional, marcar Folga para Sarah e Lara e confirmar zero DSR para ambas; descanso por dias ou domingos nessa data também deve somar zero. Remover ou alterar o registro deve recalcular os totais.
4. Conferir os indicadores com zero DSR, mínimo atendido e falta de folgas. A visão semanal mostra DSR semanal; as células vazias restantes tornam-se descanso 5×2 quando os outros cinco dias da semana estão ocupados.
5. `tests/dsr_mensal.sql` é exclusivo para **banco descartável vazio**: cria fixtures de tabelas, funções e roles. Foi executado em PostgreSQL 17 local e encerrado após o teste. Não executar esse arquivo de testes no banco real.

As migrações não foram aplicadas ao Supabase de produção. Escalas antigas não são corrigidas automaticamente; devem ser revisadas. Permissões/RLS e concorrência entre sessões ainda devem ser conferidas na homologação completa.

## Pesquisa legal e limites

O mínimo mensal de quatro/nove e a adoção de nove em dezembro inteiro são políticas solicitadas pelo usuário. Não equivalem, por si só, à validação de toda a legislação ou de uma convenção coletiva. O aplicativo não controla horas, interjornada efetiva ou pagamento em dobro. As exceções antigas de cargo mantidas antes da transição não são uma confirmação de legalidade.

Fontes oficiais consultadas em 24/11/2026:

- [CLT, arts. 66, 67 e 386](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm): intervalos, descanso semanal e revezamento dominical.
- [Lei 605/1949](https://www.planalto.gov.br/ccivil_03/leis/l0605.htm): descanso remunerado e feriados; trabalho em feriados tem disciplina própria de remuneração/compensação.
- [EC 141/2026](https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc141.htm): repouso de dois dias semanais, vigência e hipóteses de compensação.
- [Orientação oficial do MTE de 23/11/2026](https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2026/novembro/governo-federal-publica-portaria-com-regras-complementares-para-aplicacao-da-escala-5x2): início geral em 16/12/2026, limites de horas e condições de negociação coletiva. A notícia não apresenta a coincidência de feriado/DSR como uma regra de soma; a aplicação de cada situação deve considerar a legislação e a categoria.
- [Lei 10.607/2002](https://www2.camara.leg.br/legin/fed/lei/2002/lei-10607-19-dezembro-2002-473572-publicacaooriginal-1-pl.html), [Lei 6.802/1980](https://www.planalto.gov.br/ccivil_03/leis/l6802.htm) e [Lei 14.759/2023](https://normas.leg.br/?urn=urn:lex:br:federal:lei:2023-12-21;14759): feriados nacionais.
- [Lei 9.093/1995](https://www.planalto.gov.br/ccivil_03/leis/l9093.htm): âmbito estadual/municipal e feriados religiosos.


## Atualização de 25/11/2026 — análise individual e regras uniformes

O calendário fica acima da análise mensal. Cada funcionário tem listas separadas de datas DSR e feriados, com totais próprios e indicação de feriado trabalhado, não trabalhado ou sem lançamento. Nenhuma data de feriado entra em DSR.

Sete dias consecutivos são bloqueados para todos os cargos, inclusive antes da transição 5×2. Dois domingos consecutivos são bloqueados somente para mulheres, sem exceção de cargo. Homens não têm bloqueio de domingos consecutivos. Ambas as verificações cruzam o mês e o ano e consideram lançamentos retroativos.

Em feriado de descanso, o motivo de sete dias ou dois domingos permanece visível, mas o dia é classificado como feriado e soma zero DSR. Ao marcar Folga num feriado, o novo registro é salvo como `feriado`. O estado dos registros antigos é apresentado corretamente sem reescrevê-los.

Aplicar `sql/010_seis_dias_domingos_mulheres.sql` após 009 para alinhar a validação do banco. Esta atualização substitui as descrições anteriores de exceções por cargo. As metas mensais de 4/9 e a data da etapa 5×2 permanecem as já definidas.
