FROM node:22-alpine
WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY services ./services
COPY shared ./shared
COPY mocks ./mocks
COPY scripts/mock-hub.mjs ./scripts/mock-hub.mjs
ENV HOST=0.0.0.0
USER node
CMD ["node", "services/server.mjs"]
