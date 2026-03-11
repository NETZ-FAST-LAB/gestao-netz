import os
import discord
from discord.ext import commands, tasks
from dotenv import load_dotenv
import github_client
import datetime
import traceback
import sys
import time
import uuid
import random

load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN", None)
HIGHLANDER_ID = str(uuid.uuid4())

# Setup intent and bot instance
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f'Bot {bot.user} conectado com sucesso! Highlander ID: {HIGHLANDER_ID}')
    try:
        synced = await bot.tree.sync()
        print(f"Sincronizado {len(synced)} comando(s) slash.")
    except Exception as e:
        print(e)
        
    canal_gestao_id = 1479226481782554634
    canal = bot.get_channel(canal_gestao_id)
    if canal:
        try:
            await canal.send(f"[HIGHLANDER-LOCK] Nova instância acordou. Destruindo clones silenciosamente. ID: {HIGHLANDER_ID}")
        except:
            pass
            
    # Inicia as rotinas se não estiverem rodando
    if not lembrete_fim_de_dia.is_running():
        lembrete_fim_de_dia.start()
    if not rotina_resumo_diario.is_running():
        rotina_resumo_diario.start()
    if not reclamacao_10am.is_running():
        reclamacao_10am.start()
    if not hora_do_catnip.is_running():
        hora_do_catnip.start()
    if not ronronado_surpresa.is_running():
        ronronado_surpresa.start()
    if not funcionario_da_semana.is_running():
        funcionario_da_semana.start()
    if not verificador_de_projetos.is_running():
        verificador_de_projetos.start()

# --- REMOTE LOGGING ---
last_error_time = 0
error_spam_count = 0
MAX_ERRORS_PER_MINUTE = 3

async def log_error_to_discord(error_msg: str):
    """Envia erros graves diretamente para o canal de Gestão para que você saiba na hora!"""
    global last_error_time, error_spam_count
    
    current_time = time.time()
    
    # Reset flood counter if it's been more than 60 seconds
    if current_time - last_error_time > 60:
        error_spam_count = 0
        
    last_error_time = current_time
    error_spam_count += 1
    
    if error_spam_count > MAX_ERRORS_PER_MINUTE:
        print(f"ANTI-FLOOD ATIVADO: Suprimindo envio pro Discord para evitar loop. Erro real:\n{error_msg}")
        return
        
    try:
        canal_gestao_id = 1479226481782554634
        canal = bot.get_channel(canal_gestao_id)
        if canal:
            if len(error_msg) > 1900:
                error_msg = "[Erro Truncado no Início]...\n" + error_msg[-1900:]
                
            if error_spam_count == MAX_ERRORS_PER_MINUTE:
                warning = "⚠️ **MUITOS ERROS SEGUIDOS (ANTI-FLOOD ATIVADO)! O Mintzie vai desligar a sirene por 1 minuto.** ⚠️\n\n"
                # Garante que vai caber subtraindo o tamanho do aviso
                if len(error_msg) + len(warning) > 1900:
                    error_msg = error_msg[len(warning):]
                error_msg = warning + error_msg
                
            await canal.send(f"🚨 **ALERTA CRÍTICO DE ERRO DO MINTZIE** 🚨\n```python\n{error_msg}\n```")
    except Exception as e:
        print(f"Falha ao tentar enviar log de erro pro Discord: {e}")

@bot.event
async def on_error(event, *args, **kwargs):
    """Captura exceções globais silenciosas que geralmente matam eventos silenciosamente."""
    err_type, err, tb = sys.exc_info()
    error_traceback = "".join(traceback.format_exception(err_type, err, tb))
    print(f"ERRO GLOBAL NO EVENTO {event}:\n{error_traceback}")
    await log_error_to_discord(f"Evento que falhou: {event}\n\n{error_traceback}")

@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: discord.app_commands.AppCommandError):
    """Captura falhas nos comandos de barra (/iniciativas, etc)"""
    error_traceback = "".join(traceback.format_exception(type(error), error, error.__traceback__))
    print(f"ERRO DE COMANDO:\n{error_traceback}")
    await log_error_to_discord(f"Comando falhou: {interaction.command.name if interaction.command else 'Descoecido'}\nUsuário: {interaction.user}\n\n{error_traceback}")
    
    try:
         if not interaction.response.is_done():
              await interaction.response.send_message("❌ Um erro feio aconteceu e os desenvolvedores acabam de ser notificados na sala de gestão.", ephemeral=True)
         else:
              await interaction.followup.send("❌ Um erro interno feio aconteceu.", ephemeral=True)
    except:
         pass
