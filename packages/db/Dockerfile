# syntax=docker/dockerfile:1
# Build context must be the repository root.
# Runs pending Drizzle migrations, then stays up and reports healthy.
# Coolify marks the deployment finished only once the container is healthy,
# so the deploy workflow can treat "finished" as "migrations applied".
# A failed migration exits the container, which fails the deployment.

ARG NODE_IMAGE=node:24.22.1-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea

FROM ${NODE_IMAGE} AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.10.12 prune @elitehub/db --docker

FROM base AS build
COPY --from=prune /repo/out/json/ .
# drizzle-kit is a devDependency, so keep the full install
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY --from=prune /repo/out/full/ .

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /app
WORKDIR /app/packages/db
USER node
# Coolify polls with these values: waits start-period, then up to retries x interval (~5 min)
HEALTHCHECK --start-period=5s --interval=5s --timeout=3s --retries=60 \
    CMD ["test", "-f", "/tmp/migrations-applied"]
CMD ["sh", "-c", "set -e; ./node_modules/.bin/drizzle-kit migrate; touch /tmp/migrations-applied; trap 'exit 0' TERM; sleep infinity & wait"]
