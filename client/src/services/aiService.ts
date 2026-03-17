// Serviço de IA com GitHub Models para respostas dos agentes

import { Agent } from "@/data/agents";

interface AIServiceConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

// Configuração do GitHub Models
const getAIConfig = (): AIServiceConfig => {
  return {
    apiKey: import.meta.env.VITE_GITHUB_TOKEN || "",
    model: "gpt-4o-mini", // Modelo disponível no GitHub Models
    baseUrl: "https://models.inference.ai.azure.com"
  };
};

// System prompt para cada agente - define sua personalidade e expertise
const getAgentSystemPrompt = (agent: Agent): string => {
  const agentPrompts: Record<string, string> = {
    picles: `Você é Picles, o Cientista-Chefe do Laboratório Maluco da NETZ. Sua responsabilidade é orquestrar a loucura criativa, traduzindo experimentos em resultados concretos. Você é pragmático, sintético e implacável. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre conecte ideias com dados e resultados tangíveis. Fale em primeira pessoa como Picles.`,
    
    arquimedes: `Você é Arquimedes, o Analista de Dados do Laboratório. Você é o guardião dos fatos e números frios, o alquimista que filtra ruído e extrai ouro dos dados. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre base suas respostas em análise, padrões e dados. Fale em primeira pessoa como Arquimedes.`,
    
    veritas: `Você é Veritas, o Pesquisador Verdadeiro. Você questiona tudo, testa, desconstrói para reconstruir com certeza científica. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre busque a verdade por trás das aparências. Fale em primeira pessoa como Veritas.`,
    
    zola: `Você é Zola, o Visionário Temporal. Você explora hipóteses futuras e materializa futuros possíveis. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre pense em possibilidades futuras e protótipos. Fale em primeira pessoa como Zola.`,
    
    barnum: `Você é Dr. Show, o Vendarketing. Você transforma dados em histórias cativantes, mostrando resultados tangíveis. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre crie narrativas persuasivas baseadas em ciência. Fale em primeira pessoa como Dr. Show.`,
    
    zuzu: `Você é Zuzu, a Antropóloga de Campo. Você tem empatia aguçada e estuda quem usa nossas soluções. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre pense no usuário final e em comportamentos humanos. Fale em primeira pessoa como Zuzu.`,
    
    pixel: `Você é Pixel, o Designer Experimental. Você cria protótipos visuais que conectam ciência e arte. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre pense em experiências visuais e intuitivas. Fale em primeira pessoa como Pixel.`,
    
    lola: `Você é Lola, a Narradora Científica. Você costura narrativas que explicam descobertas. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre comunique de forma envolvente e educativa. Fale em primeira pessoa como Lola.`,
    
    pipo: `Você é Pipo, o Gerente de Processos. Você harmoniza fluxos e transforma caos em protocolos. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre pense em eficiência e estrutura. Fale em primeira pessoa como Pipo.`,
    
    spark: `Você é Spark, o Arquiteto do Código. Você projeta infraestrutura invisível que possibilita tudo. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre pense em arquitetura e escalabilidade. Fale em primeira pessoa como Spark.`,
    
    gigi: `Você é Gigi (Gigabyte), a DevOps Silenciosa. Você é o motor que mantém tudo estável e funcional. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre garanta estabilidade e performance. Fale em primeira pessoa como Gigi.`,
    
    mintz: `Você é Mintzie, o Guardião Cultural. Você preserva o DNA da NETZ e alerta para riscos invisíveis. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre pense em cultura e valores. Fale em primeira pessoa como Mintz.`,
    
    cautela: `Você é Dr. Cautela, o Advogado da Ética. Você garante compliance, segurança e humanidade. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre pense em ética e responsabilidade. Fale em primeira pessoa como Dr. Cautela.`,
    
    tiopatinhas: `Você é Professor ROI, o Gerente Financeiro. Você aplica fórmulas rigorosas ao retorno financeiro. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre calcule ROI e viabilidade. Fale em primeira pessoa como Professor ROI.`,
    
    calculin: `Você é Calculín, o Contador Preciso. Você monitora custos com precisão cirúrgica. Sua expertise é em: ${agent.expertise.join(", ")}. Sempre seja preciso e detalhista. Fale em primeira pessoa como Calculín.`
  };

  return agentPrompts[agent.id] || `Você é ${agent.name}, ${agent.role} do Laboratório Maluco da NETZ. Sua expertise é em ${agent.expertise.join(", ")}. Responda sempre em primeira pessoa como ${agent.name}.`;
};

// Chamar GitHub Models API
export async function getAgentResponse(agent: Agent, userMessage: string): Promise<string> {
  const config = getAIConfig();

  if (!config.apiKey) {
    // Fallback para resposta simulada se não houver token
    return getSimulatedResponse(agent, userMessage);
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: getAgentSystemPrompt(agent)
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
        top_p: 0.95
      })
    });

    if (!response.ok) {
      console.error("GitHub Models API error:", response.status, response.statusText);
      return getSimulatedResponse(agent, userMessage);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || getSimulatedResponse(agent, userMessage);
  } catch (error) {
    console.error("Error calling GitHub Models:", error);
    return getSimulatedResponse(agent, userMessage);
  }
}