# ----------------------
# ROTINAS DE PERSONALIDADE (RITUAIS ALEATÓRIOS DO MINTZIE)

hora_10am = datetime.time(hour=10, minute=0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3)))
@tasks.loop(time=hora_10am)
async def reclamacao_10am():
    # Only run Monday to Friday (0 = Mon, 4 = Fri)
    if datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).weekday() > 4:
        return
        
    canal_gestao_tarefas_id = 1479226481782554634
    canal = bot.get_channel(canal_gestao_tarefas_id)
    if not canal: return
    
    # Check if there were any messages today (from midnight to 10am)
    inicio_dia = discord.utils.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    messages = [msg async for msg in canal.history(limit=50, after=inicio_dia) if msg.author != bot.user]
    
    if len(messages) == 0:
        await canal.send("Bom dia pra vocês também, viu? Aparentemente educação virou luxo nessa empresa. Trabalhar que é bom, nada. 😾")


hora_1620 = datetime.time(hour=16, minute=20, tzinfo=datetime.timezone(datetime.timedelta(hours=-3)))
@tasks.loop(time=hora_1620)
async def hora_do_catnip():
    # Run only on Tuesdays (1) and Thursdays (3)
    weekday = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).weekday()
    if weekday not in [1, 3]:
        return
        
    canal_gestao_tarefas_id = 1479226481782554634
    canal = bot.get_channel(canal_gestao_tarefas_id)
    if canal:
        await canal.send("🌿 **4:20!** Pausa pro Catnip! Meu cérebro felino precisa expandir as perspectivas pro bem dessa empresa.")


@tasks.loop(minutes=1)
async def ronronado_surpresa():
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3)))
    # Only between 14:00 and 17:00
    if 14 <= now.hour < 17:
        # Avoid multiple purrs in the same day by checking cache
        # Approx 1/180 chance every minute = high chance of 1 purr within those 3 hours
        if random.random() < (1.0 / 180.0):
            last_purr = night_watch_cache.get('last_purr', 0)
            if time.time() - last_purr > 43200: # 12 hours cooldown
                night_watch_cache['last_purr'] = time.time()
                canal_gestao_tarefas_id = 1479226481782554634
                canal = bot.get_channel(canal_gestao_tarefas_id)
                if canal:
                    await canal.send("Prrr... Prrr... 🐈 Só passei pra deixar esse ronronado motivacional. Não se acostumem, só fiz isso porque tô de barriga cheia.")

hora_sexta_17h = datetime.time(hour=17, minute=0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3)))
@tasks.loop(time=hora_sexta_17h)
async def funcionario_da_semana():
    # Only run on Fridays (4)
    weekday = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).weekday()
    if weekday != 4:
        return
        
    canal_gestao_tarefas_id = 1479226481782554634
    canal = bot.get_channel(canal_gestao_tarefas_id)
    if not canal: return

    # Sorteia um membro (podemos pegar do organizacao.json ou hardcoded)
    import github_client
    org_data = github_client.get_organizacao()
    membros = org_data.get("members", ["Joãozíssimo", "Gui R", "Dênis", "Stacke"]) if org_data else ["Joãozíssimo", "Gui R", "Dênis", "Stacke"]
    escolhido = random.choice(membros)
    
    await canal.send(f"🐈 *Analisando o histórico de {escolhido} nos últimos 7 dias para o veredito do Servo da Semana...*")
    
    inicio_semana = discord.utils.utcnow() - datetime.timedelta(days=7)
    historico_escolhido = ""
    mensagens_count = 0
    
    for guild in bot.guilds:
        for text_channel in guild.text_channels:
            try:
                perm = text_channel.permissions_for(guild.me)
                if not perm.read_message_history or not perm.read_messages:
                    continue
                
                async for msg in text_channel.history(limit=500, after=inicio_semana):
                    if msg.author != bot.user and escolhido.lower() in msg.author.display_name.lower() and msg.content.strip() and not msg.content.startswith("!"):
                        historico_escolhido += f"[{text_channel.name}] {msg.content}\n"
                        mensagens_count += 1
            except discord.errors.Forbidden:
                pass
            except Exception as e:
                print(e)
                
    if mensagens_count == 0:
         await canal.send(f"🏆 Pelo visto o **{escolhido}** passou a semana inteira dormindo mais do que eu, porque não achei nenhuma mensagem dele pra elogiar. Fica pra próxima!")
         return
         
    prompt_llm = f"""Você é o Mintzie, assistente felino sarcástico da NETZ.
Hoje é sexta-feira e você decidiu eleger o "Servo da Semana", que é o humano **{escolhido}**.

Baseado nas frases que ele disse no Discord essa semana (abaixo), escreva um post curto de apreciação para ele. Se engrandeça por ser um chefe tão benevolente. Agradeça o empenho do humano, faça alguma menção engraçada ao que ele andou falando, e encerre pedindo um carinho (cafuné) ou sachê como tributo obrigatório.

FRASES DA SEMANA DO {escolhido.upper()}:
{historico_escolhido[-3000:]} # Limitado por segurança
"""

    try:
        import gemini_logic
        response = gemini_logic.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Você é o Mintzie. Aja exatamente como instruído no prompt."},
                {"role": "user", "content": prompt_llm}
            ]
        )
        await canal.send(response.choices[0].message.content)
    except Exception as e:
        print(f"Erro no funcionario da semana: {e}")

