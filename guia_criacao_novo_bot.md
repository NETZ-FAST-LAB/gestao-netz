# Guia para Criação de um Novo Bot (Clone)

Com base na engenharia reversa do código base de bots já existentes (`bot.py`, `gemini_logic.py`, `github_client.py`), aqui está a arquitetura e os passos para configurar um novo bot em outro servidor com outra personalidade, mantendo as mesmas funções baseadas em IA e GitHub.

## 🧠 Como a base do bot funciona (A Arquitetura)
O sistema do bot é modular e está dividido em 3 arquivos principais:

1. **`bot.py` (O Cérebro do Discord):** Conecta no Discord usando o `DISCORD_TOKEN`. Ele contém comandos nativos de barra (slash commands como `/projetos`, `/iniciativas`) e fica "escutando" as mensagens. Se a mensagem mencionar o bot diretamente ou o cargo designado a ele no servidor, ele limpa o texto, repassa para o Gemini e devolve a resposta no chat.
2. **`gemini_logic.py` (A Alma e Inteligência):** Conecta na API do Google Gemini. Aqui fica o **Prompt de Sistema** (`SYSTEM_INSTRUCTION`) que dita a personalidade do bot. Também é aqui que as "Ferramentas da IA" (Tools) são definidas (criar tarefa, listar, editar, etc.), permitindo que o Gemini saiba o que ele pode ou não fazer e execute essas ações lógicas.
3. **`github_client.py` (O Braço Operacional):** Esse arquivo pega as decisões e informações preparadas pela IA e as executa no mundo real, lendo e escrevendo nos arquivos de banco de dados JSON (ex: `projetos.json`, `iniciativas.json`) diretamente via API de repositórios do GitHub.

---

## 🛠️ Passo a passo para criar o "Novo Bot"

Se a ideia é ter um bot em outro servidor, mas mantendo a mesma lógica de ler/escrever dados JSON atrelados ao GitHub usando IA, siga este roteiro:

### 1. Preparação Externa
* **Discord Developer Portal:** Crie um novo "Application" (um novo bot), gere um novo link de convite para adicionar no outro servidor e pegue o novo **Token do Discord**.
* **Repositório GitHub (Opcional):** Se o novo bot for gerenciar os mesmos JSONs de um projeto existente, você usará o mesmo repositório e token. Se ele for gerenciar projetos/iniciativas de outra base, você precisará de um repositório separado, gerar um novo `GITHUB_TOKEN` e configurar o nome correto em `GITHUB_REPO`.

### 2. Criar os Arquivos e Variáveis de Ambiente (`.env`)
Você precisará copiar os arquivos Python base (`bot.py`, `gemini_logic.py`, `github_client.py`) para um novo diretório e criar um arquivo `.env` ao lado deles contendo:
```env
DISCORD_TOKEN=seu_novo_token_de_bot_do_discord_aqui
GEMINI_API_KEY=sua_chave_do_gemini
GITHUB_TOKEN=seu_token_github
GITHUB_REPO=nome_do_usuario/nome_do_repositorio
```

### 3. Alterar a Personalidade no `gemini_logic.py`
Encontre a constante `SYSTEM_INSTRUCTION` no arquivo `gemini_logic.py`.
* Substitua o texto atual pelas regras da nova personalidade desejada.
* **Importante:** Mantenha a lista numerada de ações essenciais (ex: *"Você tem acesso a ferramentas para:"*) e as *"Regras Estritas de Comportamento"* de estrutura. Essas são as regras de máquina para o bot interagir adequadamente com os arquivos e interpretar as requisições de ferramentas. Você deve alterar **apenas** a forma como ele fala, reage e trata os usuários nas instruções de texto livre.

### 4. Remover/Alterar Referências Específicas no `bot.py`
No arquivo `bot.py`, o código que intercepta mensagens no `on_message` geralmente procura pelo cargo específico do bot antigo para decidir se a mensagem é para ele (ex: `if role.name.lower() == "nome_do_cargo_antigo":`).
**O que mudar:** Substitua essas verificações pelo nome exato do novo cargo que você dará a esse bot no novo servidor do Discord. Coloque sempre em letras minúsculas no código. Isso garante que o bot responderá adequadamente quando o cargo for mencionado. Outra opção é focar apenas na marcação direta de usuário, mantendo apenas verificação de `bot.user in message.mentions`.

