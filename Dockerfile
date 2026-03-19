FROM node:20-alpine

WORKDIR /app

RUN npm init -y && \
    npm install @modelcontextprotocol/sdk pg express

COPY server.js .

EXPOSE 3000

CMD ["node", "server.js"]