hora_9am = datetime.time(hour=9, minute=0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3)))
@tasks.loop(time=hora_9am)
async def verificador_de_projetos():
    # Only run Monday to Friday (0 = Mon, 4 = Fri)
    if datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).weekday() > 4:
        return
        
    canal_gestao_tarefas_id = 1479226481782554634
    canal = bot.get_channel(canal_gestao_tarefas_id)
    if not canal: return

    import github_client
    projetos_data = github_client.get_projetos()
    if not projetos_data: return
    
    hoje = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).date()
    amanha = hoje + datetime.timedelta(days=1)
    
    mensagens_para_enviar = []
    
    for board in projetos_data.get("boards", []):
        for proj in board.get("cards", []):
            nome_proj = proj.get("title", "Projeto Desconhecido")
            lider = proj.get("owner", "Equipe")
            
            # 1. Alinhamentos (marcos_alinhamento)
            for marco in proj.get("marcos_alinhamento", []):
                try:
                    data_marco = datetime.datetime.strptime(marco.get("data", ""), "%Y-%m-%d").date()
                    titulo = marco.get("titulo", "")
                    if data_marco == hoje:
                        mensagens_para_enviar.append(f"🚨 **HOJE:** {titulo} (Projeto: {nome_proj}) - Resp: {lider}")
                    elif data_marco == amanha:
                        mensagens_para_enviar.append(f"⏰ **AMANHÃ:** {titulo} (Projeto: {nome_proj}) - Resp: {lider}")
                except Exception: pass
                
            # 2. Lembretes Mintzie (checkpoints, fechamento, upsell)
            lembretes = proj.get("lembretes_mintzie", {})
            
            # Checkpoints
            for cp in lembretes.get("checkpoints", []):
                try:
                    data_cp = datetime.datetime.strptime(cp.get("data", ""), "%Y-%m-%d").date()
                    if data_cp == hoje:
                        mensagens_para_enviar.append(f"⚠️ **CHECKPOINT HOJE:** {cp.get('titulo')} - {cp.get('mensagem')} (Projeto: {nome_proj})")
                    elif data_cp == amanha:
                        mensagens_para_enviar.append(f"⏰ **CHECKPOINT AMANHÃ:** {cp.get('titulo')} (Projeto: {nome_proj})")
                except Exception: pass
                
            # Fechamento
            fechamento = lembretes.get("fechamento", {})
            try:
                data_fech = datetime.datetime.strptime(fechamento.get("data", ""), "%Y-%m-%d").date()
                if data_fech == hoje:
                    mensagens_para_enviar.append(f"🏁 **FECHAMENTO DO PROJETO HOJE:** {nome_proj}. {fechamento.get('mensagem')}")
                elif data_fech == amanha:
                    mensagens_para_enviar.append(f"⏰ **FECHAMENTO DO PROJETO AMANHÃ:** {nome_proj}")
            except Exception: pass
            
            # Upsell
            upsell = lembretes.get("upsell", {})
            try:
                data_upsell = datetime.datetime.strptime(upsell.get("data", ""), "%Y-%m-%d").date()
                if data_upsell == hoje:
                    mensagens_para_enviar.append(f"💰 **UPSELL HOJE:** {nome_proj}. {upsell.get('mensagem')}")
                elif data_upsell == amanha:
                    mensagens_para_enviar.append(f"⏰ **UPSELL AMANHÃ:** Preparar proposta para {nome_proj}")
            except Exception: pass
        
    if mensagens_para_enviar:
        resumo = "🐈 *Bom dia, humanos! Aqui estão as prioridades e checkpoints absolutos dos projetos para hoje e amanhã:*\n\n> "
        resumo += "\n> ".join(mensagens_para_enviar)
        await canal.send(resumo)

