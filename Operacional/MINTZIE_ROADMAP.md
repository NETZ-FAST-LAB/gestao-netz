# Roadmap do Mintzie

## Visao

O Mintzie deixa de ser apenas um bot de cobranca e passa a atuar como um parceiro operacional da NETZ em tres papeis fixos:

- cobrador de execucao
- analista de gargalos
- provocador de melhorias

O objetivo e transformar sinais soltos do Discord e do Kanban em acoes concretas que aumentem produtividade, reduzam retrabalho e revelem oportunidades de automacao.

## Resultado esperado

Queremos que o Mintzie ajude a NETZ a:

- converter conversa em tarefa com mais frequencia
- reduzir gargalos recorrentes
- identificar onde esta havendo desperdicio operacional
- sugerir novos agentes e automacoes a partir de padroes reais
- criar mais consistencia entre operacao, projetos e decisoes

## Frentes de atuacao

### 1. Execucao

Mantem e evolui o papel atual de:

- cobrar organizacao do Kanban
- lembrar marcos, checkpoints e fechamentos
- gerar resumos e visibilidade
- puxar a equipe quando ha silencio operacional

### 2. Analise de gargalos

O Mintzie passa a observar:

- canais com muito debate e pouca decisao
- tarefas sem dono
- tarefas vencidas ou paradas
- temas recorrentes no Discord
- retrabalho ou perguntas repetidas
- projetos com pouca atualizacao

Com isso, ele provoca a equipe com mensagens curtas e acionaveis.

### 3. Provocacao de melhorias

O Mintzie passa a sugerir:

- novos agentes
- automacoes pequenas e rapidas
- templates
- SOPs
- ajustes de processo
- cortes de desperdicio

Sempre com base em comportamento observado na semana, e nao em ideias genericas.

## Principios de comportamento

- Uma provocacao por vez. Nada de textao.
- Sempre que possivel, apontar um problema + uma melhoria concreta.
- Priorizar acoes pequenas, de alto retorno e baixa friccao.
- Nao virar um gerador de opiniao vazio. Se provocar, precisa abrir caminho para acao.
- Diferenciar claramente cobranca operacional de sugestao estrategica.

## Rituais propostos

### Provocacao Operacional da Semana

Frequencia:
- segunda-feira, horario comercial

Objetivo:
- abrir a semana com uma melhoria simples e valiosa

Formato:
- mensagem curta
- 1 problema observado
- 1 melhoria sugerida

Exemplo:
- "Provocacao felina da semana: voces repetiram a mesma pergunta operacional varias vezes nos ultimos dias. Esta na hora de um agente de FAQ interna ou de um documento vivo."

### Gargalo da Semana

Frequencia:
- quarta-feira

Objetivo:
- expor onde a operacao esta perdendo energia

Formato:
- gargalo observado
- impacto percebido
- proximo passo sugerido

Exemplo:
- "Gargalo da semana: muita conversa, pouca conversao em tarefa. Escolham um dono para registrar encaminhamentos antes que isso vire nevoa corporativa."

### Ideia de Agente da Semana

Frequencia:
- sexta-feira

Objetivo:
- sugerir um novo agente ou automacao com base em padrao real

Formato:
- comportamento observado
- agente sugerido
- beneficio esperado

Exemplo:
- "Ideia de agente da semana: voces estao resumindo muita conversa na mao. Um agente de ata e proximos passos pouparia neuronios e atrasos."

### Conversa que Precisa Virar Processo

Frequencia:
- quinzenal

Objetivo:
- apontar um fluxo repetido que merece processo, template ou SOP

Formato:
- qual conversa se repetiu
- qual processo esta faltando
- qual artefato resolveria

## Tipos de provocacao que fazem sentido

- "Isso precisa mesmo ser humano?"
- "Essa decisao esta sem dono."
- "Isso merece um template, nao outra thread."
- "Se isso acontece toda semana, ja e processo."
- "Se duas pessoas fazem do proprio jeito, voces ainda nao tem sistema."
- "Vocês estao resolvendo sintoma, nao causa."

## Agentes que o Mintzie pode sugerir

- agente de triagem de demandas
- agente de follow-up comercial
- agente de preparacao de reunioes
- agente de ata e encaminhamentos
- agente de limpeza do Kanban
- agente de consolidacao de aprendizados
- agente de pesquisa e benchmarking
- agente de organizacao de briefings
- agente de priorizacao semanal
- agente de monitoramento de pendencias sem dono

