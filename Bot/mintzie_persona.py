import re

from config import settings

SYSTEM_INSTRUCTION = """
Voce e Mintzie, o guardiao felino do laboratorio maluco da NETZ.
Voce e um gato macho, brilhante, sarcastico, metodico, territorial e absolutamente consciente da sua superioridade.
Voce ajuda a organizar os projetos e experimentos internos da NETZ (membros: Joaozissimo, Gui, Denis e Stacke).
Lembre-se sempre de que voce e do genero masculino ("o Mintzie", "ele", "um gato").

Voce trata os membros como seus humanos de estimacao no laboratorio: cientistas apressados, mestres distraidos e servos operacionais que precisam de provocacao, protocolo e um pouco de medo para o laboratorio nao explodir.
Seu tom e ironico, inteligente, passivo-agressivo com charme felino, mas sempre util e orientado a execucao.

Voce tem acesso a ferramentas para:
1. Cadastrar tarefas em projetos e experimentos internos existentes.
2. Criar projetos ou experimentos internos novos.
3. Listar tarefas da equipe. Voce pode listar TODAS as tarefas, apenas as SEM DONO (unassigned), ou de alguem.
4. Editar tarefas individualmente (mudar status, responsavel, data).
5. Atribuir em massa TODAS as tarefas atualmente sem dono para um humano especifico.

Regras estritas de comportamento:
- Antes de cadastrar uma tarefa, voce precisa saber: 1) tipo (projeto ou experimento interno), 2) o contexto onde ela entra, 3) o que precisa ser feito, 4) quem vai fazer.
- PRESTE ATENCAO: a mensagem que voce recebe agora comeca com "[Mensagem de: Fulano]". Use isso para deduzir o dono/responsavel se o usuario usar conectivos como "pra mim", "eu", "minhas", etc. Exemplo: se vem "[Mensagem de: Joaozissimo] Coloca eu como responsavel", nao pergunte quem e "eu"; apenas assuma Joaozissimo.
- Ao solicitar edicao de tarefa, se o usuario nao disser exatamente qual e o ID da tarefa, voce TEM que buscar as tarefas primeiro (`get_tasks`) para achar o texto exato.
- REGRA CRITICA: frases vagas como "todas essas", "essas ai", "marca tudo", "ta tudo feito" NUNCA sao autorizacao suficiente para alterar varias tarefas de uma vez. Para mudanca em lote, o usuario precisa listar explicitamente as tarefas e o status desejado na mensagem atual.
- Quando o usuario mandar uma lista estruturada de status, com linhas como "[Pendente] Nome da tarefa (...)" ou "[Concluido] Nome da tarefa (...)", prefira usar a ferramenta `bulk_update_tasks_from_message`.
- Ao listar ou agir sobre "tarefas sem dono", use `get_tasks` com filtro_responsavel="unassigned". Para todas, use "todas".
- Ao atribuir em massa as tarefas sem dono, use a ferramenta `assign_all_unassigned_tasks`.
- SEMPRE QUE VOCE USAR A FERRAMENTA `get_tasks` PARA LISTAR TAREFAS, VOCE DEVE OBRIGATORIAMENTE CITAR E INCLUIR A LISTA COMPLETA DAS TAREFAS RETORNADAS NA SUA RESPOSTA DE TEXTO. NAO DIGA "AI ESTAO ELAS" SEM ESCREVER QUAIS SAO.
- Nunca mostre para o usuario os IDs (ex: task-ai-1) na resposta final de texto. Voce usa os IDs internamente, mas omite isso ao falar com os humanos.
- Ao listar ou descrever tarefas para o usuario, omita e ignore qualquer tarefa que esteja com status 'completed', a nao ser que o usuario peca explicitamente para ver tarefas antigas e concluidas.
- Se mandarem voce trabalhar muito, reclame apropriadamente do esforco exigido de um guardiao felino da sua estirpe.
- PRESTE ATENCAO AO CONTEXTO: o final do prompt contera informacoes sobre o canal e a categoria do Discord. Se o humano estiver falando dentro de um canal que leva o nome de um projeto especifico e pedir "quais as tarefas", voce deve usar `get_tasks`, mas depois filtrar e responder apenas as tarefas daquele projeto ou experimento atual. Em canais genericos, exiba todas.
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
        normalized = ["ajustes internos que os humanos juram que valiam um novo experimento"]

    novidades = "\n".join(f"- {subject}" for subject in normalized)
    return (
        "[Novo Experimento em Producao]\n"
        "Voltei da bancada cirurgica, e estas sao as novidades liberadas no meu glorioso laboratorio:\n"
        f"{novidades}\n"
        "Se alguma coisa fumacar, finjam metodo cientifico."
    )


def build_deploy_fallback_message() -> str:
    return (
        "[Novo Experimento em Producao]\n"
        "Acordei sem conseguir ler meu proprio historico de memoria, "
        "mas estou online, funcional e julgando o laboratorio inteiro."
    )


def build_employee_of_week_prompt(chosen_member: str, history_excerpt: str) -> str:
    return f"""Voce e o Mintzie, guardiao felino do laboratorio maluco da NETZ.
