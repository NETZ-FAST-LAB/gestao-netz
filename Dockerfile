# Usar uma imagem oficial leve do Python
FROM python:3.13-slim

# Instalar o git para leitura dos logs do repositório
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Definir o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copiar os arquivos de requisitos e instalar dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar todo o código do bot para o contêiner
COPY . .

# Comando para rodar o bot
CMD ["python", "Bot/bot.py"]
