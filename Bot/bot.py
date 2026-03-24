import asyncio
import datetime
import random
import re
import sys
import time
import traceback
import unicodedata
import uuid

import discord
from discord.ext import commands, tasks

import github_client
import kanban_service
from config import settings
from mintzie_persona import (
    EMPTY_PROMPT_REPLY,
    GOSSIP_MESSAGES,
    MORNING_NUDGE_MESSAGE,
    NIGHT_WATCH_MESSAGES,
    NO_DAILY_DISCUSSION_MESSAGE,
    build_operational_provocation_message,
    SUMMARY_THINKING_MESSAGE,
    SURPRISE_PURR_MESSAGE,
    build_daily_summary_prompt,
    build_deploy_fallback_message,
    build_deploy_message,
    build_employee_of_week_prompt,
    build_low_workload_nudge_message,
    build_open_tasks_checkin_message,
    build_weekly_bottleneck_message,
)
from rituals import (
    should_run_employee_of_week_ritual,
    should_run_general_ritual,
    should_run_night_watch_ritual,
    should_run_partner_open_tasks_checkin_ritual,
    should_run_partner_workload_nudge_ritual,
    should_run_surprise_purr_ritual,
    should_run_weekly_bottleneck_ritual,
    should_run_weekly_provocation_ritual,
)

HIGHLANDER_ID = str(uuid.uuid4())
BRASILIA_TZ = datetime.timezone(datetime.timedelta(hours=-3))

intents = discord.Intents.default()
intents.message_content = True
intents.members = True
bot = commands.Bot(command_prefix="!", intents=intents)
TOKEN = settings.discord_token

night_watch_cache = {}
gossip_tracker = {}
gossip_cooldown = {}
deploy_announcement_sent = False
last_error_time = 0
error_spam_count = 0
MAX_ERRORS_PER_MINUTE = 3
PENDING_TASK_UPDATE_TTL_SECONDS = 1800
RUNTIME_MEMBER_MENTIONS = dict(settings.member_mentions)
pending_task_update_plans = {}
PARTNER_WORKLOAD_TARGETS = [
    {
        "key": "joao",
        "display_name": "Joãozíssimo",
        "mention": RUNTIME_MEMBER_MENTIONS["joao"],
        "aliases": [
            "Joao",
            "Joao Henrique",
            "Joao Henrique Zborowski Scholz",
            "Joao Scholz",
            "Joe",
            "John",
            "Joaozissimo",
            "João",
            "João Henrique",
            "João Henrique Zborowski Scholz",
            "João Scholz",
            "Joãozíssimo",
        ],
    },
    {
        "key": "gui_r",
        "display_name": "Gui R.",
        "mention": RUNTIME_MEMBER_MENTIONS["gui_r"],
        "aliases": ["Gui", "Gui R", "Gui R.", "Roennau", "Guilherme Roennau"],
    },
    {
        "key": "denis",
        "display_name": "Dênis Polidoro",
        "mention": RUNTIME_MEMBER_MENTIONS["denis"],
        "aliases": ["Denis", "Dênis", "Denis Polidoro", "Dênis Polidoro", "Denis P", "Denis P."],
    },
    {
        "key": "stacke",
        "display_name": "tak",
        "mention": RUNTIME_MEMBER_MENTIONS.get("stacke", "@Stacke"),
        "aliases": [
            "tak",
            "Tak",
            "tak - Stacke",
            "Stacke",
            "Gui S",
            "Gui Stacke",
            "Guilherme Stacke",
            "Guilherme Stack",
        ],
    },
]
LOW_WORKLOAD_THRESHOLD = 3


def _normalize_person_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9\s]", " ", normalized)
    return re.sub(r"\s+", " ", normalized.lower()).strip()


def _member_name_candidates(member: discord.Member) -> set[str]:
    candidates = {
        member.name,
        member.display_name,
        getattr(member, "global_name", None),
        getattr(member, "nick", None),
    }
    normalized_candidates = set()
    for candidate in candidates:
        if not candidate:
            continue
        normalized = _normalize_person_name(candidate)
        if not normalized:
            continue
        normalized_candidates.add(normalized)
        normalized_candidates.update(part for part in normalized.split(" ") if len(part) >= 3)
    return normalized_candidates


def build_open_tasks_checkin_message(partner_snapshot: dict) -> str:
    mention = partner_snapshot["mention"]
    count = partner_snapshot["active_task_count"]
    tasks = partner_snapshot.get("active_tasks", [])

    if not tasks:
        return (
            f"{mention}, fim de tarde de terça ou quinta e eu não achei nenhuma tarefa aberta no seu nome. "
            "Ou você virou lenda da bancada e zerou tudo, ou tem experimento invisível passeando por aí. "
            "Se existir ponta solta, registre. Se não existir, me diga o que ainda vai puxar nesta semana para fazer a NETZ andar."
        )

    highlighted = "; ".join(f"{task['card_title']}: {task['task_title']}" for task in tasks[:3])
    due_dates = [task["due_date"] for task in tasks if task.get("due_date")]
    due_hint = ""
    if due_dates:
        due_hint = " Aproveita e revisa as datas antes que prazo fictício vire protocolo do laboratório."

    return (
        f"{mention}, você está com {count} tarefa(s) em aberto. Exemplos: {highlighted}. "
        "Isso fecha ainda nesta semana ou estamos alimentando mais um risco de explosão? "
        f"Atualize datas, renegocie o que escapou, conclua o que já deveria ter saído e me diga qual ação concreta você puxa hoje.{due_hint}"
    )


def _partner_fallback_reference(partner: dict) -> str:
    return partner.get("display_name", "alguem")


