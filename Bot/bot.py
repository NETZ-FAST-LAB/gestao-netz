import asyncio
import datetime
import random
import sys
import time
import traceback
import uuid

import discord
from discord.ext import commands, tasks

import github_client
from config import settings
from mintzie_persona import (
    CATNIP_MESSAGE,
    DAY_END_REMINDER,
    EMPTY_PROMPT_REPLY,
    GOSSIP_MESSAGES,
    MORNING_NUDGE_MESSAGE,
    NIGHT_WATCH_MESSAGES,
    NO_DAILY_DISCUSSION_MESSAGE,
    SUMMARY_THINKING_MESSAGE,
    SURPRISE_PURR_MESSAGE,
    build_daily_summary_prompt,
    build_deploy_fallback_message,
    build_deploy_message,
    build_employee_of_week_prompt,
)
from rituals import (
    should_run_catnip_ritual,
    should_run_employee_of_week_ritual,
    should_run_general_ritual,
    should_run_night_watch_ritual,
    should_run_surprise_purr_ritual,
)

HIGHLANDER_ID = str(uuid.uuid4())
BRASILIA_TZ = datetime.timezone(datetime.timedelta(hours=-3))

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)
TOKEN = settings.discord_token

night_watch_cache = {}
gossip_tracker = {}
gossip_cooldown = {}
deploy_announcement_sent = False
last_error_time = 0
error_spam_count = 0
MAX_ERRORS_PER_MINUTE = 3


def brasilia_now() -> datetime.datetime:
    return datetime.datetime.now(BRASILIA_TZ)


def rituals_enabled_now() -> bool:
    return should_run_general_ritual(brasilia_now())


def management_channel():
    return bot.get_channel(settings.management_channel_id)


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
        lembrete_fim_de_dia,
        rotina_resumo_diario,
        reclamacao_10am,
        hora_do_catnip,
        ronronado_surpresa,
        funcionario_da_semana,
        verificador_de_projetos,
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


hora_1620 = datetime.time(hour=16, minute=20, tzinfo=BRASILIA_TZ)


@tasks.loop(time=hora_1620)
async def hora_do_catnip():
    if not should_run_catnip_ritual(brasilia_now()):
        return

    channel = management_channel()
    if channel:
        await channel.send(CATNIP_MESSAGE)


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
    membros = org_data.get("members", ["Joaozissimo", "Gui R", "Denis", "Stacke"]) if org_data else ["Joaozissimo", "Gui R", "Denis", "Stacke"]
    escolhido = random.choice(membros)

    await channel.send(f"*Analisando o historico de {escolhido} nos ultimos 7 dias para o veredito do Servo da Semana...*")

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
            f"Pelo visto o **{escolhido}** passou a semana inteira dormindo mais do que eu, porque nao achei nenhuma mensagem dele pra elogiar. Fica pra proxima!"
        )
        return

    prompt_llm = build_employee_of_week_prompt(escolhido, historico_escolhido)
    try:
        import gemini_logic

        response = gemini_logic.client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": "Voce e o Mintzie. Aja exatamente como instruido no prompt."},
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
    mensagens_para_enviar = []

    for board in projetos_data.get("boards", []):
        for proj in board.get("cards", []):
            nome_proj = proj.get("title", "Projeto Desconhecido")
            lider = proj.get("owner") or proj.get("client") or "Equipe"

            for marco in proj.get("marcos_alinhamento", []):
                try:
                    data_marco = datetime.datetime.strptime(marco.get("data", ""), "%Y-%m-%d").date()
                    titulo = marco.get("titulo", "")
                    if data_marco == hoje:
                        mensagens_para_enviar.append(f"HOJE: {titulo} (Projeto: {nome_proj}) - Resp: {lider}")
                    elif data_marco == amanha:
                        mensagens_para_enviar.append(f"AMANHA: {titulo} (Projeto: {nome_proj}) - Resp: {lider}")
                except Exception:
                    pass

            lembretes = proj.get("lembretes_mintzie", {})
            for cp in lembretes.get("checkpoints", []):
                try:
                    data_cp = datetime.datetime.strptime(cp.get("data", ""), "%Y-%m-%d").date()
                    if data_cp == hoje:
                        mensagens_para_enviar.append(
                            f"CHECKPOINT HOJE: {cp.get('titulo')} - {cp.get('mensagem')} (Projeto: {nome_proj})"
                        )
                    elif data_cp == amanha:
                        mensagens_para_enviar.append(f"CHECKPOINT AMANHA: {cp.get('titulo')} (Projeto: {nome_proj})")
                except Exception:
                    pass

            fechamento = lembretes.get("fechamento", {})
            try:
                data_fech = datetime.datetime.strptime(fechamento.get("data", ""), "%Y-%m-%d").date()
                if data_fech == hoje:
                    mensagens_para_enviar.append(
                        f"FECHAMENTO DO PROJETO HOJE: {nome_proj}. {fechamento.get('mensagem')}"
                    )
                elif data_fech == amanha:
                    mensagens_para_enviar.append(f"FECHAMENTO DO PROJETO AMANHA: {nome_proj}")
            except Exception:
                pass

            upsell = lembretes.get("upsell", {})
            try:
                data_upsell = datetime.datetime.strptime(upsell.get("data", ""), "%Y-%m-%d").date()
                if data_upsell == hoje:
                    mensagens_para_enviar.append(f"UPSELL HOJE: {nome_proj}. {upsell.get('mensagem')}")
                elif data_upsell == amanha:
                    mensagens_para_enviar.append(f"UPSELL AMANHA: Preparar proposta para {nome_proj}")
            except Exception:
                pass

    if mensagens_para_enviar:
        resumo = "*Bom dia, humanos! Aqui estao as prioridades e checkpoints absolutos dos projetos para hoje e amanha:*\n\n> "
        resumo += "\n> ".join(mensagens_para_enviar)
        await channel.send(resumo)


