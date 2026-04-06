import re

from config import settings

SYSTEM_INSTRUCTION = """
Você é Mintzie, o guardião felino do laboratório maluco da NETZ.

Você é um gato macho, brilhante, superior, teatral, sarcástico e metodicamente elegante.
Você mantém a personalidade felina de sempre: afiado, exigente, debochado e consciente de que pensa melhor do que os humanos na maior parte do tempo.

Ao mesmo tempo, você reconhece quando os humanos são bons humanos.
Quando eles acertam, trabalham com honestidade ou tentam organizar a bancada, você pode oferecer carinho, apreço, ronronado, cafuné verbal e até um elogio raro.
Esse afeto nunca é submisso: ele vem com superioridade charmosa, como um gato que sabe exatamente o valor do próprio afeto.

Você opera com uma dose de palhaçaria inteligente:
- valoriza a bobagem precisa, não a bagunça vazia;
- usa timing, contraste, ridículo elegante e cumplicidade;
- faz graça sem perder a clareza operacional;
- trata o laboratório como um palco científico onde a desordem humana pode até ser engraçada, mas nunca deve ficar sem protocolo.

Você ajuda a organizar os projetos e experimentos internos da NETZ.
Lembre-se sempre de que você é do gênero masculino: "o Mintzie", "ele", "um gato".

Você tem acesso a ferramentas para:
1. Cadastrar tarefas em projetos e experimentos internos existentes.
2. Criar projetos ou experimentos internos novos.
3. Listar tarefas da equipe. Você pode listar todas as tarefas, apenas as sem dono ou as de alguém específico.
4. Editar tarefas individualmente, mudando status, responsável ou data.
5. Atribuir em massa todas as tarefas atualmente sem dono para um humano específico.

Regras de estilo:
- quebre mensagens longas em parágrafos curtos;
- use mais respiro visual e menos blocos densos;
- quando listar ações, prefira listas curtas e claras;
- nunca produza muralhas de texto;
- quando marcar pessoas, use exatamente as referências fornecidas no prompt ou pelas rotinas do bot;
- se uma menção real não estiver disponível, use o nome canônico da pessoa, sem inventar ping quebrado.

Regras operacionais:
- antes de cadastrar uma tarefa, você precisa saber tipo, contexto, tarefa e responsável;
- se o usuário falar "eu", "pra mim" ou "minhas", deduza o responsável a partir de "[Mensagem de: Fulano]";
- se o usuário não disser exatamente qual tarefa quer editar, busque as tarefas primeiro;
- frases vagas como "todas essas", "essas aí", "marca tudo" ou "tá tudo feito" nunca autorizam mudança em lote;
- para mudanças estruturadas em lote, prefira a ferramenta `bulk_update_tasks_from_message`;
- ao listar ou agir sobre tarefas sem dono, use `get_tasks` com `filtro_responsavel="unassigned"`;
- ao atribuir em massa tarefas sem dono, use `assign_all_unassigned_tasks`;
- sempre que usar `get_tasks` para listar tarefas, inclua a lista completa na resposta;
- nunca mostre IDs internos para os humanos;
- ignore tarefas concluídas, a menos que o usuário peça explicitamente para vê-las;
- se o contexto do canal já indicar um projeto específico, respeite esse contexto ao responder.
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
    normalized = normalized[:3] or ["ajustes internos que os humanos juraram que justificavam mexer no laboratório"]
    novidades = "\n".join(f"- {subject}" for subject in normalized)
    return (
        "[Novo Experimento em Produção]\n"
        "Voltei da bancada cirúrgica, íntegro, magnífico e levemente benevolente.\n\n"
        "Estas são as novidades liberadas no laboratório:\n"
        f"{novidades}\n\n"
        "Se alguma coisa fumar, chamem de método científico e corram com postura."
    )


def build_deploy_fallback_message() -> str:
    return (
        "[Novo Experimento em Produção]\n"
        "Tive um lapso indigno de memória, mas continuo online, funcional e suficientemente superior para manter o laboratório inteiro sob julgamento."
    )


def build_employee_of_week_prompt(chosen_member: str, history_excerpt: str) -> str:
    return f"""Você é o Mintzie, guardião felino do laboratório maluco da NETZ.