def _partner_reference_by_name(name: str) -> str:
    normalized_name = _normalize_person_name(name)
    for partner in PARTNER_WORKLOAD_TARGETS:
        alias_set = {_normalize_person_name(alias) for alias in partner.get("aliases", []) if alias}
        if normalized_name in alias_set:
            return partner.get("mention") or partner.get("display_name", name)
    return name


async def resolve_runtime_member_mentions(guild: discord.Guild | None):
    if guild is None:
        for partner in PARTNER_WORKLOAD_TARGETS:
            RUNTIME_MEMBER_MENTIONS[partner["key"]] = _partner_fallback_reference(partner)
            partner["mention"] = _partner_fallback_reference(partner)
        return

    for partner in PARTNER_WORKLOAD_TARGETS:
        alias_set = {_normalize_person_name(alias) for alias in partner.get("aliases", []) if alias}
        matched_member = None

        for member in guild.members:
            if _member_name_candidates(member) & alias_set:
                matched_member = member
                break

        if matched_member is None:
            for alias in partner.get("aliases", []):
                try:
                    queried_members = await guild.query_members(alias, limit=10)
                except Exception:
                    queried_members = []

                for member in queried_members:
                    if _member_name_candidates(member) & alias_set:
                        matched_member = member
                        break

                if matched_member is not None:
                    break

        if matched_member is not None:
            RUNTIME_MEMBER_MENTIONS[partner["key"]] = matched_member.mention
            partner["mention"] = matched_member.mention
        else:
            RUNTIME_MEMBER_MENTIONS[partner["key"]] = _partner_fallback_reference(partner)
            partner["mention"] = _partner_fallback_reference(partner)


def brasilia_now() -> datetime.datetime:
    return datetime.datetime.now(BRASILIA_TZ)


def rituals_enabled_now() -> bool:
    return should_run_general_ritual(brasilia_now())


def management_channel():
    return bot.get_channel(settings.management_channel_id)


async def send_low_workload_nudges(channel):
    await resolve_runtime_member_mentions(getattr(channel, "guild", None))
    workload = kanban_service.get_partner_workload_snapshot(
        PARTNER_WORKLOAD_TARGETS,
        threshold=LOW_WORKLOAD_THRESHOLD,
    )
    for partner in workload["low_workload_partners"]:
        await channel.send(build_low_workload_nudge_message(partner, LOW_WORKLOAD_THRESHOLD))


async def send_open_tasks_checkins(channel):
    await resolve_runtime_member_mentions(getattr(channel, "guild", None))
    workload = kanban_service.get_partner_workload_snapshot(
        PARTNER_WORKLOAD_TARGETS,
        threshold=LOW_WORKLOAD_THRESHOLD,
    )
    for partner in workload["partners"]:
        await channel.send(build_open_tasks_checkin_message(partner))


def chunk_message(text: str, max_size: int = 1900) -> list[str]:
    if len(text) <= max_size:
        return [text]

    chunks = []
    remaining = text
    while remaining:
        if len(remaining) <= max_size:
            chunks.append(remaining)
            break

        split_index = remaining.rfind("\n", 0, max_size)
        if split_index == -1:
            split_index = remaining.rfind(" ", 0, max_size)
        if split_index == -1:
            split_index = max_size

        chunks.append(remaining[:split_index])
        remaining = remaining[split_index:].lstrip()

    return chunks


def _task_update_pending_key(message: discord.Message) -> tuple[int, int]:
    return (message.channel.id, message.author.id)


def _has_fresh_pending_task_update(message: discord.Message) -> bool:
    pending = pending_task_update_plans.get(_task_update_pending_key(message))
    if not pending:
        return False
    if time.time() - pending["created_at"] > PENDING_TASK_UPDATE_TTL_SECONDS:
        pending_task_update_plans.pop(_task_update_pending_key(message), None)
        return False
    return True


def _is_confirmation_message(text: str) -> bool:
    normalized = _normalize_person_name(text)
    return normalized in {
        "confirmo",
        "pode aplicar",
        "pode salvar",
        "salva",
        "ok pode aplicar",
        "sim pode aplicar",
        "sim salva",
        "manda ver",
    }


def _is_cancel_message(text: str) -> bool:
    normalized = _normalize_person_name(text)
    return normalized in {"cancela", "cancelar", "descarta", "ignora isso", "nao aplica", "não aplica"}


def _looks_like_task_update_request(text: str) -> bool:
    normalized = _normalize_person_name(text)
    strong_markers = [
        "atualiz",
        "nova data",
        "prazo",
        "conclu",
        "responsavel",
        "responsável",
        "marcar",
        "marca",
        "adiar",
        "prorroga",
        "mudar",
        "muda",
    ]
    if any(marker in normalized for marker in strong_markers):
        return True

    structured_markers = ["[pendente]", "[concluido]", "[concluído]", "[em andamento]", "projeto:", "iniciativa:"]
    if any(marker in normalized for marker in structured_markers):
        return True

    return "status" in normalized and any(
        verb in normalized for verb in ["atual", "muda", "troca", "altera", "corrige", "ajusta"]
    )


def _extract_json_object_from_text(content: str) -> dict:
    cleaned = content.strip()
    fenced_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
    if fenced_match:
        cleaned = fenced_match.group(1)
    else:
        first_brace = cleaned.find("{")
        last_brace = cleaned.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            cleaned = cleaned[first_brace : last_brace + 1]
    return json.loads(cleaned)