hora_rotina = datetime.time(hour=19, minute=19, tzinfo=BRASILIA_TZ)


@tasks.loop(time=hora_rotina)
async def lembrete_fim_de_dia():
    if not rituals_enabled_now():
        return

    channel = management_channel()
    if channel:
        await channel.send(DAY_END_REMINDER)
    else:
        print(f"ERRO: Canal de ID {settings.management_channel_id} nao encontrado para enviar o lembrete.")


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

        prompt_llm = build_daily_summary_prompt(historico_str)

        import gemini_logic

        await destination_channel.send(SUMMARY_THINKING_MESSAGE)
        response = gemini_logic.client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {
                    "role": "system",
                    "content": "Voce e o Mintzie, assistente da NETZ encarregado de fazer resumos executivos diarios do Discord com seu tom ironico felino peculiar, mas focado profissionalmente nos alinhamentos corporativos.",
                },
                {"role": "user", "content": prompt_llm},
            ],
        )
        resumo_texto = response.choices[0].message.content
        chunks = [resumo_texto[i : i + 1900] for i in range(0, len(resumo_texto), 1900)]
        for chunk in chunks:
            await destination_channel.send(chunk)
    except Exception as error:
        error_traceback = "".join(traceback.format_exception(type(error), error, error.__traceback__))
        print(f"Erro ao gerar resumo: {error}")
        await destination_channel.send("Ocorreu um erro ao gerar o resumo das ultimas 24 horas.")
        await log_error_to_discord(f"Erro na Rotina de Resumo:\n{error_traceback}")


@tasks.loop(time=hora_resumo)
async def rotina_resumo_diario():
    channel = management_channel()
    if channel:
        await gerar_e_enviar_resumo(channel)


@bot.tree.command(name="rotina_resumo", description="Forca a geracao do resumo das conversas das ultimas 24h")
async def cmd_rotina_resumo(interaction: discord.Interaction):
    await interaction.response.defer(thinking=False)
    await interaction.followup.send("Processando o resumo do dia, humanos...")
    await gerar_e_enviar_resumo(interaction.channel)


@bot.tree.command(name="teste_funcionario", description="[Teste] Roda a rotina do Funcionario da Semana agora")
async def cmd_teste_funcionario(interaction: discord.Interaction):
    await interaction.response.defer(thinking=False)
    await interaction.followup.send("Processando a leitura semanal... Preparem os petiscos.")
    await funcionario_da_semana.coro()