### 5. Checar Caminhos dos Arquivos
Se o novo bot for trabalhar numa base de dados diferente ou com outra estrutura de diretórios, você precisará entrar nos arquivos de código (principalmente `gemini_logic.py` e `github_client.py`) e fazer um "Localizar e Substituir" dos caminhos dos JSONs modificando caminhos estáticos ou pastas para se adaptarem à raiz do seu novo repositório GitHub.

---

## 🚀 Execução e Hospedagem (Local e VPS)

O plano é começar rodando o bot localmente para testes e, em seguida, migrá-lo para uma VPS (Virtual Private Server) para mantê-lo online 24/7.

### Rodando Localmente (Testes)
1. Certifique-se de ter o Python instalado.
2. Instale as dependências usando os comandos abaixo:
   ```bash
   pip install discord.py google-generativeai PyGithub python-dotenv
   ```
3. Com o `.env` configurado, execute o bot no terminal:
   ```bash
   python bot.py
   ```
4. O bot deverá aparecer online no seu servidor do Discord. Use `Ctrl+C` no seu terminal para parar a execução.

### Deploy na VPS (Produção 24/7)
Para manter o bot rodando de forma contínua na sua VPS:

1. **Acesso à VPS:** Acesse sua VPS via SSH (`ssh root@ip_da_vps` ou o usuário fornecido).
2. **Transferir Arquivos:** Envie os arquivos do bot (`bot.py`, `gemini_logic.py`, `github_client.py` e o arquivo `.env`) para a VPS. Você pode usar ferramentas como `scp`, FileZilla (SFTP) ou versionamento via GitHub (`git clone`).
3. **Preparar o Ambiente na VPS:**
   * Atualize os pacotes do sistema (se for Ubuntu/Debian):
     ```bash
     sudo apt update && sudo apt upgrade -y
     sudo apt install python3 python3-pip python3-venv -y
     ```
   * Crie uma pasta para o bot (ex: `mkdir meu_bot && cd meu_bot`).
   * (Opcional, mas recomendado) Crie e ative um ambiente virtual:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   * Instale as dependências:
     ```bash
     pip install discord.py google-generativeai PyGithub python-dotenv
     ```
4. **Rodando em Segundo Plano (Background):**
   Para que o bot não pare de rodar quando você fechar a janela do SSH, é recomendável usar um gerenciador de processos.

   **Opção A - Usando `nohup` (modo rápido e simples):**
   ```bash
   nohup python3 bot.py > bot.log 2>&1 &
   ```
   *(O bot continuará rodando com logs salvos em `bot.log`. Para pará-lo depois, use `ps aux | grep bot.py` para achar o PID e `kill [PID]`.)*

   **Opção B - Usando `systemd` (modo profissional, reinicia sozinho se crachar ou servidor reiniciar):**
   * Crie um arquivo de serviço: `sudo nano /etc/systemd/system/meubot.service`
   * Cole esta configuração (ajuste os caminhos):
     ```ini
     [Unit]
     Description=Bot Discord
     After=network.target

     [Service]
     User=root
     WorkingDirectory=/caminho/para/pasta/do/bot
     ExecStart=/usr/bin/python3 /caminho/para/pasta/do/bot/bot.py
     Restart=always

     [Install]
     WantedBy=multi-user.target
     ```
   * Ative e inicie o serviço:
     ```bash
     sudo systemctl enable meubot.service
     sudo systemctl start meubot.service
     ```
     *(Acompanhe os logs com: `sudo journalctl -u meubot.service -f`)*

---

**Resumo da Obra:** Duplique os 3 arquivos originais para o novo ambiente, atualize as credenciais no `.env`, configure o nome e as menções no `bot.py`, escreva a nova instrução formatada no `gemini_logic.py` e verifique os caminhos dos JSONs apontados. Teste e valide executando **localmente**. Quando tudo estiver funcional, faça o deploy na **VPS** usando os passos acima para que o bot passe a rodar 24h por dia, monitorando e atualizando a sua base com autonomia.