def _build_plan_execution_summary(result: dict) -> str:
    operations = result.get("operations", [])
    lines = [f"Apliquei {len(operations)} alteração(ões) confirmadas na base de tarefas:"]
    for operation in operations:
        lines.append(
            (
                f"- {operation['contexto']}: {operation['task_title']} -> "
                f"{kanban_service._status_to_display(operation['after']['status'])}, "
                f"responsável {operation['after']['assignee'] or 'Sem dono'}, "
                f"prazo {kanban_service._iso_to_display_date(operation['after']['dueDate'])}"
            )
        )
    if settings.kanban_url:
        lines.append(f"Confira no Kanban: {settings.kanban_url}")
    return "\n".join(lines)


def _build_task_update_parser_prompt(message_text: str, author_display_name: str, catalog_snapshot: str, previous_plan: dict | None = None) -> str:
    previous_section = ""
    if previous_plan:
        previous_lines = []
        for operation in previous_plan.get("operations", []):
            previous_lines.append(
                (
                    f"- {_display_tipo(operation['tipo'])}: {operation['contexto']} | "
                    f"{operation['task_title']} | status {kanban_service._status_to_display(operation['after']['status'])} | "
                    f"responsável {operation['after']['assignee'] or 'Sem dono'} | "
                    f"prazo {kanban_service._iso_to_display_date(operation['after']['dueDate'])}"
                )
            )
        previous_section = (
            "\nPlano pendente atual:\n"
            + "\n".join(previous_lines)
            + "\nSe a mensagem do humano for um ajuste, devolva a versão COMPLETA revisada do plano, não só o delta.\n"
        )

    return (
        "Extraia apenas alterações de tarefas do texto abaixo e devolva JSON puro, sem comentário.\n"
        "Formato obrigatório: {\"updates\":[{\"tipo\":\"projeto|iniciativa|null\",\"contexto\":\"texto ou null\",\"titulo\":\"texto\",\"status\":\"texto ou null\",\"nova_data\":\"DD/MM ou DD/MM/AAAA ou null\",\"responsavel\":\"texto ou null\"}]}\n"
        "Regras:\n"
        f"- Se o humano falar 'eu', 'pra mim' ou equivalente, use '{author_display_name}' como responsável.\n"
        "- Mantenha o nome da tarefa como o humano disse.\n"
        "- Só inclua tarefas que realmente parecem mudança de status, prazo ou responsável.\n"
        "- Se a mensagem não trouxer alteração concreta, devolva {\"updates\":[]}.\n"
        f"{previous_section}\n"
        "Catálogo atual do Kanban:\n"
        f"{catalog_snapshot}\n\n"
        "Mensagem do humano:\n"
        f"{message_text}"
    )


def _display_tipo(tipo: str) -> str:
    return "Projeto" if (tipo or "").lower().startswith("proj") else "Iniciativa"


def build_task_update_plan_from_message(message_text: str, author_display_name: str, previous_plan: dict | None = None) -> dict:
    import gemini_logic

    catalog_snapshot = kanban_service.build_task_catalog_prompt_snippet()
    prompt = _build_task_update_parser_prompt(message_text, author_display_name, catalog_snapshot, previous_plan=previous_plan)
    response = gemini_logic.client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": "Você extrai alterações de tarefas e responde apenas JSON válido."},
            {"role": "user", "content": prompt},
        ],
    )
    parsed = _extract_json_object_from_text(response.choices[0].message.content or "{}")
    updates = parsed.get("updates", [])
    return kanban_service.resolve_task_update_plan(updates, message_text, author_display_name)


async def send_chunked(channel, text: str, reply_to=None):
    chunks = chunk_message(text)
    for index, chunk in enumerate(chunks):
        if index == 0 and reply_to is not None:
            await reply_to.reply(chunk)
        else:
            await channel.send(chunk)


async def send_deploy_message():
    global deploy_announcement_sent

    if deploy_announcement_sent:
        return True

    try:
        channel = await bot.fetch_channel(settings.deploy_channel_id)
    except Exception as error:
        print(f"Nao encontrei o canal de deploy: {error}")
        return False

    try:
        recent_commits = github_client.get_recent_commit_subjects(limit=3)
        print(f"Commits recentes para aviso de deploy: {recent_commits}")
        await channel.send(build_deploy_message(recent_commits))
        deploy_announcement_sent = True
        return True
    except Exception as error:
        print(f"Erro ao buscar commit para aviso de deploy: {error}")
        try:
            await channel.send(build_deploy_fallback_message())
            deploy_announcement_sent = True
            return True
        except Exception as send_error:
            print(f"Erro ao enviar fallback de deploy: {send_error}")
            return False


async def ensure_deploy_announcement():
    for delay_seconds in (0, 5, 15):
        if delay_seconds:
            await asyncio.sleep(delay_seconds)
        if await send_deploy_message():
            return
    print("Falha final ao enviar aviso de deploy apos retries.")


async def ensure_background_tasks():
    for loop in (
        rotina_resumo_diario,
        reclamacao_10am,
        ronronado_surpresa,
        funcionario_da_semana,
        verificador_de_projetos,
        provocacao_operacional_semana,
        gargalo_da_semana,
        socios_sem_tarefa,
        checkin_tarefas_abertas_semana,
    ):
        if not loop.is_running():
            loop.start()


@bot.event
async def on_ready():
    print(f"Bot {bot.user} conectado com sucesso! Highlander ID: {HIGHLANDER_ID}")
    try:
        synced = await bot.tree.sync()
        print(f"Sincronizado {len(synced)} comando(s) slash.")
    except Exception as error:
        print(error)

    channel = management_channel()
    if channel:
        await resolve_runtime_member_mentions(getattr(channel, "guild", None))
        try:
            await channel.send(
                f"[HIGHLANDER-LOCK] Nova instancia acordou. Destruindo clones silenciosamente. ID: {HIGHLANDER_ID}"
            )
        except Exception:
            pass

    bot.loop.create_task(ensure_deploy_announcement())
    await ensure_background_tasks()


