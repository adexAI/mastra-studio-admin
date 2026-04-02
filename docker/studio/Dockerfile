FROM node:22-slim AS builder

# Install pnpm
ENV PNPM_VERSION=10.29.3
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json tsconfig.json tsconfig.build.json tsconfig.node.json ./

# Copy only packages needed for the build
COPY packages/playground/package.json packages/playground/
COPY packages/playground-ui/package.json packages/playground-ui/

# Copy all other package.json files (required by pnpm workspace resolution)
COPY packages/ packages/
COPY workflows/ workflows/
COPY stores/ stores/
COPY voice/ voice/
COPY deployers/ deployers/
COPY auth/ auth/
COPY workspaces/ workspaces/
COPY mastracode/ mastracode/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build args for runtime configuration
ARG MASTRA_SERVER_HOST="https://chatdev.adex.network/mastra"
ARG MASTRA_SERVER_PORT="443"
ARG MASTRA_SERVER_PROTOCOL="https"
ARG MASTRA_STUDIO_BASE_PATH=""
ARG MASTRA_HIDE_CLOUD_CTA="true"

ENV MASTRA_SERVER_HOST=${MASTRA_SERVER_HOST}
ENV MASTRA_SERVER_PORT=${MASTRA_SERVER_PORT}
ENV MASTRA_SERVER_PROTOCOL=${MASTRA_SERVER_PROTOCOL}
ENV MASTRA_STUDIO_BASE_PATH=${MASTRA_STUDIO_BASE_PATH}
ENV MASTRA_HIDE_CLOUD_CTA=${MASTRA_HIDE_CLOUD_CTA}

# Build playground and playground-ui
RUN pnpm turbo build --filter ./packages/playground --filter ./packages/playground-ui

# Final stage: serve the static output
FROM nginx:alpine AS serve

COPY --from=builder /app/packages/playground/dist /usr/share/nginx/html

# Ensure no Jekyll-style processing; serve as-is
RUN touch /usr/share/nginx/html/.nojekyll

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
