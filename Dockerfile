# Usar uma imagem oficial leve do Python
FROM python:3.13-slim

# Definir o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copiar os arquivos de requisitos e instalar dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar todo o código do bot para o contêiner
COPY . .

# Comando para rodar o bot
CMD ["python", "Bot/bot.py"]