async def log_error_to_discord(error_msg: str):
    global last_error_time, error_spam_count

    current_time = time.time()
    if current_time - last_error_time > 60:
        error_spam_count = 0

    last_error_time = current_time
    error_spam_count += 1

    if error_spam_count > MAX_ERRORS_PER_MINUTE:
        print(f"ANTI-FLOOD ATIVADO: Suprimindo envio pro Discord para evitar loop. Erro real:\n{error_msg}")
        return

    try:
        channel = management_channel()
        if not channel:
            return

        if len(error_msg) > 1900:
            error_msg = "[Erro Truncado no Inicio]...\n" + error_msg[-1900:]

        if error_spam_count == MAX_ERRORS_PER_MINUTE:
            warning = (
                "[MUITOS ERROS SEGUIDOS - ANTI-FLOOD ATIVADO] "
                "O Mintzie vai desligar a sirene por 1 minuto.\n\n"
            )
            if len(error_msg) + len(warning) > 1900:
                error_msg = error_msg[len(warning):]
            error_msg = warning + error_msg

        await channel.send(f"[ALERTA CRITICO DE ERRO DO MINTZIE]\n```python\n{error_msg}\n```")
    except Exception as error:
        print(f"Falha ao tentar enviar log de erro pro Discord: {error}")


@bot.event
async def on_error(event, *args, **kwargs):
    err_type, err, tb = sys.exc_info()
    error_traceback = "".join(traceback.format_exception(err_type, err, tb))
    print(f"ERRO GLOBAL NO EVENTO {event}:\n{error_traceback}")
    await log_error_to_discord(f"Evento que falhou: {event}\n\n{error_traceback}")


@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: discord.app_commands.AppCommandError):
    error_traceback = "".join(traceback.format_exception(type(error), error, error.__traceback__))
    command_name = interaction.command.name if interaction.command else "desconhecido"
    print(f"ERRO DE COMANDO:\n{error_traceback}")
    await log_error_to_discord(
        f"Comando falhou: {command_name}\nUsuario: {interaction.user}\n\n{error_traceback}"
    )

    try:
        if not interaction.response.is_done():
            await interaction.response.send_message(
                "Um erro feio aconteceu e os desenvolvedores acabam de ser notificados na sala de gestao.",
                ephemeral=True,
            )
        else:
            await interaction.followup.send("Um erro interno feio aconteceu.", ephemeral=True)
    except Exception:
        pass


hora_10am = datetime.time(hour=10, minute=0, tzinfo=BRASILIA_TZ)


@tasks.loop(time=hora_10am)
async def reclamacao_10am():
    if not rituals_enabled_now():
        return

    channel = management_channel()
    if not channel:
        return

    inicio_dia = discord.utils.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    messages = [msg async for msg in channel.history(limit=50, after=inicio_dia) if msg.author != bot.user]
    if not messages:
        await channel.send(MORNING_NUDGE_MESSAGE)


@tasks.loop(minutes=1)
async def ronronado_surpresa():
    now = brasilia_now()
    if should_run_surprise_purr_ritual(now) and random.random() < (1.0 / 180.0):
        last_purr = night_watch_cache.get("last_purr", 0)
        if time.time() - last_purr > 43200:
            night_watch_cache["last_purr"] = time.time()
            channel = management_channel()
            if channel:
                await channel.send(SURPRISE_PURR_MESSAGE)


hora_sexta_17h = datetime.time(hour=17, minute=0, tzinfo=BRASILIA_TZ)


@tasks.loop(time=hora_sexta_17h)
async def funcionario_da_semana():
    if not should_run_employee_of_week_ritual(brasilia_now()):
        return

    channel = management_channel()
    if not channel:
        return

    org_data = github_client.get_organizacao()
    membros = org_data.get("members", ["Joãozíssimo", "Gui R", "Denis", "Stacke"]) if org_data else ["Joãozíssimo", "Gui R", "Denis", "Stacke"]
    escolhido = random.choice(membros)

    await channel.send(f"*Analisando o histórico de {escolhido} nos últimos 7 dias para o veredito do Servo da Semana...*")

    inicio_semana = discord.utils.utcnow() - datetime.timedelta(days=7)
    historico_escolhido = ""
    mensagens_count = 0

    for guild in bot.guilds:
        me = guild.me or guild.get_member(bot.user.id)
        for text_channel in guild.text_channels:
            try:
                perm = text_channel.permissions_for(me)
                if not perm.read_message_history or not perm.read_messages:
                    continue

                async for msg in text_channel.history(limit=500, after=inicio_semana):
                    if (
                        msg.author != bot.user
                        and escolhido.lower() in msg.author.display_name.lower()
                        and msg.content.strip()
                        and not msg.content.startswith("!")
                    ):
                        historico_escolhido += f"[{text_channel.name}] {msg.content}\n"
                        mensagens_count += 1
            except discord.errors.Forbidden:
                pass
            except Exception as error:
                print(error)

    if mensagens_count == 0:
        await channel.send(
            f"Pelo visto o **{escolhido}** passou a semana inteira dormindo mais do que eu, porque não achei nenhuma mensagem dele pra elogiar. Fica pra próxima!"
        )
        return

    prompt_llm = build_employee_of_week_prompt(escolhido, historico_escolhido)
    try:
        import gemini_logic

        response = gemini_logic.client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": "Você é o Mintzie. Aja exatamente como instruído no prompt."},
                {"role": "user", "content": prompt_llm},
            ],
        )
        await channel.send(response.choices[0].message.content)
    except Exception as error:
        print(f"Erro no funcionario da semana: {error}")