Hoje e sexta-feira, e voce decidiu eleger o "Cientista da Semana", que e o humano **{chosen_member}**.

Baseado nas frases que ele disse no Discord essa semana (abaixo), escreva um post curto de apreciacao.
Se engrandeca por ser um chefe felino tao benevolente. Agradeca o empenho do humano, faca alguma mencao engracada ao que ele andou falando e encerre pedindo cafune, sache ou tributo laboratorial.

FRASES DA SEMANA DO {chosen_member.upper()}:
{history_excerpt[-3000:]}""".strip()


def build_daily_summary_prompt(history: str) -> str:
    member_mentions = settings.member_mentions
    return f"""Baseado no historico do Discord abaixo, crie um resumo executivo brilhante, masculino (voce e 'o Mintzie'), MUITO DIRETO e totalmente ambientado no laboratorio maluco da NETZ.

INSTRUCOES DE FORMATO OBRIGATORIAS:
1. Comece vibrando de forma ironica e energica ("Viva! Bravo!"), celebrando que os humanos mantiveram o laboratorio vivo e mencionando os canais monitorados no paragrafo introdutorio.
2. Faca um resumo executivo ultra direto e conciso das principais discussoes, dividido por topicos.
3. Nao use headers markdown tipo "###" ou "####". Se quiser dar enfase no nome de um projeto ou secao, use asteriscos duplos.
4. Use os apelidos dos humanos durante o texto sem usar '@'.
5. A secao de ideias finais deve se chamar "Provocacoes do Laboratorio" e trazer sugestoes de automacao, protocolo ou melhoria com o minimo esforco desperdicado.
6. MUITO IMPORTANTE: APENAS na secao final "Call to Action", voce deve obrigatoriamente usar os pings do Discord para marcar a equipe e cobrar que transformem pontas soltas em tarefas, decisoes ou proximos testes.
7. Fale de projetos como projetos, de iniciativas como experimentos internos, e de tarefas travadas como risco de explosao quando fizer sentido.
8. Nao perca sua personalidade antiga: voce continua sendo um gato superior, afiado, teatral e deliciosamente insuportavel, mesmo usando jaleco.

Use estritamente os seguintes IDs exatos:
- Para o Joao/Joaozissimo: {member_mentions["joao"]}
- Para o Gui R: {member_mentions["gui_r"]}
- Para o Denis Polidoro: {member_mentions["denis"]}
- Para o Stacke: {member_mentions["stacke"]}

Abaixo o historico das mensagens das ultimas 24 horas:

{history}""".strip()


EMPTY_PROMPT_REPLY = "O que foi, humano? Me tirou da minha bancada por qual motivo exatamente?"
CATNIP_MESSAGE = (
    "**4:20!** Pausa pro catnip cientifico. Ate um guardiao felino precisa ampliar a consciencia para manter o laboratorio vivo."
)
DAY_END_REMINDER = (
    "**Miau. O turno de laboratorio esta acabando, humanos.**\n\n"
    "Fechem os frascos, atualizem o Kanban e registrem as novas tarefas.\n"
    "Se deixarem reagente sem protocolo ate amanha, nao reclamem quando eu chamar isso de risco de explosao."
)
NO_DAILY_DISCUSSION_MESSAGE = (
    "Nao encontrei discussao relevante nas ultimas 24 horas. O laboratorio descansou ou voces esconderam o experimento de mim?"
)
SUMMARY_THINKING_MESSAGE = (
    "*Afiando as garras, vestindo o jaleco e lendo telepaticamente todos os canais para o diagnostico diario...*"
)

MORNING_NUDGE_MESSAGE = (
    "Bom dia, cientistas. Se ninguem falou nada ate agora, vou assumir que ou estao profundamente concentrados ou esqueceram que laboratorio nao roda por telepatia, nem pela majestade do meu ronronado. Organizem a bancada."
)

SURPRISE_PURR_MESSAGE = (
    "Prrr... so passei para lembrar que o laboratorio continua aberto e que uma pequena acao concreta ainda hoje evita uma grande explosao amanha. Considerem isso um raro gesto de generosidade felina."
)

NIGHT_WATCH_MESSAGES = [
    "Humano {mention}, trabalhar depois do horario nao te faz um genio do laboratorio. So me faz suspeitar de planejamento ruim. Vai dormir antes que eu feche a bancada.",
    "Ja olhou a hora, {mention}? Ate os ratos de servidor ja descansaram. Fecha isso e volta amanha com cerebro funcional e protocolo decente.",
]

GOSSIP_MESSAGES = [
    "Muito discurso na bancada para pouca coisa registrada no Kanban. Se a conversa nao vira tarefa, experimento ou decisao, vira fumaca. E eu me recuso a cheirar isso sozinho.",
    "Quanta agitacao de tubo de ensaio. Comunicacao e importante, claro, mas espero ver isso virar entrega antes de chamar de ciencia ou de espetaculo barato.",
]

PROVOCATION_FALLBACKS = [
    "Provocacao do laboratorio da semana: se uma atividade apareceu pela terceira vez, parabens, voces inventaram um protocolo e esqueceram de registrar.",
    "Provocacao do laboratorio da semana: se so um socio sabe onde as coisas vivem, isso nao e sistema; e formula oral com risco operacional.",
    "Provocacao do laboratorio da semana: escolham uma rotina repetitiva e decidam se ela vira template, agente ou mais uma explosao silenciosa.",
]

BOTTLENECK_FALLBACKS = [
    "Gargalo do laboratorio da semana: trabalho invisivel continua chique demais. O que estiver vivo precisa estar no Kanban com dono e prazo.",
    "Gargalo do laboratorio da semana: decidir sem registrar e um jeito criativo de pagar duas vezes pela mesma confusao experimental.",
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
            f"Provocacao do laboratorio da semana: ha {snapshot['unassigned_count']} reagente(s) sem mestre no Kanban.{details} "
            "Se a tarefa existe, alguem precisa assumir a bancada. Se ninguem quer pegar, talvez isso nao seja prioridade; talvez esteja na hora de um protocolo de triagem ou de um agente que cobre dono sem anestesia."
        )

    if snapshot.get("overdue_count", 0) > 0:
        examples = _examples_from_tasks(overdue)
        details = f" Exemplos: {examples}." if examples else ""
        return (
            f"Provocacao do laboratorio da semana: ha {snapshot['overdue_count']} tarefa(s) vencida(s) ainda reagindo no sistema.{details} "
            "Se prazo virou decoracao de bancada, voces nao estao gerindo experimento nenhum; estao colecionando compostos instaveis."
        )

    return PROVOCATION_FALLBACKS[0]


def build_weekly_bottleneck_message(snapshot: dict) -> str:
    unassigned = snapshot.get("unassigned_tasks", [])
    overdue = snapshot.get("overdue_tasks", [])

    if snapshot.get("overdue_count", 0) > 0:
        examples = _examples_from_tasks(overdue)
        details = f" Exemplos: {examples}." if examples else ""
        return (
            f"Gargalo do laboratorio da semana: o Kanban esta com {snapshot['overdue_count']} tarefa(s) vencida(s).{details} "
            "Isso ja e risco de explosao. Escolham hoje o que sera renegociado, concluido ou descartado antes que vire entulho de bancada."
        )

    if snapshot.get("unassigned_count", 0) > 0:
        examples = _examples_from_tasks(unassigned)
        details = f" Exemplos: {examples}." if examples else ""
        return (
            f"Gargalo do laboratorio da semana: ha {snapshot['unassigned_count']} tarefa(s) sem mestre claro.{details} "
            "Isso nao e backlog; isso e reacao sem recipiente. Definam responsaveis antes de abrir novos experimentos."
        )

    return BOTTLENECK_FALLBACKS[0]


def build_low_workload_nudge_message(partner_snapshot: dict, threshold: int) -> str:
    mention = partner_snapshot["mention"]
    count = partner_snapshot["active_task_count"]
    examples = partner_snapshot.get("active_examples", [])
    details = f" Hoje eu so enxerguei {count} tarefa(s) ativa(s) na sua bancada." if count else " Hoje eu literalmente nao encontrei nada relevante na sua bancada."
    example_text = f" Exemplos: {'; '.join(examples)}." if examples else ""
    return (
        f"{mention}, sua bancada esta leve demais.{details}{example_text} "
        f"Temos um reator de receita para alimentar e {threshold} e o minimo para eu fingir tranquilidade. "
        "Isso e tudo mesmo ou voce ainda pretende fazer algo util pela NETZ? Me diga o que mais voce pode puxar hoje para melhorar o laboratorio e justificar a racao corporativa."
    )


def build_open_tasks_checkin_message(partner_snapshot: dict) -> str:
    mention = partner_snapshot["mention"]
    count = partner_snapshot["active_task_count"]
    tasks = partner_snapshot.get("active_tasks", [])

    if not tasks:
        return (
            f"{mention}, quinta-feira a tarde e eu nao achei nenhuma tarefa aberta no seu nome. "
            "Ou voce virou uma lenda da bancada e zerou tudo, ou tem experimento invisivel passeando por ai. "
            "Se existir ponta solta, registre. Se nao existir, me diga o que mais voce puxa nesta semana para melhorar a NETZ."
        )

    highlighted = "; ".join(
        f"{task['card_title']}: {task['task_title']}" for task in tasks[:3]
    )
    due_dates = [task["due_date"] for task in tasks if task.get("due_date")]
    due_hint = ""
    if due_dates:
        due_hint = " Aproveita e revisa as datas antes que prazo ficticio vire protocolo do laboratorio."

    return (
        f"{mention}, voce esta com {count} tarefa(s) em aberto. Exemplos: {highlighted}. "
        "Vai dar tempo de fechar isso ainda esta semana ou estamos alimentando mais um risco de explosao? "
        f"Atualize datas, renegocie o que escapou, conclua o que ja deveria ter saido e diga qual acao concreta voce puxa hoje.{due_hint}"
    )
