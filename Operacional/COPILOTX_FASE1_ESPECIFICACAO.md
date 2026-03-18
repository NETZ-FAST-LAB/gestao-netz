# CopilotX Fase 1

## Visão

O CopilotX deixa de ser apenas um painel de leitura e passa a ser a cabine operacional do laboratório maluco da NETZ.

O objetivo da Fase 1 é habilitar três capacidades reais:

- conversar com os agentes e pedir ajuda acionável
- editar o Kanban pela interface
- iniciar a tesouraria conectada ao Banco Inter em modo seguro de leitura

## Objetivos da fase

1. Fazer o dashboard virar ferramenta de operação diária.
2. Reduzir a distância entre conversa, decisão e execução.
3. Permitir que agentes proponham ação e, com confirmação humana, executem no Kanban.
4. Dar visibilidade financeira inicial da meta trimestral a partir da conta PJ.

## Princípios

- Primeiro leitura e edição confiável, depois automação mais ousada.
- Ação de agente sensível sempre passa por confirmação humana.
- Persistência do Kanban deve continuar versionada no GitHub.
- Banco deve começar em modo somente leitura.
- Nada de scraping de internet banking.
- Segurança e rastreabilidade acima de conveniência.

## Escopo da Fase 1

### 1. Centro de Agentes

Criar uma área explícita para conversar com os agentes e pedir ajuda operacional.

#### Objetivo

Permitir três modos de interação:

- `Perguntar`
- `Pedir plano`
- `Mandar agir`

#### Exemplos de uso

- "Picles, organiza essa frente em 5 tarefas."
- "Pipo, redistribui os responsáveis desse experimento."
- "Professor ROI, diga se isso ajuda a bater o reator de receita."
- "Mintzie, transforma essa conversa em próximos passos."

#### Comportamento esperado

- o agente responde em linguagem do laboratório
- quando houver ação operacional, ele devolve uma proposta estruturada
- o usuário revisa
- o usuário confirma
- o backend executa

#### Saída estruturada esperada do agente

- resumo da análise
- ações sugeridas
- impacto esperado
- lista de alterações propostas
- necessidade ou não de confirmação

### 2. Edição real do Kanban

Hoje o CopilotX lê o Kanban, mas não altera.

#### Objetivo

Permitir edição de:

- título da tarefa
- responsável
- status
- data
- contexto da tarefa

#### Ações mínimas da Fase 1

- editar tarefa existente
- criar nova tarefa
- trocar responsável
- alterar status
- alterar data

#### Persistência

As alterações não devem ficar só no container do dashboard.

Elas devem:

- ler o JSON atual do GitHub
- localizar o card e a tarefa
- atualizar o arquivo correto
- commitar via API do GitHub
- refletir no dashboard logo após a resposta

#### Regras importantes

- logar autor da alteração
- exigir payload validado
- evitar escrita cega em arquivo inteiro sem verificação de versão
- retornar diff legível sempre que possível

### 3. Tesouraria com Banco Inter

#### Objetivo

Trazer visibilidade financeira real para dentro do dashboard sem começar por ações irreversíveis.

#### Escopo recomendado da Fase 1

- saldo
- extrato por período
- classificação manual das entradas
- associação opcional da entrada com projeto ou experimento interno
- painel de tesouraria ligado ao reator de receita

#### O que não entra nesta fase

- disparo de Pix
- pagamentos
- automação de saída bancária
- conciliação 100% automática sem revisão humana

## Fluxos de produto

### Fluxo 1. Agente propõe ações

1. Usuário abre o Centro de Agentes.
2. Escolhe um agente.
3. Envia um pedido.
4. O agente responde com análise e plano.
5. Se houver alteração operacional, o agente mostra uma prévia.
6. O usuário confirma.
7. O backend executa no Kanban.
8. O dashboard recarrega os dados.

### Fluxo 2. Edição manual de tarefa

1. Usuário abre uma tarefa.
2. Edita status, responsável ou data.
3. Clica em salvar.
4. O backend grava via GitHub API.
5. A interface confirma o que mudou.

### Fluxo 3. Tesouraria

1. Usuário conecta a integração PJ do Banco Inter.
2. O backend busca saldo e extrato.
3. O sistema apresenta entradas recentes.
4. O usuário classifica ou vincula a receita.
5. O painel atualiza o reator de receita e a tesouraria.

## Arquitetura recomendada

### Frontend

#### Novas áreas