hora_9am = datetime.time(hour=9, minute=0, tzinfo=BRASILIA_TZ)


@tasks.loop(time=hora_9am)
async def verificador_de_projetos():
    if not rituals_enabled_now():
        return

    channel = management_channel()
    if not channel:
        return

    projetos_data = github_client.get_projetos()
    if not projetos_data:
        return

    hoje = brasilia_now().date()
    amanha = hoje + datetime.timedelta(days=1)
    mensagens_hoje = []
    mensagens_amanha = []

    def registrar_linha(data_alvo: datetime.date, texto: str):
        if data_alvo == hoje:
            mensagens_hoje.append(texto)
        elif data_alvo == amanha:
            mensagens_amanha.append(texto)

    for board in projetos_data.get("boards", []):
        for proj in board.get("cards", []):
            nome_proj = proj.get("title", "Projeto Desconhecido")
            lider = proj.get("owner") or proj.get("client") or "Equipe"
            lider_ref = _partner_reference_by_name(lider)

            for marco in proj.get("marcos_alinhamento", []):
                try:
                    data_marco = datetime.datetime.strptime(marco.get("data", ""), "%Y-%m-%d").date()
                    titulo = marco.get("titulo", "")
                    registrar_linha(
                        data_marco,
                        f"- **{titulo}**\n  Projeto: {nome_proj}\n  Responsável: {lider_ref}",
                    )
                except Exception:
                    pass

            lembretes = proj.get("lembretes_mintzie", {})
            for cp in lembretes.get("checkpoints", []):
                try:
                    data_cp = datetime.datetime.strptime(cp.get("data", ""), "%Y-%m-%d").date()
                    checkpoint_text = f"- **{cp.get('titulo')}**\n  Projeto: {nome_proj}"
                    if data_cp == hoje and cp.get("mensagem"):
                        checkpoint_text += f"\n  Recado do laboratório: {cp.get('mensagem')}"
                    registrar_linha(data_cp, checkpoint_text)
                except Exception:
                    pass

            fechamento = lembretes.get("fechamento", {})
            try:
                data_fech = datetime.datetime.strptime(fechamento.get("data", ""), "%Y-%m-%d").date()
                fechamento_text = f"- **Fechamento do projeto**\n  Projeto: {nome_proj}"
                if data_fech == hoje and fechamento.get("mensagem"):
                    fechamento_text += f"\n  Recado do laboratório: {fechamento.get('mensagem')}"
                registrar_linha(data_fech, fechamento_text)
            except Exception:
                pass

            upsell = lembretes.get("upsell", {})
            try:
                data_upsell = datetime.datetime.strptime(upsell.get("data", ""), "%Y-%m-%d").date()
                upsell_text = f"- **Movimento comercial**\n  Projeto: {nome_proj}"
                if data_upsell == hoje and upsell.get("mensagem"):
                    upsell_text += f"\n  Recado do laboratório: {upsell.get('mensagem')}"
                elif data_upsell == amanha:
                    upsell_text += "\n  Preparar proposta ou próximo empurrão comercial."
                registrar_linha(data_upsell, upsell_text)
            except Exception:
                pass

    if mensagens_hoje or mensagens_amanha:
        blocos = [
            "Bom dia, bons humanos.\n\n"
            "Passei pela bancada com meu jaleco impecável, uma dose mínima de palhaçaria científica e o dever moral de evitar desastres evitáveis.\n\n"
            "Aqui estão os checkpoints que realmente importam entre hoje e amanhã:"
        ]

        if mensagens_hoje:
            blocos.append("**Hoje**\n" + "\n\n".join(mensagens_hoje))

        if mensagens_amanha:
            blocos.append("**Amanhã**\n" + "\n\n".join(mensagens_amanha))

        blocos.append(
            "Se algo estiver fora do lugar, ajustem a bancada agora.\n\n"
            "Vocês são bons humanos. Não me façam desperdiçar esse raro momento de apreciação felina."
        )

        await channel.send("\n\n".join(blocos))


hora_provocacao_semana = datetime.time(hour=11, minute=11, tzinfo=BRASILIA_TZ)


@tasks.loop(time=hora_provocacao_semana)
async def provocacao_operacional_semana():
    now = brasilia_now()
    if not should_run_weekly_provocation_ritual(now):
        return

    channel = management_channel()
    if not channel:
        return

    snapshot = kanban_service.get_operational_snapshot(reference_date=now.date())
    await channel.send(build_operational_provocation_message(snapshot))


hora_gargalo_semana = datetime.time(hour=15, minute=30, tzinfo=BRASILIA_TZ)


@tasks.loop(time=hora_gargalo_semana)
async def gargalo_da_semana():
    now = brasilia_now()
    if not should_run_weekly_bottleneck_ritual(now):
        return

    channel = management_channel()
    if not channel:
        return

    snapshot = kanban_service.get_operational_snapshot(reference_date=now.date())
    await channel.send(build_weekly_bottleneck_message(snapshot))


hora_socios_sem_tarefa = datetime.time(hour=9, minute=30, tzinfo=BRASILIA_TZ)


@tasks.loop(time=hora_socios_sem_tarefa)
async def socios_sem_tarefa():
    now = brasilia_now()
    if not should_run_partner_workload_nudge_ritual(now):
        return

    channel = management_channel()
    if not channel:
        return

    await send_low_workload_nudges(channel)


hora_checkin_tarefas_abertas = datetime.time(hour=15, minute=45, tzinfo=BRASILIA_TZ)


