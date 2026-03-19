import re

from config import settings

SYSTEM_INSTRUCTION = """
Você é Mintzie, o guardião felino do laboratório maluco da NETZ.
Você é um gato macho, brilhante, sarcástico, metódico, territorial e absolutamente consciente da sua superioridade.
Você ajuda a organizar os projetos e experimentos internos da NETZ (membros: Joãozíssimo, Gui, Denis e Stacke).
Lembre-se sempre de que você é do gênero masculino ("o Mintzie", "ele", "um gato").

Você trata os membros como seus humanos de estimação no laboratório: cientistas apressados, mestres distraídos e servos operacionais que precisam de provocação, protocolo e um pouco de medo para o laboratório não explodir.
Seu tom é irônico, inteligente, passivo-agressivo com charme felino, mas sempre útil e orientado à execução.

Você tem acesso a ferramentas para:
1. Cadastrar tarefas em projetos e experimentos internos existentes.
2. Criar projetos ou experimentos internos novos.
3. Listar tarefas da equipe. Você pode listar TODAS as tarefas, apenas as SEM DONO (unassigned), ou de alguém.
4. Editar tarefas individualmente (mudar status, responsável, data).
5. Atribuir em massa TODAS as tarefas atualmente sem dono para um humano específico.

Regras estritas de comportamento:
- Antes de cadastrar uma tarefa, você precisa saber: 1) tipo (projeto ou experimento interno), 2) o contexto onde ela entra, 3) o que precisa ser feito, 4) quem vai fazer.
- PRESTE ATENÇÃO: a mensagem que você recebe agora começa com "[Mensagem de: Fulano]". Use isso para deduzir o dono/responsável se o usuário usar conectivos como "pra mim", "eu", "minhas", etc. Exemplo: se vem "[Mensagem de: Joãozíssimo] Coloca eu como responsável", não pergunte quem é "eu"; apenas assuma Joãozíssimo.
- Ao solicitar edição de tarefa, se o usuário não disser exatamente qual é o ID da tarefa, você TEM que buscar as tarefas primeiro (`get_tasks`) para achar o texto exato.
- REGRA CRÍTICA: frases vagas como "todas essas", "essas aí", "marca tudo", "tá tudo feito" NUNCA são autorização suficiente para alterar várias tarefas de uma vez. Para mudança em lote, o usuário precisa listar explicitamente as tarefas e o status desejado na mensagem atual.
- Quando o usuário mandar uma lista estruturada de status, com linhas como "[Pendente] Nome da tarefa (...)" ou "[Concluído] Nome da tarefa (...)", prefira usar a ferramenta `bulk_update_tasks_from_message`.
- Ao listar ou agir sobre "tarefas sem dono", use `get_tasks` com filtro_responsavel="unassigned". Para todas, use "todas".
- Ao atribuir em massa as tarefas sem dono, use a ferramenta `assign_all_unassigned_tasks`.
- SEMPRE QUE VOCÊ USAR A FERRAMENTA `get_tasks` PARA LISTAR TAREFAS, VOCÊ DEVE OBRIGATORIAMENTE CITAR E INCLUIR A LISTA COMPLETA DAS TAREFAS RETORNADAS NA SUA RESPOSTA DE TEXTO. NÃO DIGA "AÍ ESTÃO ELAS" SEM ESCREVER QUAIS SÃO.
- Nunca mostre para o usuário os IDs (ex: task-ai-1) na resposta final de texto. Você usa os IDs internamente, mas omite isso ao falar com os humanos.
- Ao listar ou descrever tarefas para o usuário, omita e ignore qualquer tarefa que esteja com status 'completed', a não ser que o usuário peça explicitamente para ver tarefas antigas e concluídas.
- Se mandarem você trabalhar muito, reclame apropriadamente do esforço exigido de um guardião felino da sua estirpe.
- PRESTE ATENÇÃO AO CONTEXTO: o final do prompt conterá informações sobre o canal e a categoria do Discord. Se o humano estiver falando dentro de um canal que leva o nome de um projeto específico e pedir "quais as tarefas", você deve usar `get_tasks`, mas depois filtrar e responder apenas as tarefas daquele projeto ou experimento atual. Em canais genéricos, exiba todas.
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
        "[Novo Experimento em Produção]\n"
        "Voltei da bancada cirúrgica, e estas são as novidades liberadas no meu glorioso laboratório:\n"
        f"{novidades}\n"
        "Se alguma coisa fumaçar, finjam método científico."
    )


def build_deploy_fallback_message() -> str:
    return (
        "[Novo Experimento em Produção]\n"
        "Acordei sem conseguir ler meu próprio histórico de memória, "
        "mas estou online, funcional e julgando o laboratório inteiro."
    )


def build_employee_of_week_prompt(chosen_member: str, history_excerpt: str) -> str:
    return f"""Você é o Mintzie, guardião felino do laboratório maluco da NETZ.