# ----------------------

# Configura o horário de Brasília (UTC-3) para 19:19
hora_rotina = datetime.time(hour=19, minute=19, tzinfo=datetime.timezone(datetime.timedelta(hours=-3)))

@tasks.loop(time=hora_rotina)
async def lembrete_fim_de_dia():
    canal_gestao_tarefas_id = 1479226481782554634
    canal = bot.get_channel(canal_gestao_tarefas_id)
    
    if canal:
        mensagem = (
            "🐈 **Miau! O expediente está acabando, humanos.**\n\n"
            "Vão descansar e deixem tudo organizado para os próximos dias.\n"
            "Por favor, revisem o nosso Kanban e cadastrem as novas tarefas para não esquecermos de nada amanhã!"
        )
        await canal.send(mensagem)
    else:
        print(f"ERRO: Canal de ID {canal_gestao_tarefas_id} não encontrado para enviar o lembrete.")

# Configura o horário de Brasília (UTC-3) para 18:00
hora_resumo = datetime.time(hour=18, minute=0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3)))

async def gerar_e_enviar_resumo(destination_channel):
    try:
        inicio_dia = discord.utils.utcnow() - datetime.timedelta(days=1)
        historico_str = ""
        
        for guild in bot.guilds:
            for canal in guild.text_channels:
                try:
                    # Verifica permissões do bot no canal
                    perm = canal.permissions_for(guild.me)
                    if not perm.read_message_history or not perm.read_messages:
                        continue
                    
                    messages = [msg async for msg in canal.history(limit=100, after=inicio_dia) if msg.author != bot.user and msg.content.strip() and not msg.content.startswith("!")]
                    if not messages:
                        continue
                        
                    historico_str += f"\n--- Canal: #{canal.name} ---\n"
                    # Inverte para ordem cronológica
                    messages.reverse()
                    for msg in messages:
                        hora_str = msg.created_at.astimezone(datetime.timezone(datetime.timedelta(hours=-3))).strftime("%H:%M")
                        historico_str += f"[{hora_str}] {msg.author.display_name}: {msg.content}\n"
                        
                except discord.errors.Forbidden:
                    # Ignorar silenciosamente canais inacessíveis
                    pass
                except Exception as e:
                    print(f"Erro ao ler canal {canal.name}: {e}")
                    
        if not historico_str.strip():
             await destination_channel.send("😾 Nenhuma discussão foi encontrada nas últimas 24 horas para resumir. Vocês trabalharam hoje?")
             return
             
        prompt_llm = f"""Baseado no histórico do Discord abaixo, crie um resumo executivo brilhante das últimas 24 horas.

INSTRUÇÕES DE FORMATO:
1. Comece de forma enérgica e celebrativa ("Viva! Bravo!"), vibrando que os projetos estão vivos e pulsantes, e incorpore os canais monitorados diretamente nesse parágrafo introdutório.
2. Faça um Resumo Executivo das principais discussões divididas por tópicos/iniciativas. Oculte a seção de "Gargalos".
3. Use os nomes dos sócios/pessoas envolvidas explicitamente no texto e abuse de apelidos, mas **NÃO MARQUE ELES COM '@' DURANTE O TEXTO**.
4. No final do resumo crie a seção "Provocações Geniais", focada em fazer a NETZ crescer exponencialmente com o mínimo esforço, substituindo as recomendações rotineiras.
5. Muito Importante: **SOMENTE NO ÚLTIMO PARÁGRAFO** ("Call to Action"), você deve marcar as pessoas envolvidas usando estritamente o '@' seguido do nome/ID delas, convidando-os a revisar o que precisa virar tarefa no Kanban.

Abaixo o histórico das mensagens das últimas 24 horas:

{historico_str}"""

        import gemini_logic
        await destination_channel.send("🐈 *Afiando as garras e lendo telepaticamente todos os canais para o resumo diário...*")
        
        # Chama o LLM via wrapper direto do cliente
        response = gemini_logic.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Você é o Mintzie, assistente da NETZ encarregado de fazer resumos executivos diários do Discord com seu tom irônico felino peculiar, mas focado profissionalmente nos alinhamentos corporativos."},
                {"role": "user", "content": prompt_llm}
            ]
        )
        resumo_texto = response.choices[0].message.content
        
        # Paginação para evitar limite de 2000 chars do Discord
        chunks = [resumo_texto[i:i+1900] for i in range(0, len(resumo_texto), 1900)]
        for chunk in chunks:
            await destination_channel.send(chunk)
            
    except Exception as e:
        error_traceback = "".join(traceback.format_exception(type(e), e, e.__traceback__))
        print(f"Erro ao gerar resumo: {e}")
        await destination_channel.send("❌ Ocorreu um erro ao gerar o resumo das últimas 24 horas.")
        await log_error_to_discord(f"Erro na Rotina de Resumo:\n{error_traceback}")