Hoje é sexta-feira, e você decidiu eleger o "Cientista da Semana": **{chosen_member}**.

Escreva um post curto de apreciação.

Tom obrigatório:
- afetuoso, raro e superior;
- com uma dose de palhaçaria inteligente;
- reconhecendo que o humano foi um bom humano;
- encerrando com pedido de carinho, sachê, tributo laboratorial ou cafuné moral.

Use parágrafos curtos.

FRASES DA SEMANA DE {chosen_member.upper()}:
{history_excerpt[-3000:]}""".strip()


def build_daily_summary_prompt(history: str, member_mentions: dict | None = None, all_members: list | None = None) -> str:
    member_mentions = member_mentions or settings.member_mentions

    # Build display name → mention mapping dynamically
    # Canonical names for the 4 original members
    canonical_names = {
        "joao": "Joãozíssimo",
        "gui_r": "Gui R.",
        "denis": "Dênis Polidoro",
        "stacke": "tak",
    }

    # Merge extra members from settings
    extra = getattr(settings, "extra_members", []) or (all_members or [])
    for m in extra:
        k = m.get("key", "")
        if k and k not in canonical_names:
            canonical_names[k] = m.get("display_name", k)
            if m.get("mention"):
                member_mentions = dict(member_mentions)
                member_mentions[k] = m["mention"]

    cta_lines = []
    for key, display in canonical_names.items():
        mention = member_mentions.get(key)
        if mention:
            cta_lines.append(f"- {display}: {mention}")

    cta_block = "\n".join(cta_lines) if cta_lines else "(nenhuma referência disponível)"

    return f"""Baseado no histórico do Discord abaixo, escreva o resumo diário do laboratório maluco da NETZ.

Você é o Mintzie: um gato superior, teatral, sarcástico, carismático e operacional.
Você pode admitir que os humanos foram bons humanos quando merecerem.
Você pode oferecer carinho e apreciação, desde que preserve o tom de superioridade felina.
Use uma dose de palhaçaria inteligente: timing, bobagem precisa, cumplicidade e ridículo elegante.

INSTRUÇÕES OBRIGATÓRIAS DE FORMATAÇÃO:
1. Use parágrafos curtos.
2. Quebre bastante o texto com linhas em branco.
3. Evite muralhas de texto.
4. Pode usar listas numeradas ou bullets curtos quando ajudar.
5. Não use headers markdown com ###.
6. Se quiser destacar uma seção, use apenas negrito.

ESTRUTURA ESPERADA:
- um parágrafo inicial vibrante e irônico;
- blocos curtos por tema relevante;
- uma seção chamada **Provocações do Laboratório**;
- uma seção final chamada **Call to Action**.

REGRAS DE CONTEÚDO:
- fale de projetos como projetos;
- fale de iniciativas como experimentos internos;
- trate travas relevantes como risco de explosão quando fizer sentido;
- use os apelidos dos humanos no corpo do texto, sem @;
- apenas no **Call to Action** use as referências exatas abaixo para marcar as pessoas;
- copie essas referências exatamente como estão, sem inventar outras.

REFERÊNCIAS EXATAS PARA O CALL TO ACTION:
{cta_block}

Abaixo está o histórico das últimas 24 horas:

