# Build and test against the target Chainguard Node 24 version
FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/node:26-dev AS builder
USER root
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY src ./src
COPY dist ./dist
COPY test ./test

RUN npm install -g --force --ignore-scripts "$(node -p "require('./package.json').packageManager.split('+')[0]")"

RUN --mount=type=secret,id=NODE_AUTH_TOKEN \
    printf '//npm.pkg.github.com/:_authToken=%s\n' "$(cat /run/secrets/NODE_AUTH_TOKEN)" > /root/.npmrc && \
    pnpm install --frozen-lockfile --ignore-scripts && \
    rm -f /root/.npmrc

RUN pnpm test --run && pnpm prune --prod --ignore-scripts

# Production image
FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/node:26-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000
CMD ["src/server.js"]