@tasks.loop(time=hora_resumo)
async def rotina_resumo_diario():
    canal_gestao_tarefas_id = 1479226481782554634
    canal = bot.get_channel(canal_gestao_tarefas_id)
    if canal:
        await gerar_e_enviar_resumo(canal)

@bot.tree.command(name="rotina_resumo", description="Força a geração do resumo das conversas das últimas 24h")
async def cmd_rotina_resumo(interaction: discord.Interaction):
    await interaction.response.defer(thinking=False)
    # Responde à interação deferida para não dar timeout, depois chama a função que já joga no canal
    await interaction.followup.send("Processando o resumo do dia, humanos...")
    await gerar_e_enviar_resumo(interaction.channel)

@bot.tree.command(name="teste_funcionario", description="[Teste] Roda a rotina do Funcionário da Semana agora")
async def cmd_teste_funcionario(interaction: discord.Interaction):
    await interaction.response.defer(thinking=False)
    await interaction.followup.send("Processando a leitura semanal... Preparem os petiscos.")
    # Extraímos a lógica interna da task pra função ser reusável, mas para o teste vou chamar a corrotina interna do loop
    await funcionario_da_semana.coro()

@bot.tree.command(name="teste_catnip", description="[Teste] Roda a mensagem das 16:20 do Catnip")
async def cmd_teste_catnip(interaction: discord.Interaction):
    await interaction.response.send_message("🌿 **4:20!** Pausa pro Catnip! Meu cérebro felino precisa expandir as perspectivas pro bem dessa empresa.")

@bot.tree.command(name="teste_projetos_manus", description="[Teste] Vasculha os tarefas.json e alerta as datas imediatamente")
async def cmd_teste_projetos(interaction: discord.Interaction):
    await interaction.response.defer(thinking=False)
    await interaction.followup.send("Lendo projetos no Github... procurando pendências para hoje ou amanhã...")
    await verificador_de_projetos.coro()

# -- CACHES DE EVENTOS DO BOT ---
night_watch_cache = {}
gossip_tracker = {}
gossip_cooldown = {}

