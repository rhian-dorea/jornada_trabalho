# Regras de negócio

Referência desta branch: [Guia operacional e legal](GUIA_OPERACIONAL_E_LEGAL.md) e [DSR mensal/5×2](DSR_5X2.md). As regras abaixo descrevem o código, não uma certificação legal.


- `trabalho` equivale a `T`; `folga` equivale a `F`; `feriado` equivale a `H` (feriado não trabalhado, sem somar DSR). Dia sem lançamento não conta como trabalho.
- Para os cargos comuns, são permitidos até seis dias consecutivos de trabalho; o sétimo é rejeitado. Antes de 16/12/2026, o código mantém a exceção histórica de Supervisor/Coordenador para o sétimo dia, com aviso; o oitavo é rejeitado. Na nova etapa, sete dias consecutivos são rejeitados para todos. A exceção histórica não é autorização legal por cargo. O banco verifica as janelas que cruzam o lançamento, inclusive em inserções retroativas e viradas de semana, mês e ano.
- Para funcionárias de cargos comuns, dois domingos consecutivos de trabalho são rejeitados. Para Supervisor e Coordenador, independentemente do sexo, o segundo domingo é permitido e aparece em vermelho com o motivo; o terceiro domingo consecutivo é rejeitado. A checagem considera domingos de meses diferentes e lançamentos retroativos.
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
