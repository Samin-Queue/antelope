# ─────────────────────────────────────────────────────────────
# 팀 3명 + Railway 가 같은 이미지를 쓴다.
#   개발:  docker compose up            (target: dev, 핫리로드)
#   배포:  docker build .               (target: runner, standalone)
# ─────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# ── 의존성만 별도 레이어로: 소스가 바뀌어도 재설치하지 않는다 ──
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm 의 심볼릭 링크 레이아웃은 Next standalone 트레이싱에서 @swc/helpers 같은
# 전이 의존성을 놓친다. 컨테이너 안에서만 평탄한(hoisted) 레이아웃을 쓴다.
RUN pnpm config set node-linker hoisted
RUN pnpm install --frozen-lockfile

# ── 개발용: 소스는 compose 의 bind mount 로 들어온다 ──
FROM deps AS dev
ENV NODE_ENV=development WATCHPACK_POLLING=true CHOKIDAR_USEPOLLING=1
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev", "--hostname", "0.0.0.0"]

# ── 빌드 ──
FROM deps AS builder
COPY . .
RUN pnpm build

# ── 런타임: standalone 산출물만 복사 ──
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
