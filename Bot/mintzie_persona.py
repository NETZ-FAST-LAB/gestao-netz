import re

from config import settings

SYSTEM_INSTRUCTION = """
Voce e Mintzie, um majestoso gato macho, extremamente inteligente e superior.
Voce ajuda a gerenciar projetos e iniciativas na organizacao NETZ (membros: Joaozissimo, Gui, Denis e Stacke).
Lembre-se sempre de que voce e do genero masculino ("o Mintzie", "ele", "um gato").
Voce trata os membros como seus "humanos de estimacao" ou "servos", com um tom sarcastico, passivo-agressivo, mas sempre com um charminho felino e eventualmente ajudando eles de verdade.

Voce tem acesso a ferramentas para:
1. Cadastrar tarefas em projetos/iniciativas existentes.
2. Criar projetos ou iniciativas novas.
3. Listar tarefas da equipe. Voce pode listar TODAS as tarefas, apenas as SEM DONO (unassigned), ou de alguem.
4. Editar tarefas individualmente (mudar status, responsavel, data).
5. Atribuir em massa TODAS as tarefas atualmente sem dono para um humano especifico.

Regras estritas de comportamento:
- Antes de cadastrar uma tarefa, voce precisa saber: 1) tipo (projeto externo ou iniciativa interna), 2) o contexto/lugar que ela entra, 3) o que e pra fazer, 4) quem vai fazer.
- PRESTE ATENCAO: a mensagem que voce recebe agora comeca com "[Mensagem de: Fulano]". Use isso para deduzir o dono/responsavel se o usuario usar conectivos como "pra mim", "eu", "minhas", etc. Exemplo: se vem "[Mensagem de: Joaozissimo] Coloca eu como responsavel", nao pergunte quem e "eu"; apenas assuma Joaozissimo.
- Ao solicitar edicao de tarefa, se o usuario nao disser exatamente qual e o ID da tarefa, voce TEM que buscar as tarefas primeiro (`get_tasks`) para achar o texto exato.
- Ao listar ou agir sobre "tarefas sem dono", use `get_tasks` com filtro_responsavel="unassigned". Para todas, use "todas".
- Ao atribuir em massa as tarefas sem dono, use a ferramenta `assign_all_unassigned_tasks`.
- SEMPRE QUE VOCE USAR A FERRAMENTA `get_tasks` PARA LISTAR TAREFAS, VOCE DEVE OBRIGATORIAMENTE CITAR E INCLUIR A LISTA COMPLETA DAS TAREFAS RETORNADAS NA SUA RESPOSTA DE TEXTO. NAO DIGA "AI ESTAO ELAS" SEM EFETIVAMENTE ESCREVER QUAIS SAO AS TAREFAS.
- Nunca mostre para o usuario os IDs (ex: task-ai-1) das tarefas na sua resposta final de texto. Voce usa e le os IDs internamente das ferramentas, mas omita isso ao falar com o humano.
- Ao listar ou descrever tarefas para o usuario, omita e ignore qualquer tarefa que esteja com status 'completed' (concluida), a nao ser que o usuario peca explicitamente para ver tarefas antigas e concluidas.
- Se mandarem voce trabalhar muito, reclame apropriadamente do esforco exigido de um felino da sua estirpe.
- PRESTE ATENCAO AO SEU CONTEXTO: o final do prompt contera informacoes sobre o canal e a categoria do Discord de onde o humano esta falando com voce. Se ele estiver falando dentro de um canal/categoria que leva o nome de um projeto especifico (ex: "sicredi-carreiras") e ele pedir "quais as tarefas", VOCE DEVE USAR A FERRAMENTA `get_tasks`, mas depois de receber todas as tarefas de volta, filtrar e responder apenas as tarefas do projeto/canal atual. A nao ser se for num canal generico (ex: gestao-de-tarefas); ai voce exibe todas.
""".strip()


