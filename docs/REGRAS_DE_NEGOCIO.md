# Regras de negócio

- `trabalho` equivale a `T`; `folga` equivale a `F`. Dia sem lançamento não conta como trabalho.
- Para os cargos comuns, são permitidos até seis dias consecutivos de trabalho; o sétimo é rejeitado. Para Supervisor/Supervisora e Coordenador/Coordenadora, o sétimo é permitido e aparece em vermelho com o motivo; o oitavo é rejeitado. O banco verifica as janelas que cruzam o lançamento, inclusive em inserções retroativas e viradas de semana, mês e ano.
- Para funcionárias de cargos comuns, dois domingos consecutivos de trabalho são rejeitados. Para Supervisor/Supervisora e Coordenador/Coordenadora, independentemente do sexo, o segundo domingo é permitido e aparece em vermelho com o motivo; o terceiro domingo consecutivo é rejeitado. A checagem considera domingos de meses diferentes e lançamentos retroativos.
- A tela mensal mostra trabalho, folga e quem está impedido de trabalhar pelas regras; funcionários em dia excepcional permitido aparecem em vermelho. Alterar sexo ou cargo é rejeitado se passar a invalidar jornadas existentes.
- Gravação, alteração e remoção passam pelos mesmos gatilhos. Uma folga ou exclusão de lançamento não é contabilizada como trabalho. A auditoria registra correções e remoções.
- Lançamentos simultâneos para o mesmo funcionário são serializados em uma transação. `atualizado_em` detecta conflito quando a versão lida não corresponde mais à versão atual.
- Importação CSV e migração local são transações únicas: qualquer violação reverte o lote. A interface mostra o erro retornado; corrija a entrada e repita.
- Funcionário desativado preserva o histórico. Somente administrador pode corrigir lançamento histórico já existente; novos lançamentos exigem reativação.

Essas regras são requisitos operacionais do sistema e não representam, isoladamente, verificação de toda a legislação trabalhista.