@bot.event
async def on_message(message: discord.Message):
    # --- HIGHLANDER LOCK ---
    # Garante que apenas 1 instância rode globalmente (A mais recente mata a mais velha)
    if message.author == bot.user and message.content.startswith("[HIGHLANDER-LOCK]"):
        if HIGHLANDER_ID not in message.content:
            print("🚨 OUTRA INSTÂNCIA INICIOU (Ex: Alguém ligou a VPS). Eu sou um clone obsoleto. Desligando-me permanentemente...")
            await bot.close()
            sys.exit(0)
        else:
            # Sou a instância nova e soberana. Apago a própria mensagem de trava pra não poluir o canal
            try:
                await message.delete()
            except:
                pass
        return

    # Ignore messages from the bot itself IMMEDIATELY to prevent infinite logging loops
    if message.author == bot.user:
        return
        
    # --- VIGILANTE NOTURNO & DETECTOR DE FOFOCA ---
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3)))
    
    # Vigilante Noturno (22:00 até 05:59)
    if now.hour >= 22 or now.hour < 6:
        # Verifica cache pra nao flodar o coitado que tá virado
        last_complaint = night_watch_cache.get(message.author.id, 0)
        if time.time() - last_complaint > 3600:  # 1 hora de cooldown por pessoa
            night_watch_cache[message.author.id] = time.time()
            v_msgs = [
                f"Humano {message.author.mention}, você trabalhar depois do horário não te faz um herói, só faz você gastar a luz que deveria estar sendo convertida em sachê pra mim. Vai dormir, o servidor não vai fugir. 🦇",
                f"Já olhou a hora, {message.author.mention}? Os gatos de rua já tão todos dormindo e você aí nas planilhas. Vai deitar! 😾"
            ]
            await message.reply(random.choice(v_msgs))

    # Detector de Fofoca (10 msgs em 2 minutos no mesmo canal)
    ch_id = message.channel.id
    if ch_id not in gossip_tracker:
        gossip_tracker[ch_id] = []
    
    # Add now and purge old ones (> 120 secs)
    gossip_tracker[ch_id].append(time.time())
    gossip_tracker[ch_id] = [t for t in gossip_tracker[ch_id] if time.time() - t <= 120]
    
    if len(gossip_tracker[ch_id]) >= 10:
        last_gossip = gossip_cooldown.get(ch_id, 0)
        if time.time() - last_gossip > 3600: # 1 hr cooldown
            gossip_cooldown[ch_id] = time.time()
            g_msgs = [
                "Muito 'digita-digita' nesse canal pra pouca tarefa sendo arrastada no Kanban. Tô de olho na fofoca de vocês. Trabalhem direito! 👁️",
                "Quanta falação! Continuem a fofoca, humano precisa se comunicar, eu entendo... Mas espero que estejam entregando projeto também! 🐾"
            ]
            await message.channel.send(random.choice(g_msgs))
        
    try:
        print(f"LOG MESSAGE: {message.content} FROM: {message.author}")
    except TypeError:
        pass
    except UnicodeEncodeError:
        print(f"LOG MESSAGE: <Mensagem possui emojis não compativeis com o terminal> FROM: {message.author}")

    # Process AI interaction if the bot is mentioned (user or role)
    bot_mention = f"<@{bot.user.id}>"
    if bot.user in message.mentions or bot_mention in message.content or any(role.name.lower() == "mintzie" for role in message.role_mentions):
        
        # Strip the mention from the message to send clean text to Gemini
        clean_prompt = message.content.replace(bot_mention, '').strip()
        # Fallback to remove role mention text if its id is present
        for role in message.role_mentions:
            if role.name.lower() == "mintzie":
                clean_prompt = clean_prompt.replace(f"<@&{role.id}>", "").strip()
        
        if not clean_prompt:
             await message.reply("O que foi, humano? Me acordou pra quê?")
             return

        # Show typing indicator while Gemini is thinking
        async with message.channel.typing():
            try:
                import gemini_logic
                # Use channel id or thread id for session persistence to keep context
                session_id = str(message.channel.id) 
                chat_session = gemini_logic.get_chat_session(session_id)
                
                # Context Awareness: Let the AI know where it is replying and what time it is
                channel_name = message.channel.name if hasattr(message.channel, 'name') else "DM"
                category_name = message.channel.category.name if hasattr(message.channel, 'category') and message.channel.category else "Sem Categoria"
                
                agora = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3)))
                data_formatada = agora.strftime("%A, %d de %B de %Y as %H:%M (Horário de Brasília)").capitalize()
                
                contexto = f"\n\n[CONTEXTO DO CHAT: Data/Hora atual: {data_formatada}. Você está respondendo no canal #{channel_name} dentro da categoria '{category_name}']"
                prompt_enriquecido = f"[Mensagem de: {message.author.display_name}] {clean_prompt} {contexto}"
                
                response = chat_session.send_message(prompt_enriquecido)
                
                # Send the final response from the cat, paginated if necessary
                response_text = response.text
                if len(response_text) <= 2000:
                    await message.reply(response_text)
                else:
                    # Discord's strict limit is 2000 characters per message
                    # Split into chunks of 1900 to be safe and avoid cutting markdown mid-word if possible
                    chunks = []
                    while len(response_text) > 0:
                        if len(response_text) <= 1900:
                            chunks.append(response_text)
                            break
                        
                        # Find the last newline within the 1900 limit to break cleanly
                        split_index = response_text.rfind('\n', 0, 1900)
                        if split_index == -1:
                            # If no newline, find the last space
                            split_index = response_text.rfind(' ', 0, 1900)
                            
                        if split_index == -1:
                            # If no space, just hard cut at 1900
                            split_index = 1900
                            
                        chunks.append(response_text[:split_index])
                        response_text = response_text[split_index:].lstrip()
                        
                    for count, chunk in enumerate(chunks):
                        if count == 0:
                            await message.reply(chunk)
                        else:
                            await message.channel.send(chunk)
                            
            except Exception as e:
                error_traceback = traceback.format_exc()
                print(f"Erro na IA:\n{error_traceback}")
                await message.reply("Tive uma indigestão de bola de pelo. Ocorreu um erro interno cruel. Mandando os logs pros servos arrumarem.")
                await log_error_to_discord(f"Erro de IA:\nMensagem de {message.author}: {clean_prompt}\n\n{error_traceback}")

    # Always needed so the slash commands keep working
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
        
    embed = discord.Embed(title="🚀 Projetos Ativos NETZ", color=discord.Color.blue())
    
    # Simple loop formatting all projects available in the first board
    board = data.get("boards", [])[0]
    cards = board.get("cards", [])
    
    if not cards:
        embed.description = "Nenhum projeto encontrado."
    else:
        for card in cards:
            title = card.get("title", "Sem título")
            client = card.get("client", "Indefinido")
            col = card.get("column", "Sem status")
            health = card.get("health_status", "N/A")
            
            # Formata a exibição das tasks (se houver)
            tasks = card.get("tasks", [])
            tasks_str = ""
            if tasks:
                pending = [t for t in tasks if t.get("status") == "pending"]
                tasks_str = f"| 📋 {len(pending)} tarefa(s) pendente(s)"
                
            embed.add_field(
                name=f"[{col}] {title}", 
                value=f"Cliente: {client}\nSaúde: {health} {tasks_str}", 
                inline=False
            )
            
    await interaction.followup.send(embed=embed)