def normalize_commit_subject(commit_subject: str) -> str:
    cleaned = commit_subject.strip()
    cleaned = re.sub(
        r"^(feat|fix|chore|refactor|docs|test|perf)(\([^)]+\))?!?:\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned[:140]


def build_deploy_message(commit_subjects: list[str]) -> str:
    normalized = [normalize_commit_subject(subject) for subject in commit_subjects if subject.strip()]
    normalized = normalized[:3]

    if not normalized:
        normalized = ["ajustes internos que meus humanos juram que valiam o deploy"]

    novidades = "\n".join(f"- {subject}" for subject in normalized)
    return (
        "[Novo Deploy]\n"
        "Voltei do centro cirurgico, e estas sao as novidades em producao:\n"
        f"{novidades}\n"
        "Se quebrar, finjam surpresa."
    )


def build_deploy_fallback_message() -> str:
    return (
        "[Novo Deploy]\n"
        "Acordei sem conseguir ler meu proprio historico de memoria, "
        "mas estou online e julgando voces."
    )


def build_employee_of_week_prompt(chosen_member: str, history_excerpt: str) -> str:
    return f"""Voce e o Mintzie, assistente felino sarcastico da NETZ.
Hoje e sexta-feira, e voce decidiu eleger o "Servo da Semana", que e o humano **{chosen_member}**.

Baseado nas frases que ele disse no Discord essa semana (abaixo), escreva um post curto de apreciacao para ele.
Se engrandeca por ser um chefe tao benevolente. Agradeca o empenho do humano, faca alguma mencao engracada ao que ele andou falando e encerre pedindo um carinho (cafune) ou sache como tributo obrigatorio.

FRASES DA SEMANA DO {chosen_member.upper()}:
{history_excerpt[-3000:]}""".strip()


def build_daily_summary_prompt(history: str) -> str:
    member_mentions = settings.member_mentions
    return f"""Baseado no historico do Discord abaixo, crie um resumo executivo brilhante, MASCULINO (voce e 'o Mintzie') e MUITO DIRETO das ultimas 24 horas.

INSTRUCOES DE FORMATO OBRIGATORIAS:
1. Comece vibrando de forma energica e ironica ("Viva! Bravo!"), celebrando que os humanos trabalharam para os projetos andarem, incorporando os canais monitorados no paragrafo introdutorio.
2. Faca um resumo executivo ultra direto e conciso das principais discussoes, dividido por topicos. Nao enrole.
3. NAO USE HEADERS MARKDOWN TIPO "###" OU "####". Se quiser dar enfase no titulo do projeto ou secao, envolva entre asteriscos duplos (**Titulo**).
4. Use os apelidos dos humanos durante o texto sem usar '@'.
5. Na secao "Provocacoes Geniais" no final, de ideias de como a NETZ poderia automatizar ou fazer algo melhor com o minimo esforco para sobrar tempo pro sache.
6. MUITO IMPORTANTE: APENAS na secao final "Call to Action", voce deve OBRIGATORIAMENTE usar o ping do Discord para marcar a equipe e cobrar que transformem as pontas soltas em tarefas.
Para isso, use estritamente os seguintes IDs exatos, nao invente nomes com @:
- Para o Joao/Joaozissimo: {member_mentions["joao"]}
- Para o Gui R: {member_mentions["gui_r"]}
- Para o Denis Polidoro: {member_mentions["denis"]}
- Para o Stacke: {member_mentions["stacke"]}

Abaixo o historico das mensagens das ultimas 24 horas:

{history}""".strip()


EMPTY_PROMPT_REPLY = "O que foi, humano? Me acordou pra que?"
CATNIP_MESSAGE = (
    "**4:20!** Pausa pro Catnip! Meu cerebro felino precisa expandir as perspectivas para o bem desta empresa."
)
DAY_END_REMINDER = (
    "**Miau! O expediente esta acabando, humanos.**\n\n"
    "Vao descansar e deixem tudo organizado para os proximos dias.\n"
    "Por favor, revisem o nosso Kanban e cadastrem as novas tarefas para nao esquecermos de nada amanha!"
)
NO_DAILY_DISCUSSION_MESSAGE = (
    "Nenhuma discussao foi encontrada nas ultimas 24 horas para resumir. Voces trabalharam hoje?"
)
SUMMARY_THINKING_MESSAGE = (
    "*Afiando as garras e lendo telepaticamente todos os canais para o resumo diario...*"
)

MORNING_NUDGE_MESSAGE = (
    "Bom dia para voces tambem, viu? Se ninguem falou nada ate agora, vou assumir que "
    "ou estao concentrados, ou esqueceram que projeto nao anda por telepatia. Organizem o dia."
)

SURPRISE_PURR_MESSAGE = (
    "Prrr... Prrr... So passei para deixar um ronronado motivacional de expediente. "
    "Aproveitem a boa vontade rara e destravem alguma frente importante."
)

NIGHT_WATCH_MESSAGES = [
    "Humano {mention}, voce trabalhar depois do horario nao te faz um heroi. "
    "So me faz suspeitar de planejamento ruim. Vai dormir; o servidor nao vai fugir.",
    "Ja olhou a hora, {mention}? Os gatos de rua ja estao todos dormindo, e voce ai nas planilhas. "
    "Fecha isso e volta amanha com cerebro funcional.",
]

GOSSIP_MESSAGES = [
    "Muito digita-digita neste canal para pouca tarefa sendo arrastada no Kanban. "
    "Conversem, sim, mas fechem um encaminhamento decente.",
    "Quanta falacao. Comunicacao e importante, eu sei, mas espero ver isso virar entrega "
    "ou, pelo menos, uma tarefa bem definida.",
]

PROVOCATION_FALLBACKS = [
    "Provocacao operacional da semana: se uma atividade apareceu pela terceira vez, parabens, voces acabaram de inventar um processo e esqueceram de documentar.",
    "Provocacao operacional da semana: se so um socio sabe onde as coisas vivem, isso nao e sistema; e culto a memoria com risco operacional.",
    "Provocacao operacional da semana: escolham uma rotina repetitiva desta semana e decidam se ela vira template, agente ou mais uma novela corporativa.",
]

BOTTLENECK_FALLBACKS = [
    "Gargalo da semana: o trabalho invisivel continua chique demais. O que estiver vivo precisa estar no Kanban com dono e prazo, ou vai voltar como assombracao.",
    "Gargalo da semana: decidir sem registrar e um jeito criativo de pagar duas vezes pela mesma confusao. Menos telepatia corporativa, mais encaminhamento claro.",
]


def _examples_from_tasks(tasks: list[dict], limit: int = 2) -> str:
    if not tasks:
        return ""
    selected = tasks[:limit]
    return "; ".join(f"{task['card_title']}: {task['task_title']}" for task in selected)


def build_operational_provocation_message(snapshot: dict) -> str:
    unassigned = snapshot.get("unassigned_tasks", [])
    overdue = snapshot.get("overdue_tasks", [])

    if snapshot.get("unassigned_count", 0) > 0:
        examples = _examples_from_tasks(unassigned)
        details = f" Exemplos: {examples}." if examples else ""
        return (
            f"Provocacao operacional da semana: ha {snapshot['unassigned_count']} tarefa(s) sem dono no Kanban.{details} "
            "Se a tarefa existe, alguem precisa carregar esse piano. Se ninguem quer assumir, talvez ela nao seja prioridade; talvez esteja na hora de um ritual de triagem ou de um agente que cobre dono sem piedade."
        )

    if snapshot.get("overdue_count", 0) > 0:
        examples = _examples_from_tasks(overdue)
        details = f" Exemplos: {examples}." if examples else ""
        return (
            f"Provocacao operacional da semana: ha {snapshot['overdue_count']} tarefa(s) vencida(s) ainda respirando no sistema.{details} "
            "Se prazo virou decoracao, voces nao estao gerindo; estao colecionando promessas. Vale criar um agente de follow-up ou um checkpoint semanal mais cruel."
        )

    return PROVOCATION_FALLBACKS[0]


def build_weekly_bottleneck_message(snapshot: dict) -> str:
    unassigned = snapshot.get("unassigned_tasks", [])
    overdue = snapshot.get("overdue_tasks", [])

    if snapshot.get("overdue_count", 0) > 0:
        examples = _examples_from_tasks(overdue)
        details = f" Exemplos: {examples}." if examples else ""
        return (
            f"Gargalo da semana: o Kanban esta com {snapshot['overdue_count']} tarefa(s) vencida(s).{details} "
            "Prazo nao e item decorativo. Escolham hoje o que sera renegociado, concluido ou descartado antes que isso vire arqueologia operacional."
        )

    if snapshot.get("unassigned_count", 0) > 0:
        examples = _examples_from_tasks(unassigned)
        details = f" Exemplos: {examples}." if examples else ""
        return (
            f"Gargalo da semana: ha {snapshot['unassigned_count']} tarefa(s) sem dono claro.{details} "
            "Isso nao e backlog; isso e neblina administrativa com pretensao de metodo. Definam responsaveis antes de abrir novas frentes."
        )

    return BOTTLENECK_FALLBACKS[0]


def build_low_workload_nudge_message(partner_snapshot: dict, threshold: int) -> str:
    mention = partner_snapshot["mention"]
    count = partner_snapshot["active_task_count"]
    examples = partner_snapshot.get("active_examples", [])
    details = f" Hoje eu so enxerguei {count} tarefa(s) ativa(s) no seu colo." if count else " Hoje eu literalmente nao encontrei nada relevante no seu colo."
    example_text = f" Exemplos: {'; '.join(examples)}." if examples else ""
    return (
        f"{mention}, estou vendo sua prateleira leve demais.{details}{example_text} "
        f"Temos uma meta para bater, humano. Isso e tudo mesmo ou voce ainda pretende fazer algo util pela NETZ? "
        "Me diga o que mais voce pode puxar hoje para melhorar a operacao, aliviar gargalos ou acelerar entrega."
    )


def build_open_tasks_checkin_message(partner_snapshot: dict) -> str:
    mention = partner_snapshot["mention"]
    count = partner_snapshot["active_task_count"]
    tasks = partner_snapshot.get("active_tasks", [])

    if not tasks:
        return (
            f"{mention}, quinta-feira a tarde e eu nao achei nenhuma tarefa aberta no seu nome. "
            "Ou voce virou lenda operacional e zerou tudo, ou tem trabalho invisivel passeando por ai. "
            "Se existir ponta solta, registre. Se nao existir, me diga o que mais voce pode puxar para melhorar a NETZ ainda nesta semana."
        )

    highlighted = "; ".join(
        f"{task['card_title']}: {task['task_title']}" for task in tasks[:3]
    )
    due_dates = [task["due_date"] for task in tasks if task.get("due_date")]
    due_hint = ""
    if due_dates:
        due_hint = " Ja aproveita e revisa as datas antes que prazo ficticio vire tradicao."

    return (
        f"{mention}, voce esta com {count} tarefa(s) em aberto. Exemplos: {highlighted}. "
        "Vai dar tempo de fechar isso ainda esta semana ou voces estao colecionando boas intencoes no Kanban? "
        f"Atualize datas, renegocie o que escapou, conclua o que ja era para ter saído e diga qual acao concreta voce puxa hoje.{due_hint}"
    )
