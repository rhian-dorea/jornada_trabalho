# Regras de negócio

- `trabalho` equivale a `T`; `folga` equivale a `F`. Dia sem lançamento não conta como trabalho.
- São permitidos até seis dias consecutivos de trabalho. O quinto gera alerta, o sexto é limite visual e o sétimo é rejeitado. O banco verifica todas as janelas de sete dias que cruzam o lançamento, de forma que inserções retroativas e viradas de semana, mês e ano também são cobertas.
- Para funcionário com sexo `F`, dois domingos consecutivos de trabalho são rejeitados. A checagem inclui o domingo anterior e o posterior, inclusive em meses diferentes. A mudança cadastral de `M` para `F` é rejeitada se a escala histórica passar a violar a regra.
- Gravação, alteração e remoção passam pelos mesmos gatilhos. Uma folga ou exclusão de lançamento não é contabilizada como trabalho. A auditoria registra correções e remoções.
- Lançamentos simultâneos para o mesmo funcionário são serializados em uma transação. `atualizado_em` detecta conflito quando a versão lida não corresponde mais à versão atual.
- Importação CSV e migração local são transações únicas: qualquer violação reverte o lote. A interface mostra o erro retornado; corrija a entrada e repita.
- Funcionário desativado preserva o histórico. Somente administrador pode corrigir lançamento histórico já existente; novos lançamentos exigem reativação.

Essas regras são requisitos operacionais do sistema e não representam, isoladamente, verificação de toda a legislação trabalhista.
