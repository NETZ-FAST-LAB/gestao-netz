import os
import discord
from discord.ext import commands
from dotenv import load_dotenv
import github_client

load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN")

# Setup intent and bot instance
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f'Bot {bot.user} conectado com sucesso!')
    try:
        synced = await bot.tree.sync()
        print(f"Sincronizado {len(synced)} comando(s) slash.")
    except Exception as e:
        print(e)

@bot.event
async def on_message(message: discord.Message):
    # Ignore messages from the bot itself
    if message.author == bot.user:
        return

    # Process AI interaction if the bot is mentioned
    if bot.user in message.mentions:
        # Strip the mention from the message to send clean text to Gemini
        clean_prompt = message.content.replace(f'<@{bot.user.id}>', '').strip()
        
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
                response = chat_session.send_message(clean_prompt)
                
                # Send the final response from the cat
                await message.reply(response.text)
            except Exception as e:
                import traceback
                print(f"Erro na IA:\n{traceback.format_exc()}")
                await message.reply("Tive uma indigestão de bola de pelo. Ocorreu um erro interno. Verifique o terminal.")

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
