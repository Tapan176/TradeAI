FROM node:20-alpine
WORKDIR /app
COPY package.json server.js engine.js fno.js signals.js ./
COPY public ./public
COPY replay ./replay
COPY lab ./lab
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
