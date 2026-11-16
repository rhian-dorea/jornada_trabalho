# Regras de negócio

- `trabalho` equivale a `T`; `folga` equivale a `F`. Dia sem lançamento não conta como trabalho.
- Para os cargos comuns, são permitidos até seis dias consecutivos de trabalho; o sétimo é rejeitado. Para Supervisor e Coordenador, o sétimo é permitido e aparece em vermelho com o motivo; o oitavo é rejeitado. O banco verifica as janelas que cruzam o lançamento, inclusive em inserções retroativas e viradas de semana, mês e ano.
- Para funcionárias de cargos comuns, dois domingos consecutivos de trabalho são rejeitados. Para Supervisor e Coordenador, independentemente do sexo, o segundo domingo é permitido e aparece em vermelho com o motivo; o terceiro domingo consecutivo é rejeitado. A checagem considera domingos de meses diferentes e lançamentos retroativos.
- As telas mensal e semanal mostram trabalho, folga e descanso necessário calculado a partir da escala. Dias excepcionais permitidos aparecem em vermelho com o motivo. Nesses dias e nos dias de descanso necessário, o botão Folga fica indisponível; lançamentos de folga anteriores continuam visíveis e podem ser corrigidos pelo fluxo normal. Alterar sexo ou cargo é rejeitado se passar a invalidar jornadas existentes.
- O cadastro usa apenas Supervisor e Coordenador como nomes padrão. Cargos antigos no feminino são exibidos com o nome masculino e o script `005_normalizar_cargos.sql` atualiza os registros existentes no banco.
- Gravação, alteração e remoção passam pelos mesmos gatilhos. Uma folga ou exclusão de lançamento não é contabilizada como trabalho. A auditoria registra correções e remoções.
- Lançamentos simultâneos para o mesmo funcionário são serializados em uma transação. `atualizado_em` detecta conflito quando a versão lida não corresponde mais à versão atual.
- Importação CSV e migração local são transações únicas: qualquer violação reverte o lote. A interface mostra o erro retornado; corrija a entrada e repita.
- Funcionário desativado preserva o histórico. Somente administrador pode corrigir lançamento histórico já existente; novos lançamentos exigem reativação.

Essas regras são requisitos operacionais do sistema e não representam, isoladamente, verificação de toda a legislação trabalhista.
