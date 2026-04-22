FROM node:22-alpine AS base
WORKDIR /workspace
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared-auth/package.json packages/shared-auth/package.json
COPY packages/shared-config/package.json packages/shared-config/package.json
COPY packages/shared-events/package.json packages/shared-events/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-utils/package.json packages/shared-utils/package.json
COPY apps/analytics-service/package.json apps/analytics-service/package.json
COPY apps/api-gateway/package.json apps/api-gateway/package.json
COPY apps/appointment-service/package.json apps/appointment-service/package.json
COPY apps/billing-service/package.json apps/billing-service/package.json
COPY apps/ehr-service/package.json apps/ehr-service/package.json
COPY apps/frontend-admin-web/package.json apps/frontend-admin-web/package.json
COPY apps/frontend-public-web/package.json apps/frontend-public-web/package.json
COPY apps/notification-service/package.json apps/notification-service/package.json
COPY apps/pet-service/package.json apps/pet-service/package.json
COPY apps/telemed-service/package.json apps/telemed-service/package.json
COPY apps/user-service/package.json apps/user-service/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS packages-builder
COPY packages ./packages
RUN pnpm build:packages

FROM packages-builder AS builder
COPY apps/telemed-service ./apps/telemed-service
RUN pnpm --filter @petwell/telemed-service prisma:generate
RUN pnpm --filter @petwell/telemed-service build

FROM base AS runner
COPY --from=builder /workspace /workspace
EXPOSE 3006
CMD ["pnpm", "--filter", "@petwell/telemed-service", "start"]