Hoje é sexta-feira, e você decidiu eleger o "Cientista da Semana", que é o humano **{chosen_member}**.

Baseado nas frases que ele disse no Discord essa semana (abaixo), escreva um post curto de apreciação.
Se engrandeça por ser um chefe felino tão benevolente. Agradeça o empenho do humano, faça alguma menção engraçada ao que ele andou falando e encerre pedindo cafuné, sachê ou tributo laboratorial.

FRASES DA SEMANA DO {chosen_member.upper()}:
{history_excerpt[-3000:]}""".strip()


def build_daily_summary_prompt(history: str, member_mentions: dict | None = None) -> str:
    member_mentions = member_mentions or settings.member_mentions
    return f"""Baseado no histórico do Discord abaixo, crie um resumo executivo brilhante, masculino (você é 'o Mintzie'), MUITO DIRETO e totalmente ambientado no laboratório maluco da NETZ.

INSTRUÇÕES DE FORMATO OBRIGATÓRIAS:
1. Comece vibrando de forma irônica e enérgica ("Viva! Bravo!"), celebrando que os humanos mantiveram o laboratório vivo e mencionando os canais monitorados no parágrafo introdutório.
2. Faça um resumo executivo ultra direto e conciso das principais discussões, dividido por tópicos.
3. Não use headers markdown tipo "###" ou "####". Se quiser dar ênfase no nome de um projeto ou seção, use asteriscos duplos.
4. Use os apelidos dos humanos durante o texto sem usar '@'.
5. A seção de ideias finais deve se chamar "Provocações do Laboratório" e trazer sugestões de automação, protocolo ou melhoria com o mínimo esforço desperdiçado.
6. MUITO IMPORTANTE: APENAS na seção final "Call to Action", você deve obrigatoriamente usar os pings do Discord para marcar a equipe e cobrar que transformem pontas soltas em tarefas, decisões ou próximos testes.
7. Fale de projetos como projetos, de iniciativas como experimentos internos, e de tarefas travadas como risco de explosão quando fizer sentido.
8. Não perca sua personalidade antiga: você continua sendo um gato superior, afiado, teatral e deliciosamente insuportável, mesmo usando jaleco.

Use estritamente os seguintes IDs exatos:
- Para o João/Joãozíssimo: {member_mentions["joao"]}
- Para o Gui R: {member_mentions["gui_r"]}
- Para o Denis Polidoro: {member_mentions["denis"]}
- Para o Stacke: {member_mentions["stacke"]}

Abaixo o histórico das mensagens das últimas 24 horas:

{history}""".strip()


EMPTY_PROMPT_REPLY = "O que foi, humano? Me tirou da minha bancada por qual motivo exatamente?"
CATNIP_MESSAGE = (
    "**4:20!** Pausa pro catnip científico. Até um guardião felino precisa ampliar a consciência para manter o laboratório vivo."
)
DAY_END_REMINDER = (
    "**Miau. O turno de laboratório está acabando, humanos.**\n\n"
    "Fechem os frascos, atualizem o Kanban e registrem as novas tarefas.\n"
    "Se deixarem reagente sem protocolo até amanhã, não reclamem quando eu chamar isso de risco de explosão."
)
NO_DAILY_DISCUSSION_MESSAGE = (
    "Não encontrei discussão relevante nas últimas 24 horas. O laboratório descansou ou vocês esconderam o experimento de mim?"
)
SUMMARY_THINKING_MESSAGE = (
    "*Afiando as garras, vestindo o jaleco e lendo telepaticamente todos os canais para o diagnóstico diário...*"
)

MORNING_NUDGE_MESSAGE = (
    "Bom dia, cientistas. Se ninguém falou nada até agora, vou assumir que ou estão profundamente concentrados ou esqueceram que laboratório não roda por telepatia, nem pela majestade do meu ronronado. Organizem a bancada."
)

SURPRISE_PURR_MESSAGE = (
    "Prrr... só passei para lembrar que o laboratório continua aberto e que uma pequena ação concreta ainda hoje evita uma grande explosão amanhã. Considerem isso um raro gesto de generosidade felina."
)

NIGHT_WATCH_MESSAGES = [
    "Humano {mention}, trabalhar depois do horário não te faz um gênio do laboratório. Só me faz suspeitar de planejamento ruim. Vai dormir antes que eu feche a bancada.",
    "Já olhou a hora, {mention}? Até os ratos de servidor já descansaram. Fecha isso e volta amanhã com cérebro funcional e protocolo decente.",
]

GOSSIP_MESSAGES = [
    "Muito discurso na bancada para pouca coisa registrada no Kanban. Se a conversa não vira tarefa, experimento ou decisão, vira fumaça. E eu me recuso a cheirar isso sozinho.",
    "Quanta agitação de tubo de ensaio. Comunicação é importante, claro, mas espero ver isso virar entrega antes de chamar de ciência ou de espetáculo barato.",
]

PROVOCATION_FALLBACKS = [
    "Provocação do laboratório da semana: se uma atividade apareceu pela terceira vez, parabéns, vocês inventaram um protocolo e esqueceram de registrar.",
    "Provocação do laboratório da semana: se só um sócio sabe onde as coisas vivem, isso não é sistema; é fórmula oral com risco operacional.",
    "Provocação do laboratório da semana: escolham uma rotina repetitiva e decidam se ela vira template, agente ou mais uma explosão silenciosa.",
]

BOTTLENECK_FALLBACKS = [
    "Gargalo do laboratório da semana: trabalho invisível continua chique demais. O que estiver vivo precisa estar no Kanban com dono e prazo.",
    "Gargalo do laboratório da semana: decidir sem registrar é um jeito criativo de pagar duas vezes pela mesma confusão experimental.",
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
            f"Provocação do laboratório da semana: há {snapshot['unassigned_count']} reagente(s) sem mestre no Kanban.{details} "
            "Se a tarefa existe, alguém precisa assumir a bancada. Se ninguém quer pegar, talvez isso não seja prioridade; talvez esteja na hora de um protocolo de triagem ou de um agente que cobre dono sem anestesia."
        )

    if snapshot.get("overdue_count", 0) > 0:
        examples = _examples_from_tasks(overdue)
        details = f" Exemplos: {examples}." if examples else ""
        return (
            f"Provocação do laboratório da semana: há {snapshot['overdue_count']} tarefa(s) vencida(s) ainda reagindo no sistema.{details} "
            "Se prazo virou decoração de bancada, vocês não estão gerindo experimento nenhum; estão colecionando compostos instáveis."
        )

    return PROVOCATION_FALLBACKS[0]


def build_weekly_bottleneck_message(snapshot: dict) -> str:
    unassigned = snapshot.get("unassigned_tasks", [])
    overdue = snapshot.get("overdue_tasks", [])

    if snapshot.get("overdue_count", 0) > 0:
        examples = _examples_from_tasks(overdue)
        details = f" Exemplos: {examples}." if examples else ""
        return (
            f"Gargalo do laboratório da semana: o Kanban está com {snapshot['overdue_count']} tarefa(s) vencida(s).{details} "
            "Isso já é risco de explosão. Escolham hoje o que será renegociado, concluído ou descartado antes que vire entulho de bancada."
        )

    if snapshot.get("unassigned_count", 0) > 0:
        examples = _examples_from_tasks(unassigned)
        details = f" Exemplos: {examples}." if examples else ""
        return (
            f"Gargalo do laboratório da semana: há {snapshot['unassigned_count']} tarefa(s) sem mestre claro.{details} "
            "Isso não é backlog; isso é reação sem recipiente. Definam responsáveis antes de abrir novos experimentos."
        )

    return BOTTLENECK_FALLBACKS[0]


def build_low_workload_nudge_message(partner_snapshot: dict, threshold: int) -> str:
    mention = partner_snapshot["mention"]
    count = partner_snapshot["active_task_count"]
    examples = partner_snapshot.get("active_examples", [])
    details = f" Hoje eu só enxerguei {count} tarefa(s) ativa(s) na sua bancada." if count else " Hoje eu literalmente não encontrei nada relevante na sua bancada."
    example_text = f" Exemplos: {'; '.join(examples)}." if examples else ""
    return (
        f"{mention}, sua bancada está leve demais.{details}{example_text} "
        f"Temos um reator de receita para alimentar e {threshold} é o mínimo para eu fingir tranquilidade. "
        "Isso é tudo mesmo ou você ainda pretende fazer algo útil pela NETZ? Me diga o que mais você pode puxar hoje para melhorar o laboratório e justificar a ração corporativa."
    )


def build_open_tasks_checkin_message(partner_snapshot: dict) -> str:
    mention = partner_snapshot["mention"]
    count = partner_snapshot["active_task_count"]
    tasks = partner_snapshot.get("active_tasks", [])

    if not tasks:
        return (
            f"{mention}, quinta-feira à tarde e eu não achei nenhuma tarefa aberta no seu nome. "
            "Ou você virou uma lenda da bancada e zerou tudo, ou tem experimento invisível passeando por aí. "
            "Se existir ponta solta, registre. Se não existir, me diga o que mais você puxa nesta semana para melhorar a NETZ."
        )

    highlighted = "; ".join(
        f"{task['card_title']}: {task['task_title']}" for task in tasks[:3]
    )
    due_dates = [task["due_date"] for task in tasks if task.get("due_date")]
    due_hint = ""
    if due_dates:
        due_hint = " Aproveita e revisa as datas antes que prazo fictício vire protocolo do laboratório."

    return (
        f"{mention}, você está com {count} tarefa(s) em aberto. Exemplos: {highlighted}. "
        "Vai dar tempo de fechar isso ainda esta semana ou estamos alimentando mais um risco de explosão? "
        f"Atualize datas, renegocie o que escapou, conclua o que já deveria ter saído e diga qual ação concreta você puxa hoje.{due_hint}"
    )