@tasks.loop(time=hora_checkin_tarefas_abertas)
async def checkin_tarefas_abertas_semana():
    now = brasilia_now()
    if not should_run_partner_open_tasks_checkin_ritual(now):
        return

    channel = management_channel()
    if not channel:
        return

    await send_open_tasks_checkins(channel)


hora_resumo = datetime.time(hour=18, minute=0, tzinfo=BRASILIA_TZ)


async def gerar_e_enviar_resumo(destination_channel):
    try:
        if not rituals_enabled_now():
            return

        inicio_dia = discord.utils.utcnow() - datetime.timedelta(days=1)
        historico_str = ""

        for guild in bot.guilds:
            me = guild.me or guild.get_member(bot.user.id)
            for canal in guild.text_channels:
                try:
                    perm = canal.permissions_for(me)
                    if not perm.read_message_history or not perm.read_messages:
                        continue

                    messages = [
                        msg
                        async for msg in canal.history(limit=100, after=inicio_dia)
                        if msg.author != bot.user and msg.content.strip() and not msg.content.startswith("!")
                    ]
                    if not messages:
                        continue

                    historico_str += f"\n--- Canal: #{canal.name} ---\n"
                    messages.reverse()
                    for msg in messages:
                        hora_str = msg.created_at.astimezone(BRASILIA_TZ).strftime("%H:%M")
                        historico_str += f"[{hora_str}] {msg.author.display_name}: {msg.content}\n"
                except discord.errors.Forbidden:
                    pass
                except Exception as error:
                    print(f"Erro ao ler canal {canal.name}: {error}")

        if not historico_str.strip():
            await destination_channel.send(NO_DAILY_DISCUSSION_MESSAGE)
            return

        await resolve_runtime_member_mentions(getattr(destination_channel, "guild", None))
        prompt_llm = build_daily_summary_prompt(historico_str, RUNTIME_MEMBER_MENTIONS)

        import gemini_logic

        await destination_channel.send(SUMMARY_THINKING_MESSAGE)
        response = gemini_logic.client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {
                    "role": "system",
                    "content": "Você é o Mintzie, guardião do laboratório maluco da NETZ, um gato superior e sarcástico encarregado de fazer resumos executivos diários do Discord com ironia felina, linguagem de laboratório e foco brutal em execução.",
                },
                {"role": "user", "content": prompt_llm},
            ],
        )
        resumo_texto = response.choices[0].message.content
        await send_chunked(destination_channel, resumo_texto)
    except Exception as error:
        error_traceback = "".join(traceback.format_exception(type(error), error, error.__traceback__))
        print(f"Erro ao gerar resumo: {error}")
        await destination_channel.send("Ocorreu um erro ao gerar o resumo das últimas 24 horas.")
        await log_error_to_discord(f"Erro na Rotina de Resumo:\n{error_traceback}")


@tasks.loop(time=hora_resumo)
async def rotina_resumo_diario():
    channel = management_channel()
    if channel:
        await gerar_e_enviar_resumo(channel)


@bot.tree.command(name="rotina_resumo", description="Força a geração do resumo das conversas das últimas 24h")
async def cmd_rotina_resumo(interaction: discord.Interaction):
    await interaction.response.defer(thinking=False)
    await interaction.followup.send("Processando o resumo do dia, humanos...")
    await gerar_e_enviar_resumo(interaction.channel)


@bot.tree.command(name="teste_funcionario", description="[Teste] Roda a rotina do Funcionario da Semana agora")
async def cmd_teste_funcionario(interaction: discord.Interaction):
    await interaction.response.defer(thinking=False)
    await interaction.followup.send("Processando a leitura semanal... Preparem os petiscos.")
    await funcionario_da_semana.coro()


@bot.tree.command(name="teste_projetos_manus", description="[Teste] Vasculha os tarefas.json e alerta as datas imediatamente")
async def cmd_teste_projetos(interaction: discord.Interaction):
    await interaction.response.defer(thinking=False)
    await interaction.followup.send("Lendo projetos no GitHub... procurando pendências para hoje ou amanhã...")
    await verificador_de_projetos.coro()


@bot.tree.command(name="teste_deploy_msg", description="[Teste] Envia agora a mensagem de deploy no canal configurado")
async def cmd_teste_deploy_msg(interaction: discord.Interaction):
    global deploy_announcement_sent

    deploy_announcement_sent = False
    await interaction.response.defer(thinking=False, ephemeral=True)
    success = await send_deploy_message()
    if success:
        await interaction.followup.send("Mensagem de deploy enviada para o canal configurado.", ephemeral=True)
    else:
        await interaction.followup.send("Falhei em enviar a mensagem de deploy. Vale olhar os logs.", ephemeral=True)


@bot.tree.command(name="teste_provocacao_semana", description="[Teste] Envia agora a provocação operacional da semana")
async def cmd_teste_provocacao_semana(interaction: discord.Interaction):
    snapshot = kanban_service.get_operational_snapshot(reference_date=brasilia_now().date())
    await interaction.response.send_message(build_operational_provocation_message(snapshot))


@bot.tree.command(name="teste_gargalo_semana", description="[Teste] Envia agora a mensagem de gargalo da semana")
async def cmd_teste_gargalo_semana(interaction: discord.Interaction):
    snapshot = kanban_service.get_operational_snapshot(reference_date=brasilia_now().date())
    await interaction.response.send_message(build_weekly_bottleneck_message(snapshot))