## Fontes de sinal

O Mintzie deve usar, em fases, os seguintes sinais:

- historico do Discord
- tarefas do Kanban
- tarefas sem dono
- tarefas com prazo vencido
- projetos sem atualizacao recente
- repeticao de temas e perguntas
- volume de conversa por canal
- proximidade de marcos importantes

## Roadmap de implementacao

### Fase 1. Provocacoes simples baseadas em regra

Objetivo:
- gerar valor rapido sem depender de analise complexa

Implementar:
- ritual `Provocacao Operacional da Semana`
- ritual `Gargalo da Semana`
- mensagens curtas baseadas em:
  - tarefas sem dono
  - canais com muito volume
  - projetos com tarefas vencidas

Critério de sucesso:
- equipe começa a responder e transformar provocacoes em acoes

### Fase 2. Sugestao estruturada de agentes

Objetivo:
- transformar padroes reais em backlog de automacao

Implementar:
- ritual `Ideia de Agente da Semana`
- template de sugestao com:
  - problema observado
  - agente sugerido
  - ganho esperado
  - prioridade

Critério de sucesso:
- backlog de agentes deixa de ser abstrato e passa a nascer de dor real

### Fase 3. Conversa para processo

Objetivo:
- transformar repeticao em sistema

Implementar:
- ritual `Conversa que Precisa Virar Processo`
- sugestoes de:
  - template
  - checklist
  - SOP
  - documento vivo

Critério de sucesso:
- reducao de retrabalho e menos perguntas repetidas

### Fase 4. Score operacional da semana

Objetivo:
- dar feedback agregado sem burocratizar

Implementar:
- leitura simples de sinais como:
  - tarefas criadas
  - tarefas sem dono
  - pendencias vencidas
  - canais mais ativos
  - projetos mais silenciosos

Saida:
- um mini boletim felino da semana

Critério de sucesso:
- mais visibilidade e menos operacao invisivel

## Backlog inicial recomendado

1. Criar o ritual `Provocacao Operacional da Semana`
2. Criar o ritual `Ideia de Agente da Semana`
3. Adicionar leitura de tarefas sem dono como gatilho de provocacao
4. Adicionar leitura de tarefas vencidas como gatilho de gargalo
5. Criar template padrao de sugestao de agente
6. Criar template padrao de gargalo observado

## Nudges priorizados agora

Vamos seguir por enquanto com estes quatro nudges como proxima frente de evolucao do Mintzie:

1. `Nudge de prazo decorativo`
2. `Nudge de projeto sem atualizacao`
3. `Nudge de follow-up comercial`
4. `Nudge de celebracao util`

### Nudge de prazo decorativo

Gatilho:
- tarefa com data vencida ou prazo muito proximo sem sinal de conclusao

Intencao:
- forcar decisao entre concluir, renegociar ou atualizar prazo

### Nudge de projeto sem atualizacao

Gatilho:
- projeto com muitos dias sem movimento relevante no Kanban ou no Discord

Intencao:
- impedir projeto respirando por aparelhos sem dono assumindo o proximo passo

### Nudge de follow-up comercial

Gatilho:
- proposta, upsell ou pendencia comercial perto do prazo ou sem retorno ha dias

Intencao:
- empurrar follow-up com clareza antes que oportunidade esfrie

### Nudge de celebracao util

Gatilho:
- entrega importante concluida ou marco atingido

Intencao:
- reconhecer o avanco e imediatamente puxar o proximo passo, aprendizado ou sistematizacao

## Mensagens-modelo

### Modelo 1

"Provocacao felina da semana: voces estao debatendo bastante e registrando pouco. Escolham um humano responsavel por transformar decisoes em tarefa antes que tudo vire fumaça corporativa."

### Modelo 2

"Gargalo detectado: ha pendencias demais sem dono claro. Isso nao e backlog; isso e neblina administrativa."

### Modelo 3

"Ideia de agente da semana: um agente de follow-up e resumo de reuniao pouparia tempo e reduziria o classico 'quem ficou com isso mesmo?'."

### Modelo 4

"Conversa que precisa virar processo: briefing desalinhado demais. Isso esta pedindo um template minimo e vergonha coletiva."

## Nota final

O Mintzie deve continuar divertido, mas util. O humor entra para aumentar adesao, nao para esconder falta de clareza. Se ele provocar, a provocacao precisa ajudar a NETZ a agir melhor.
