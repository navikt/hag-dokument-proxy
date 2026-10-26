FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/node:24-slim
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
COPY node_modules ./node_modules
COPY src ./src
COPY dist ./dist
EXPOSE 3000
CMD ["src/server.js"]