- `Centro de Agentes`
- `Editor de Tarefas`
- `Tesouraria`

#### Componentes sugeridos

- `AgentControlPanel`
- `AgentActionReview`
- `TaskEditorDialog`
- `TaskQuickActions`
- `TreasuryOverview`
- `BankTransactionTable`
- `RevenueAttributionPanel`

### Backend

#### Rotas sugeridas

- `GET /api/dashboard`
- `PATCH /api/tasks/:id`
- `POST /api/tasks`
- `POST /api/agents/chat`
- `POST /api/agents/execute`
- `GET /api/treasury/overview`
- `GET /api/treasury/transactions`
- `POST /api/treasury/classifications`

#### Serviços sugeridos

- `kanbanRepository`
- `kanbanMutationService`
- `agentOrchestrationService`
- `githubPersistenceService`
- `interBankService`
- `treasuryService`

## Integração com GitHub

### Motivo

O Kanban atual vive em JSON no repositório. Então a edição do dashboard precisa respeitar essa fonte de verdade.

### Estratégia

- leitura do JSON atual
- mutação em memória
- validação
- atualização via GitHub API
- commit com mensagem descritiva

### Mensagens de commit sugeridas

- `feat(kanban): cria tarefa via copilotx`
- `fix(kanban): atualiza status de tarefa via copilotx`
- `chore(kanban): reatribui tarefa via copilotx`

## Integração com Banco Inter

### Direção recomendada

Seguir a integração oficial do Inter Empresas.

### Sequência oficial a respeitar

Pelo portal oficial do Inter, o fluxo começa assim:

- login no Internet Banking
- criação de uma nova integração
- seleção das permissões
- ativação das chaves e do certificado
- testes em sandbox antes de produção

### Escopo inicial recomendado no Inter

- `Saldos`
- `Extrato`

### Benefícios diretos para a NETZ

- alimentar a área de tesouraria com dados reais
- acompanhar o reator de receita com menos suposição
- começar a conciliar receita com projetos e experimentos internos

### Cuidados obrigatórios

- armazenar credenciais fora do frontend
- nunca expor certificado no cliente
- usar backend para autenticação e chamadas bancárias
- registrar falhas e auditoria
- separar claramente sandbox e produção

## Variáveis de ambiente sugeridas

### Dashboard

- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`

### IA

- `OPENAI_API_KEY` ou provedor definido
- `AGENT_MODEL`

### Banco Inter

- `INTER_CLIENT_ID`
- `INTER_CLIENT_SECRET`
- `INTER_CERT_PATH`
- `INTER_KEY_PATH`
- `INTER_SCOPE_BALANCE`
- `INTER_SCOPE_STATEMENT`
- `INTER_ENV`

## Segurança

### Agentes

- agente não executa mutação sem confirmação
- toda ação executada registra autor
- toda alteração sensível retorna resumo do que mudou

### Banco

- leitura bancária somente no backend
- credenciais fora do repositório
- segredo em ambiente seguro do EasyPanel
- sem chamada bancária direta do navegador

## UI recomendada

### Centro de Agentes

- lista dos agentes à esquerda
- conversa no centro
- painel lateral com:
  - ações sugeridas
  - impacto esperado
  - botão `Executar proposta`

### Editor de Tarefas

- drawer ou modal rápido
- mudança inline de:
  - responsável
  - status
  - data
- botão de salvar com confirmação visual

### Tesouraria

- card de saldo atual
- receita do trimestre
- tesouraria consumida
- entradas recentes
- vínculo manual com projeto ou experimento interno

## Critérios de sucesso da Fase 1

- usuário consegue editar tarefa sem sair do CopilotX
- agente consegue propor ação operacional estruturada
- usuário consegue confirmar e executar a ação
- dashboard mostra saldo e extrato do Inter em modo leitura
- reator de receita e tesouraria passam a ser alimentados por dado real

## Ordem recomendada de implementação

### Etapa 1

Editar Kanban pelo dashboard.

### Etapa 2

Conectar o Centro de Agentes ao backend com proposta e confirmação.

### Etapa 3

Adicionar tesouraria read-only com saldo e extrato do Banco Inter.

### Etapa 4

Cruzar tesouraria com projetos, experimentos internos e meta trimestral.

## Próximo passo operacional

Iniciar pela Etapa 1.

Sem edição real de tarefa, o CopilotX continua sendo mais painel do que cabine de comando.
