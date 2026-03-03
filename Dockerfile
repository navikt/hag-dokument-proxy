FROM node:24-alpine
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
COPY node_modules ./node_modules
COPY src ./src
COPY dist ./dist
EXPOSE 3000
CMD ["node", "src/server.js"]