FROM gcr.io/distroless/nodejs24-debian12@sha256:61f4f4341db81820c24ce771b83d202eb6452076f58628cd536cc7d94a10978b
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
COPY node_modules ./node_modules
COPY src ./src
COPY dist ./dist
EXPOSE 3000
CMD ["node", "src/server.js"]