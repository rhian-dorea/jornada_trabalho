# Matriz de validação após configurar o Supabase

**Estado:** pendente. URL e chave publicável estão configuradas, mas as RPCs, políticas RLS e contas de teste ainda não foram verificadas em um projeto Supabase real. Execute em projeto de homologação, registrando data e resultado real de cada item. Não use dados de produção.

## Funcional e persistência

1. Administrador cria funcionário sem matrícula, edita nome/cargo/equipe, desativa e reativa. Confirme no Table Editor que o UUID permanece e `jornadas` antigas persistem.
2. Registre trabalho, folga, corrija e remova um lançamento. Confira `auditoria` em cada mudança. Recarregue a página e abra outra sessão autorizada; os dados devem coincidir.
3. Navegue entre mês, semana, virada de mês/ano e Hoje. Clique em Atualizar; abra a aba novamente depois de edição feita por outro usuário.
4. Abra duas sessões com o mesmo registro. Mude em uma e tente salvar a versão antiga na outra: deve surgir conflito, sem sobrescrita.

## Regras e concorrência

1. Lance cinco e seis dias seguidos: os lançamentos aparecem normalmente, sem avisos amarelos. Tente sétimo: rejeição pelo banco.
2. Repita a sequência cruzando o fim de mês e de ano. Tente inserir retroativamente um dia que une blocos e forma sete dias: rejeição.
3. Em funcionária `F`, lance trabalho em domingos consecutivos de meses diferentes, nas duas ordens: segunda operação rejeitada.
4. Em funcionário `M` com domingos consecutivos já lançados, tente mudar sexo para `F`: rejeição e sexo anterior preservado.
5. Em duas sessões de gestores da mesma equipe, tente lançamentos simultâneos em datas diferentes que juntos formariam sete dias: no máximo uma operação deve confirmar.
6. Em Supervisor e Coordenador, lance o sétimo dia seguido e o segundo domingo: as operações devem confirmar e aparecer em vermelho com os motivos. Tente o oitavo dia e o terceiro domingo consecutivo: o banco deve rejeitar.
7. Com sete dias ou dois domingos já lançados em cargo de exceção, tente trocar para cargo comum: a atualização deve ser rejeitada, sem mudar o cadastro. Confira nomes e motivos na visão mensal e no filtro do dia.

## RLS e API direta

1. Sem token, consultas a `funcionarios`, `jornadas`, `perfis` e `auditoria` devem falhar ou retornar vazio.
2. Com token de Visualização, `SELECT` deve mostrar apenas equipes atribuídas; RPCs de alteração devem falhar.
3. Com token de Gestor da Equipe A, consultas e RPCs da Equipe B devem falhar. Gestor não pode editar `perfis`, `perfil_equipes`, `funcionarios` nem `auditoria` diretamente.
4. Com token de usuário sem perfil ou perfil inativo, consultas operacionais e RPCs devem falhar.
5. Tente `POST`/`PATCH` direto nas tabelas, inclusive `jornadas` e `perfis`: deve falhar por grant/RLS. Tente chamar `salvar_funcionario`, `importar_csv` e `migrar_local` com token sem perfil: deve falhar.
6. Confira que a auditoria não pode ser editada/excluída via API.

## CSV e migração (rotinas sem interface)

1. Teste o parser CSV local com arquivo válido, vazio, cabeçalho errado, linha incompleta, data impossível, linha repetida e campo malicioso `=...`. Em projeto de homologação, teste o limite de 5000 linhas da RPC.
2. Via procedimento administrativo autenticado, chame `importar_csv` com uma linha que viola a regra: zero linhas devem ser persistidas. Repita importação válida: sem duplicação. Tente lançamento existente com situação diferente: rejeição.
3. Depois de preservar um backup, chame `migrar_local` com JSON legado v2 e v1 em homologação. Verifique contagens, UUIDs e associação por ID. Repita: zero novos registros. Teste JSON com funcionário sem ID, data inválida, referência ausente e regra violada: rejeição total e origem intacta.
4. Interrompa a rede durante uma chamada administrativa; confira no banco se houve commit antes de repetir. A interface expõe exportação CSV, mas importação e migração exigem procedimento separado.

## Cobertura e navegação do calendário

1. Aplique `006_configuracoes_empresa.sql` em homologação e confira que IDs, jornadas e perfis anteriores foram preservados; todos recebem `empresa_id`.
2. Em homologação, chame `salvar_configuracoes` como administrador para mudar nome, cor, tema e cobertura geral/equipe. Recarregue e confirme persistência. Gestor e visualização não devem conseguir chamar a função via API. A interface não oferece tela de Configurações.
3. Reduza os limites de dias/domingos para um valor incompatível com o histórico: a alteração das regras deve ser revertida integralmente. Teste as viradas de mês e ano.
4. No mês, um dia sem lançamentos deve mostrar somente “—”, sem “Faltam 1”. Com pessoas escaladas abaixo da cobertura configurada, o alerta deve aparecer.
5. Clique numa célula semanal: o modal deve mostrar apenas o funcionário da linha. Clique num dia mensal: o modal deve mostrar todas as pessoas da data. Confira busca, filtros, teclado, Escape e lista semanal no celular.
6. Confira que o lançamento, o calendário e o CSV não exibem turno ou horário de jornada.

Registre evidências do resultado real antes de declarar prontidão para produção.
