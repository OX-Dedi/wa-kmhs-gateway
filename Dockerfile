FROM node:20-slim

# Install dependencies yang dibutuhkan jika ada
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Buat folder penyimpanan autentikasi sesi WA
RUN mkdir -p auth_info

EXPOSE 3000

CMD ["node", "server.js"]