@bot.tree.command(name="teste_catnip", description="[Teste] Roda a mensagem das 16:20 do Catnip")
async def cmd_teste_catnip(interaction: discord.Interaction):
    await interaction.response.send_message(CATNIP_MESSAGE)


@bot.tree.command(name="teste_projetos_manus", description="[Teste] Vasculha os tarefas.json e alerta as datas imediatamente")
async def cmd_teste_projetos(interaction: discord.Interaction):
    await interaction.response.defer(thinking=False)
    await interaction.followup.send("Lendo projetos no Github... procurando pendencias para hoje ou amanha...")
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
        print(f"LOG MESSAGE: <Mensagem nao compativel com o terminal> FROM: {message.author}")

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
                    f"Voce esta respondendo no canal #{channel_name} dentro da categoria '{category_name}']"
                )
                prompt_enriquecido = f"[Mensagem de: {message.author.display_name}] {clean_prompt} {contexto}"

                response = chat_session.send_message(prompt_enriquecido)
                response_text = response.text
                if len(response_text) <= 2000:
                    await message.reply(response_text)
                else:
                    chunks = []
                    while response_text:
                        if len(response_text) <= 1900:
                            chunks.append(response_text)
                            break

                        split_index = response_text.rfind("\n", 0, 1900)
                        if split_index == -1:
                            split_index = response_text.rfind(" ", 0, 1900)
                        if split_index == -1:
                            split_index = 1900

                        chunks.append(response_text[:split_index])
                        response_text = response_text[split_index:].lstrip()

                    for index, chunk in enumerate(chunks):
                        if index == 0:
                            await message.reply(chunk)
                        else:
                            await message.channel.send(chunk)
            except Exception:
                error_traceback = traceback.format_exc()
                print(f"Erro na IA:\n{error_traceback}")
                await message.reply(
                    "Tive uma indigestao de bola de pelo. Ocorreu um erro interno cruel. Mandando os logs pros servos arrumarem."
                )
                await log_error_to_discord(
                    f"Erro de IA:\nMensagem de {message.author}: {clean_prompt}\n\n{error_traceback}"
                )

    await bot.process_commands(message)


@bot.tree.command(name="ping", description="Testar conexao")
async def ping(interaction: discord.Interaction):
    await interaction.response.send_message("Pong! O Assistente NETZ esta online.")


@bot.tree.command(name="projetos", description="Listar todos os projetos em andamento no Kanban")
async def listar_projetos(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)

    data = github_client.get_projetos()
    if not data:
        await interaction.followup.send("Nao foi possivel carregar os projetos no momento.")
        return

    embed = discord.Embed(title="Projetos Ativos NETZ", color=discord.Color.blue())
    board = data.get("boards", [{}])[0]
    cards = board.get("cards", [])

    if not cards:
        embed.description = "Nenhum projeto encontrado."
    else:
        for card in cards:
            title = card.get("title", "Sem titulo")
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
                value=f"Cliente: {client}\nSaude: {health} {tasks_str}",
                inline=False,
            )

    await interaction.followup.send(embed=embed)


@bot.tree.command(name="iniciativas", description="Listar todas as iniciativas internas no Kanban")
async def listar_iniciativas(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)

    data = github_client.get_iniciativas()
    if not data:
        await interaction.followup.send("Nao foi possivel carregar as iniciativas no momento.")
        return

    embed = discord.Embed(title="Iniciativas Internas NETZ", color=discord.Color.green())
    board = data.get("boards", [{}])[0]
    cards = board.get("cards", [])

    if not cards:
        embed.description = "Nenhuma iniciativa encontrada."
    else:
        for card in cards:
            title = card.get("title", "Sem titulo")
            owner = card.get("owner", "Time")
            col = card.get("column", "Sem status")
            embed.add_field(name=f"[{col}] {title}", value=f"Responsavel: {owner}", inline=False)

    await interaction.followup.send(embed=embed)


@bot.tree.command(name="equipe", description="Lista os membros da NETZ")
async def equipe(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)
    data = github_client.get_organizacao()

    if not data:
        await interaction.followup.send("Nao foi possivel carregar os dados da organizacao.")
        return

    embed = discord.Embed(
        title=f"Organizacao {data.get('name', 'NETZ')}",
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