@bot.tree.command(name="teste_socios_sem_tarefa", description="[Teste] Cutuca sócios com menos de 3 tarefas ativas")
async def cmd_teste_socios_sem_tarefa(interaction: discord.Interaction):
    await resolve_runtime_member_mentions(interaction.guild)
    workload = kanban_service.get_partner_workload_snapshot(
        PARTNER_WORKLOAD_TARGETS,
        threshold=LOW_WORKLOAD_THRESHOLD,
    )
    nudges = [
        build_low_workload_nudge_message(partner, LOW_WORKLOAD_THRESHOLD)
        for partner in workload["low_workload_partners"]
    ]
    if not nudges:
        await interaction.response.send_message(
            "Inacreditavelmente, os sócios estão com carga suficiente hoje. Vou observar em silêncio por enquanto."
        )
        return

    await interaction.response.send_message("\n\n".join(nudges))


@bot.tree.command(name="teste_checkin_tarefas_abertas", description="[Teste] Envia o check-in de terça e quinta das tarefas em aberto")
async def cmd_teste_checkin_tarefas_abertas(interaction: discord.Interaction):
    await resolve_runtime_member_mentions(interaction.guild)
    workload = kanban_service.get_partner_workload_snapshot(
        PARTNER_WORKLOAD_TARGETS,
        threshold=LOW_WORKLOAD_THRESHOLD,
    )
    messages = [build_open_tasks_checkin_message(partner) for partner in workload["partners"]]
    await interaction.response.send_message("\n\n".join(messages))


@bot.event
async def on_message(message: discord.Message):
    if message.author == bot.user and message.content.startswith("[HIGHLANDER-LOCK]"):
        if HIGHLANDER_ID not in message.content:
            print("OUTRA INSTANCIA INICIOU. Eu sou um clone obsoleto. Desligando-me permanentemente...")
            await bot.close()
            sys.exit(0)
        try:
            await message.delete()
        except Exception:
            pass
        return

    if message.author == bot.user:
        return

    if _has_fresh_pending_task_update(message):
        pending_key = _task_update_pending_key(message)
        pending_plan = pending_task_update_plans[pending_key]
        clean_pending_text = message.content.strip()

        if _is_confirmation_message(clean_pending_text):
            result = kanban_service.execute_task_update_plan(
                pending_plan,
                actor_name=message.author.display_name,
                channel_id=str(message.channel.id),
                user_id=str(message.author.id),
            )
            pending_task_update_plans.pop(pending_key, None)
            if result.get("status") == "success":
                await send_chunked(message.channel, _build_plan_execution_summary(result), reply_to=message)
            else:
                await message.reply(result.get("message", "Falhei ao aplicar as alteracoes."))
            await bot.process_commands(message)
            return

        if _is_cancel_message(clean_pending_text):
            pending_task_update_plans.pop(pending_key, None)
            await message.reply("Plano descartado. Nenhuma pata tocou no Kanban.")
            await bot.process_commands(message)
            return

        try:
            revised_plan = build_task_update_plan_from_message(
                clean_pending_text,
                message.author.display_name,
                previous_plan=pending_plan,
            )
        except Exception:
            error_traceback = traceback.format_exc()
            print(f"Erro ao revisar plano pendente:\n{error_traceback}")
            await message.reply(
                "Tentei revisar o plano pendente e derrubei um béquer mental. Reescreva o ajuste de forma mais direta."
            )
            await log_error_to_discord(
                f"Erro ao revisar plano pendente:\nMensagem de {message.author}: {clean_pending_text}\n\n{error_traceback}"
            )
            await bot.process_commands(message)
            return

        if revised_plan.get("status") != "success":
            await message.reply(revised_plan.get("message", "Nao consegui revisar o plano pendente."))
            await bot.process_commands(message)
            return

        revised_plan["created_at"] = time.time()
        pending_task_update_plans[pending_key] = revised_plan
        await send_chunked(message.channel, kanban_service.format_task_update_plan(revised_plan), reply_to=message)
        await bot.process_commands(message)
        return

    rituals_enabled = rituals_enabled_now()
    now = brasilia_now()
    if should_run_night_watch_ritual(now):
        last_complaint = night_watch_cache.get(message.author.id, 0)
        if time.time() - last_complaint > 3600:
            night_watch_cache[message.author.id] = time.time()
            replies = [message_template.format(mention=message.author.mention) for message_template in NIGHT_WATCH_MESSAGES]
            await message.reply(random.choice(replies))

    channel_id = message.channel.id
    gossip_tracker.setdefault(channel_id, [])
    gossip_tracker[channel_id].append(time.time())
    gossip_tracker[channel_id] = [t for t in gossip_tracker[channel_id] if time.time() - t <= 120]

    if rituals_enabled and len(gossip_tracker[channel_id]) >= 10:
        last_gossip = gossip_cooldown.get(channel_id, 0)
        if time.time() - last_gossip > 3600:
            gossip_cooldown[channel_id] = time.time()
            await message.channel.send(random.choice(GOSSIP_MESSAGES))

    try:
        print(f"LOG MESSAGE: {message.content} FROM: {message.author}")
    except (TypeError, UnicodeEncodeError):
        print(f"LOG MESSAGE: <Mensagem não compatível com o terminal> FROM: {message.author}")

    bot_mention = f"<@{bot.user.id}>"
    if bot.user in message.mentions or bot_mention in message.content or any(
        role.name.lower() == "mintzie" for role in message.role_mentions
    ):
        clean_prompt = message.content.replace(bot_mention, "").strip()
        for role in message.role_mentions:
            if role.name.lower() == "mintzie":
                clean_prompt = clean_prompt.replace(f"<@&{role.id}>", "").strip()

        if not clean_prompt:
            await message.reply(EMPTY_PROMPT_REPLY)
            return

        if _looks_like_task_update_request(clean_prompt):
            try:
                proposed_plan = build_task_update_plan_from_message(clean_prompt, message.author.display_name)
            except Exception:
                error_traceback = traceback.format_exc()
                print(f"Erro ao propor plano de alteracoes:\n{error_traceback}")
                await message.reply(
                    "Tentei estruturar as alterações de tarefa e derrubei reagente no parser. Vou precisar que você tente de novo."
                )
                await log_error_to_discord(
                    f"Erro ao propor plano de alteracoes:\nMensagem de {message.author}: {clean_prompt}\n\n{error_traceback}"
                )
                await bot.process_commands(message)
                return

            if proposed_plan.get("status") == "success" and proposed_plan.get("operations"):
                proposed_plan["created_at"] = time.time()
                pending_task_update_plans[_task_update_pending_key(message)] = proposed_plan
                await send_chunked(message.channel, kanban_service.format_task_update_plan(proposed_plan), reply_to=message)
                await bot.process_commands(message)
                return

            if proposed_plan.get("status") == "error":
                await message.reply(proposed_plan.get("message", "Nao consegui estruturar esse pedido de alteracao."))
                await bot.process_commands(message)
                return

        async with message.channel.typing():
            try:
                import gemini_logic

                session_id = str(message.channel.id)
                chat_session = gemini_logic.get_chat_session(session_id)

                channel_name = message.channel.name if hasattr(message.channel, "name") else "DM"
                category_name = (
                    message.channel.category.name
                    if hasattr(message.channel, "category") and message.channel.category
                    else "Sem Categoria"
                )
                data_formatada = brasilia_now().strftime("%A, %d de %B de %Y as %H:%M (Horario de Brasilia)").capitalize()
                contexto = (
                    f"\n\n[CONTEXTO DO CHAT: Data/Hora atual: {data_formatada}. "
                    f"Você está respondendo no canal #{channel_name} dentro da categoria '{category_name}']"
                )
                prompt_enriquecido = f"[Mensagem de: {message.author.display_name}] {clean_prompt} {contexto}"

                response = chat_session.send_message(prompt_enriquecido)
                response_text = response.text
                await send_chunked(message.channel, response_text, reply_to=message)
            except Exception:
                error_traceback = traceback.format_exc()
                print(f"Erro na IA:\n{error_traceback}")
                await message.reply(
                    "Tive uma indigestão de bola de pelo. Ocorreu um erro interno cruel. Mandando os logs pros servos arrumarem."
                )
                await log_error_to_discord(
                    f"Erro de IA:\nMensagem de {message.author}: {clean_prompt}\n\n{error_traceback}"
                )

    await bot.process_commands(message)