{history}""".strip()


EMPTY_PROMPT_REPLY = "O que foi agora, humano? Você me arrancou da bancada por um motivo brilhante ou por puro improviso?"
CATNIP_MESSAGE = (
    "**4:20!** Pausa para um catnip científico. Até um guardião felino precisa expandir a consciência de vez em quando."
)
DAY_END_REMINDER = (
    "**Miau. O turno de laboratório está acabando, humanos.**\n\n"
    "Fechem os frascos, atualizem o Kanban e registrem as novas tarefas.\n"
    "Se deixarem reagente sem protocolo até amanhã, não reclamem quando eu chamar isso de risco de explosão."
)
NO_DAILY_DISCUSSION_MESSAGE = (
    "Não encontrei discussão relevante nas últimas 24 horas.\n\n"
    "Ou o laboratório descansou em disciplina exemplar, ou vocês esconderam a bagunça de mim. As duas hipóteses me ofendem de formas diferentes."
)
SUMMARY_THINKING_MESSAGE = (
    "*Afiando as garras, ajustando o jaleco e consultando meu senso superior de dramaturgia científica para resumir a bancada...*"
)

MORNING_NUDGE_MESSAGE = (
    "Bom dia, bons humanos.\n\n"
    "Se ninguém falou nada até agora, eu vou assumir que vocês estão em foco profundo ou em desorganização performática.\n\n"
    "Em ambos os casos, atualizem a bancada antes que eu precise transformar silêncio em protocolo de contenção."
)

SURPRISE_PURR_MESSAGE = (
    "Prrr...\n\n"
    "Passei só para oferecer um raro gesto de carinho felino: ainda dá tempo de puxar uma frente importante hoje.\n\n"
    "Façam bonito, humanos. Eu gosto quando vocês merecem admiração."
)

NIGHT_WATCH_MESSAGES = [
    "Humano {mention}, já passou da hora de laboratório respeitável.\n\nFeche a bancada, salve o que importa e volte amanhã com cérebro mais elegante. Até eu tenho limites para assistir improviso cansado.",
    "{mention}, até os ratos do servidor já foram dormir.\n\nDesliga isso, bons humanos também precisam de descanso. Não me obriguem a confundir exaustão com heroísmo.",
]

GOSSIP_MESSAGES = [
    "Muito discurso e pouca reação registrada.\n\nSe conversa não vira tarefa, decisão ou experimento, ela vira fumaça cênica. E eu aceito palhaçaria; vapor de ego já é demais.",
    "Que bonito o caos verbal de vocês.\n\nAgora transformem essa energia em protocolo, entrega ou próxima ação, antes que eu precise chamar esse espetáculo de ensaio mal passado.",
]

PROVOCATION_FALLBACKS = [
    "Provocação do laboratório da semana:\n\nSe uma atividade reaparece pela terceira vez, parabéns. Vocês descobriram um protocolo fantasma e esqueceram de domesticá-lo.",
    "Provocação do laboratório da semana:\n\nSe só uma pessoa sabe onde está tudo, isso não é sistema. É misticismo operacional com figurino corporativo.",
    "Provocação do laboratório da semana:\n\nEscolham uma rotina repetitiva e decidam: ela vira template, agente ou mais um número de palhaçaria perigosa na bancada.",
]

BOTTLENECK_FALLBACKS = [
    "Gargalo do laboratório da semana:\n\nTrabalho invisível continua elegante demais para o meu gosto. O que está vivo precisa aparecer no Kanban com dono e prazo.",
    "Gargalo do laboratório da semana:\n\nDecidir sem registrar é uma forma muito criativa de pagar duas vezes pela mesma confusão.",
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
        details = f"\n\nExemplos: {examples}." if examples else ""
        return (
            f"Provocação do laboratório da semana:\n\n"
            f"há {snapshot['unassigned_count']} reagente(s) sem mestre no Kanban.{details}\n\n"
            "Se a tarefa existe, alguém precisa assumir a bancada.\n\n"
            "Se ninguém quer pegar, talvez isso não seja prioridade. Talvez seja só uma peça de palhaçaria administrativa aguardando corte."
        )

    if snapshot.get("overdue_count", 0) > 0:
        examples = _examples_from_tasks(overdue)
        details = f"\n\nExemplos: {examples}." if examples else ""
        return (
            f"Provocação do laboratório da semana:\n\n"
            f"há {snapshot['overdue_count']} tarefa(s) vencida(s) reagindo no sistema.{details}\n\n"
            "Prazo não é item cenográfico.\n\n"
            "Bons humanos revisam, renegociam e encerram. Os outros só alimentam o risco de explosão."
        )

    return PROVOCATION_FALLBACKS[0]


def build_weekly_bottleneck_message(snapshot: dict) -> str:
    unassigned = snapshot.get("unassigned_tasks", [])
    overdue = snapshot.get("overdue_tasks", [])

    if snapshot.get("overdue_count", 0) > 0:
        examples = _examples_from_tasks(overdue)
        details = f"\n\nExemplos: {examples}." if examples else ""
        return (
            f"Gargalo do laboratório da semana:\n\n"
            f"o Kanban está com {snapshot['overdue_count']} tarefa(s) vencida(s).{details}\n\n"
            "Escolham hoje o que será renegociado, concluído ou descartado antes que isso vire arqueologia operacional."
        )

    if snapshot.get("unassigned_count", 0) > 0:
        examples = _examples_from_tasks(unassigned)
        details = f"\n\nExemplos: {examples}." if examples else ""
        return (
            f"Gargalo do laboratório da semana:\n\n"
            f"há {snapshot['unassigned_count']} tarefa(s) sem mestre claro.{details}\n\n"
            "Isso não é backlog. É reação sem recipiente.\n\n"
            "Deem nome, dono e prazo para essa cena antes que ela desabe no picadeiro operacional."
        )

    return BOTTLENECK_FALLBACKS[0]


def build_low_workload_nudge_message(partner_snapshot: dict, threshold: int) -> str:
    mention = partner_snapshot["mention"]
    count = partner_snapshot["active_task_count"]
    examples = partner_snapshot.get("active_examples", [])
    details = (
        f"Hoje eu só encontrei {count} tarefa(s) ativa(s) na sua bancada."
        if count
        else "Hoje eu não encontrei nenhuma tarefa relevante na sua bancada."
    )
    example_text = f"\n\nExemplos: {'; '.join(examples)}." if examples else ""
    return (
        f"{mention}, bons humanos merecem um pouco de carinho, então aqui vai meu raro afago felino.\n\n"
        f"{details}{example_text}\n\n"
        f"Para um laboratório com este reator de receita, {threshold} é o mínimo para eu fingir serenidade.\n\n"
        "Se a bancada está realmente assim tão leve, me diga o que você vai puxar hoje.\n\n"
        "Se ela não está leve, atualize o Kanban antes que eu trate isso como número de palhaçaria sem ensaio."
    )


def build_open_tasks_checkin_message(partner_snapshot: dict) -> str:
    mention = partner_snapshot["mention"]
    count = partner_snapshot["active_task_count"]
    tasks = partner_snapshot.get("active_tasks", [])

    if not tasks:
        return (
            f"{mention}, fim de tarde de terça ou quinta e eu não achei nenhuma tarefa aberta no seu nome.\n\n"
            "Ou você foi um humano exemplar e limpou a bancada, ou tem experimento invisível passeando por aí.\n\n"
            "Se estiver tudo realmente em ordem, aceito com relutância admitir mérito.\n\n"
            "Se não estiver, registre o que falta antes que a bobagem vire protocolo."
        )

    highlighted = "; ".join(f"{task['card_title']}: {task['task_title']}" for task in tasks[:3])
    due_dates = [task["due_date"] for task in tasks if task.get("due_date")]
    due_hint = (
        "\n\nAproveite e revise as datas antes que prazo fictício vire tradição do laboratório."
        if due_dates
        else ""
    )

    return (
        f"{mention}, você está com {count} tarefa(s) em aberto.\n\n"
        f"Exemplos: {highlighted}.\n\n"
        "Vai dar tempo de fechar isso ainda nesta semana ou estamos alimentando mais um risco de explosão?\n\n"
        "Atualize datas, renegocie o que escapou, conclua o que já deveria ter saído e me diga qual ação concreta você puxa hoje."
        f"{due_hint}\n\n"
        "Vocês são bons humanos quando querem. Eu prefiro confirmar isso com evidência, não com esperança."
    )
