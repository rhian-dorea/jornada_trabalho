# Regras de negócio

Referência desta branch: [Guia operacional e legal](GUIA_OPERACIONAL_E_LEGAL.md) e [DSR mensal/5×2](DSR_5X2.md). As regras abaixo descrevem o código, não uma certificação legal.


- `trabalho` equivale a `T`; `folga` equivale a `F`; `feriado` equivale a `H` (feriado não trabalhado, sem somar DSR). Dia sem lançamento não conta como trabalho.
- Todos os cargos podem trabalhar no máximo seis dias consecutivos; o sétimo é bloqueado. A validação inclui ambos os lados de uma edição e cruza meses e anos.
- Para mulheres, o segundo domingo consecutivo de trabalho é bloqueado em qualquer cargo. Homens não têm bloqueio de domingos consecutivos. O descanso dominical só soma DSR fora de feriado nacional.
- As telas mensal e semanal mostram trabalho, folga e descanso necessário calculado a partir da escala. Dias excepcionais permitidos aparecem em vermelho com o motivo. Nesses dias e nos dias de descanso necessário, o botão Folga fica indisponível; lançamentos de folga anteriores continuam visíveis e podem ser corrigidos pelo fluxo normal. Alterar sexo ou cargo é rejeitado se passar a invalidar jornadas existentes.
- O cadastro usa apenas Supervisor e Coordenador como nomes padrão. Cargos antigos no feminino são exibidos com o nome masculino e o script `005_normalizar_cargos.sql` atualiza os registros existentes no banco.
- Gravação, alteração e remoção passam pelos mesmos gatilhos. Uma folga ou exclusão de lançamento não é contabilizada como trabalho. A auditoria registra correções e remoções.
- Lançamentos simultâneos para o mesmo funcionário são serializados em uma transação. `atualizado_em` detecta conflito quando a versão lida não corresponde mais à versão atual.
- As funções SQL de importação CSV e migração local permanecem disponíveis para procedimentos administrativos, sem controles na interface atual. Cada lote é uma transação única: qualquer violação reverte o lote.
- Funcionário desativado preserva o histórico. Somente administrador pode corrigir lançamento histórico já existente; novos lançamentos exigem reativação.

Essas regras são requisitos operacionais do sistema e não representam, isoladamente, verificação de toda a legislação trabalhista.

## DSR mensal, semanal e feriados

- Mínimo mensal: quatro até novembro/2026; nove desde dezembro/2026 inteiro, inclusive fevereiro. São parâmetros internos definidos pela empresa.
- Desde a semana de transição 14–20/12/2026, a conferência semanal reserva dois DSR; 16/12 é a data de mudança do regime. As semanas começam na segunda-feira e terminam no domingo.
- O contador individual considera Folga ou descanso calculado e conta uma data uma única vez. Feriado não trabalhado não soma DSR. Vazio sem descanso calculado mantém pendência.
- O limite de datas ocupadas por Trabalho/Feriado não trabalhado protege a capacidade de conceder os DSR. Não há fechamento formal do mês nem geração automática de uma escala inteira.
- A apresentação do descanso usa o ciclo anterior à data; validar Trabalho considera também o futuro. Na etapa 5×2, a apresentação também identifica datas que precisam ser reservadas como DSR na semana.
- O total Não trabalhou soma datas distintas de Folga, descanso calculado e Feriado não trabalhado. Motivos sobrepostos não duplicam o total.
- Somente os feriados nacionais são exibidos. O feriado no cabeçalho não altera registros individuais.

As migrações `007_dsr_mensal.sql` e `008_feriado_nao_trabalhado.sql` são necessárias para a proteção no banco e o novo tipo de lançamento. Os [limites de conformidade e fontes oficiais](GUIA_OPERACIONAL_E_LEGAL.md#7-referências-legais-e-alcance) devem ser lidos junto dessas regras.


## Atualização de 25/11/2026 — análise individual e regras uniformes

O calendário fica acima da análise mensal. Cada funcionário tem listas separadas de datas DSR e feriados, com totais próprios e indicação de feriado trabalhado, não trabalhado ou sem lançamento. Nenhuma data de feriado entra em DSR.

Sete dias consecutivos são bloqueados para todos os cargos, inclusive antes da transição 5×2. Dois domingos consecutivos são bloqueados somente para mulheres, sem exceção de cargo. Homens não têm bloqueio de domingos consecutivos. Ambas as verificações cruzam o mês e o ano e consideram lançamentos retroativos.

Em feriado de descanso, o motivo de sete dias ou dois domingos permanece visível, mas o dia é classificado como feriado e soma zero DSR. Ao marcar Folga num feriado, o novo registro é salvo como `feriado`. O estado dos registros antigos é apresentado corretamente sem reescrevê-los.

Aplicar `sql/010_seis_dias_domingos_mulheres.sql` após 009 para alinhar a validação do banco. Esta atualização substitui as descrições anteriores de exceções por cargo. As metas mensais de 4/9 e a data da etapa 5×2 permanecem as já definidas.