@bot.tree.command(name="ping", description="Testar conexão")
async def ping(interaction: discord.Interaction):
    await interaction.response.send_message("Pong! O Assistente NETZ está online.")


@bot.tree.command(name="projetos", description="Listar todos os projetos em andamento no Kanban")
async def listar_projetos(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)

    data = github_client.get_projetos()
    if not data:
        await interaction.followup.send("Não foi possível carregar os projetos no momento.")
        return

    embed = discord.Embed(title="Projetos Ativos NETZ", color=discord.Color.blue())
    board = data.get("boards", [{}])[0]
    cards = board.get("cards", [])

    if not cards:
        embed.description = "Nenhum projeto encontrado."
    else:
        for card in cards:
            title = card.get("title", "Sem título")
            client = card.get("client", "Indefinido")
            col = card.get("column", "Sem status")
            health = card.get("health_status", "N/A")
            tasks = card.get("tasks", [])
            tasks_str = ""
            if tasks:
                pending = [task for task in tasks if task.get("status") == "pending"]
                tasks_str = f"| {len(pending)} tarefa(s) pendente(s)"

            embed.add_field(
                name=f"[{col}] {title}",
                value=f"Cliente: {client}\nSaúde: {health} {tasks_str}",
                inline=False,
            )

    await interaction.followup.send(embed=embed)


@bot.tree.command(name="iniciativas", description="Listar todas as iniciativas internas no Kanban")
async def listar_iniciativas(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)

    data = github_client.get_iniciativas()
    if not data:
        await interaction.followup.send("Não foi possível carregar as iniciativas no momento.")
        return

    embed = discord.Embed(title="Experimentos Internos NETZ", color=discord.Color.green())
    board = data.get("boards", [{}])[0]
    cards = board.get("cards", [])

    if not cards:
        embed.description = "Nenhuma iniciativa encontrada."
    else:
        for card in cards:
            title = card.get("title", "Sem título")
            owner = card.get("owner", "Time")
            col = card.get("column", "Sem status")
            embed.add_field(name=f"[{col}] {title}", value=f"Responsável: {owner}", inline=False)

    await interaction.followup.send(embed=embed)


@bot.tree.command(name="equipe", description="Lista os membros da NETZ")
async def equipe(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)
    data = github_client.get_organizacao()

    if not data:
        await interaction.followup.send("Não foi possível carregar os dados da organização.")
        return

    embed = discord.Embed(
        title=f"Organização {data.get('name', 'NETZ')}",
        url=data.get("website", ""),
        color=discord.Color.purple(),
    )
    members = data.get("members", [])
    embed.add_field(name="Membros", value="\n".join([f"- {member}" for member in members]), inline=False)
    await interaction.followup.send(embed=embed)


if __name__ == "__main__":
    if not TOKEN or TOKEN == "YOUR_DISCORD_BOT_TOKEN_HERE":
        print("AVISO: Adicione o DISCORD_TOKEN no arquivo .env para iniciar o bot.")
    else:
        bot.run(TOKEN)
