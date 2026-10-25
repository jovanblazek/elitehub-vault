# syntax=docker/dockerfile:1
# Build context must be the repository root.

ARG NODE_IMAGE=node:24.22.1-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea

FROM ${NODE_IMAGE} AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.10.12 prune @elitehub/api --docker

FROM base AS build
# Toolchain for native addons without a glibc prebuild for linux-arm64 (msgpackr-extract)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*
COPY --from=prune /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY --from=prune /repo/out/full/ .
RUN pnpm turbo run build --filter=@elitehub/api...
# Reinstall with production dependencies only
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    rm -rf node_modules apps/*/node_modules packages/*/node_modules && \
    pnpm install --frozen-lockfile --prod --store-dir /pnpm/store

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /app
WORKDIR /app/apps/api
USER node
EXPOSE 3000

# Slim image has no curl/wget, so use Node's built-in fetch.
HEALTHCHECK --start-period=5s --interval=10s --timeout=5s --retries=6 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthcheck').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "--import", "./dist/utils/sentry.js", "dist/index.js"]
