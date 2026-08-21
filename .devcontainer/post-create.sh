#!/usr/bin/env bash
set -euo pipefail

# 락파일이 이미지 빌드 이후에 바뀌었을 수 있다. node_modules 볼륨을 최신으로 맞춘다.
# confirmModulesPurge=false: 비대화형에서 "reinstall from scratch?" 프롬프트에 걸리지 않게.
pnpm install --frozen-lockfile --config.confirmModulesPurge=false

# Playwright 브라우저. 이미지에는 없고 ~/.cache/ms-playwright 에 깔린다.
# npm 으로 돌리면 비대화형에서 멈추는 사례가 있어 pnpm exec 로 실행한다.
# chromium 만 받는다 — Google Chrome 은 arm64 리눅스 빌드가 없어서 채널 설치가 실패한다.
pnpm exec playwright install chromium --with-deps

# git·gh·claude 는 feature 가 이미지에 넣는다. railway 는 공식 feature 가 없어서 여기서.
npm install -g --no-fund --no-audit @railway/cli

# 셸 히스토리를 볼륨에 남긴다.
mkdir -p /commandhistory
grep -qF 'HISTFILE=/commandhistory' /root/.bashrc 2>/dev/null || cat >> /root/.bashrc <<'RC'

export HISTFILE=/commandhistory/.bash_history
export PROMPT_COMMAND='history -a'
shopt -s histappend
RC

echo
echo "준비 끝. 최초 1회만 각자:"
echo "  railway login   # 배포·환경변수"
echo "  gh auth login   # PR"
echo "  claude          # 에이전트"
echo
echo "개발 서버:  pnpm dev  (또는 railway run pnpm dev)"
