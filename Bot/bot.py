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
            
    # Inicia a rotina de encerramento do expediente se não estiver rodando
    if not lembrete_fim_de_dia.is_running():
        lembrete_fim_de_dia.start()

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
                prompt_enriquecido = f"[Mensagem de: {message.author.display_name}] {clean_prompt}"
                response = chat_session.send_message(prompt_enriquecido)
                
                # Send the final response from the cat
                await message.reply(response.text)
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
