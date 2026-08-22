# ─────────────────────────────────────────────────────────────
# 팀 3명 + Railway 가 같은 이미지를 쓴다.
#   개발:  docker compose up            (target: dev, 핫리로드)
#   배포:  docker build .               (target: runner, standalone)
# ─────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
# 브라우저 에이전트용 가상 데스크톱. CDP 없이 진짜 Chromium 을 Xvfb 위에 띄우고
# xdotool 로 조작한다. tesseract 는 UPSTAGE_API_KEY 가 없을 때의 OCR 폴백이다.
# (BuildKit 지시자를 쓰지 않는다 — Railway Metal 빌더가 빈 로그로 죽는다)
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      chromium xvfb xdotool xclip imagemagick \
      tesseract-ocr tesseract-ocr-kor tesseract-ocr-eng fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/*
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
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 \
    XDG_CONFIG_HOME=/tmp/.chromium \
    XDG_CACHE_HOME=/tmp/.chromium
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/competition_data.csv ./competition_data.csv
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Next standalone traces Playwright's JavaScript but misses its runtime data asset
# (`playwright-core/browsers.json`), loaded through an external dynamic import.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/playwright-core ./node_modules/playwright-core
# 같은 이유로 @rhwp/core 의 `.wasm` 도 트레이싱에서 빠진다. hwp·hwpx 를 만들려면
# 이 바이너리가 있어야 하고, 없으면 문서 생성이 PDF 로 조용히 떨어진다.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@rhwp ./node_modules/@rhwp
# hwp 렌더러는 번들에 들어가지 않는 별도 스크립트다 — 원본 그대로 있어야 한다.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/render-hwp.mjs ./scripts/render-hwp.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/fill-hwp.mjs ./scripts/fill-hwp.mjs
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