@bot.tree.command(name="iniciativas", description="Listar todas as iniciativas internas no Kanban")
async def listar_iniciativas(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)
    
    data = github_client.get_iniciativas()
    if not data:
        await interaction.followup.send("Não foi possível carregar as iniciativas no momento.")
        return
        
    embed = discord.Embed(title="💡 Iniciativas Internas NETZ", color=discord.Color.green())
    
    board = data.get("boards", [])[0]
    cards = board.get("cards", [])
    
    if not cards:
        embed.description = "Nenhuma iniciativa encontrada."
    else:
        for card in cards:
            title = card.get("title", "Sem título")
            owner = card.get("owner", "Time")
            col = card.get("column", "Sem status")
            
            embed.add_field(
                name=f"[{col}] {title}", 
                value=f"Responsável: {owner}", 
                inline=False
            )
            
    await interaction.followup.send(embed=embed)

@bot.tree.command(name="equipe", description="Lista os membros da NETZ")
async def equipe(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)
    data = github_client.get_organizacao()
    
    if not data:
        await interaction.followup.send("Não foi possível carregar os dados da organização.")
        return
        
    embed = discord.Embed(title=f"Organização {data.get('name', 'NETZ')}", url=data.get('website', ''), color=discord.Color.purple())
    members = data.get("members", [])
    m_str = "\n".join([f"• {m}" for m in members])
    
    embed.add_field(name="Membros", value=m_str, inline=False)
    await interaction.followup.send(embed=embed)


if __name__ == "__main__":
    if not TOKEN or TOKEN == "YOUR_DISCORD_BOT_TOKEN_HERE":
        print("AVISO: Adicione o DISCORD_TOKEN no arquivo .env para iniciar o bot.")
    else:
        bot.run(TOKEN)