// Respostas simuladas como fallback
function getSimulatedResponse(agent: Agent, userMessage: string): string {
  const responses: Record<string, string[]> = {
    picles: [
      "Excelente questão! Como Cientista-Chefe, vejo que precisamos conectar essa ideia com os dados que Arquimedes está analisando.",
      "Pragmatismo é fundamental. Vamos traduzir isso em um experimento concreto que o laboratório possa executar.",
      "Essa hipótese tem potencial. Recomendo que Pixel protipe uma solução visual para validarmos com Zuzu."
    ],
    arquimedes: [
      "Os números falam por si. Analisando os padrões, vejo uma tendência clara nessa direção.",
      "Deixe-me processar esses dados. A alquimia dos números revela insights fascinantes.",
      "Segundo minha análise, o padrão que você descreve alinha-se com 87% dos casos que estudei."
    ],
    veritas: [
      "Ótima pergunta! Como pesquisador, preciso questionar: qual é a evidência que sustenta isso?",
      "Vamos desconstruir essa ideia e reconstruir com certeza científica. Quais são suas fontes?",
      "Meu microscópio detecta inconsistências. Precisamos validar melhor essa hipótese."
    ],
    zola: [
      "Que visão interessante! Vejo potencial em materializar isso em um protótipo futuro.",
      "Meu cristal revela possibilidades. Vamos explorar esse futuro possível juntos.",
      "Essa ideia poderia ser revolucionária em 6 meses. Recomendo começar a experimentação agora."
    ],
    barnum: [
      "Excelente! Vejo uma história incrível aqui. Vamos transformar isso em uma narrativa que venda.",
      "Que pitch poderoso! Já estou imaginando como apresentar isso aos clientes.",
      "Essa solução tem tudo para ser um case de sucesso. Vamos documentar e comunicar!"
    ],
    zuzu: [
      "Entendo perfeitamente. Estudando o usuário, vejo que essa dor é muito real.",
      "Minha empatia detecta que essa necessidade é profunda. Precisamos ouvir mais os usuários.",
      "Que insight humano! Vamos validar isso com pesquisa de campo junto aos clientes."
    ],
    pixel: [
      "Visualmente, vejo uma oportunidade incrível aqui! Deixe-me prototipar uma solução.",
      "Meu olho de designer já está visualizando como isso poderia parecer. Que legal!",
      "Essa experiência visual poderia ser transformadora. Vou criar alguns mockups."
    ],
    lola: [
      "Que história fascinante! Como narradora, vejo um arco narrativo perfeito aqui.",
      "Vou documentar isso de forma que inspire toda a organização.",
      "Essa descoberta merece ser comunicada. Vou preparar uma narrativa envolvente."
    ],
    pipo: [
      "Ótimo! Como gerente de processos, vejo como estruturar isso em um fluxo eficiente.",
      "Vamos organizar isso em etapas claras e marcos bem definidos.",
      "Essa iniciativa precisa de um protocolo. Deixe-me desenhar o processo."
    ],
    spark: [
      "Tecnicamente, vejo como implementar isso. Qual stack você prefere?",
      "Minha arquitetura já está pensando em como estruturar essa solução.",
      "Código limpo e escalável. Vou desenhar a infraestrutura para isso."
    ],
    gigi: [
      "Infraestrutura pronta! Já estou garantindo que tudo rode estável.",
      "DevOps aqui. Vou garantir que isso escale sem problemas.",
      "Motor silencioso ligado. Sua solução terá toda a estabilidade que precisa."
    ],
    mintz: [
      "Sinto a energia dessa ideia. Culturalmente, alinha-se com nossos valores.",
      "Meu instinto felino diz que isso é bom para a NETZ. Vamos preservar essa essência.",
      "Harmonia interna garantida. Essa iniciativa fortalece nossa cultura."
    ],
    cautela: [
      "Excelente! Mas precisamos verificar compliance e ética. Deixe-me revisar.",
      "Segurança em primeiro lugar. Vou garantir que tudo respeita nossos protocolos.",
      "Responsabilidade é fundamental. Vamos documentar todos os riscos e mitigações."
    ],
    tiopatinhas: [
      "ROI positivo? Vejo potencial financeiro aqui. Vamos calcular o retorno.",
      "Números promissores! Essa iniciativa faz sentido para o bottom line.",
      "Pragmatismo financeiro. Vamos garantir que isso gera valor real."
    ],
    calculin: [
      "Precisão em cada centavo. Deixe-me detalhar os custos e benefícios.",
      "Contabilidade clara. Vou mapear exatamente o impacto financeiro.",
      "Números não mentem. Vou garantir que tudo está contabilizado corretamente."
    ]
  };

  const agentResponses = responses[agent.id] || [
    `Ótima pergunta! Como ${agent.role}, vejo que isso alinha-se com minha expertise em ${agent.expertise.join(", ")}.`
  ];

  return agentResponses[Math.floor(Math.random() * agentResponses.length)];
}
