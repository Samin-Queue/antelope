import { spawn } from "node:child_process";

import { env } from "@/lib/env";

/**
 * 화면 읽기 — DOM 대신 OCR.
 *
 * CDP 를 버렸으니 요소 목록을 가져올 방법이 없다. 대신 스크린샷을 OCR 해서
 * "화면에 보이는 글자와 그 위치" 를 돌려준다. 모델은 이 목록만 보고 `t12 를
 * 클릭` 하듯 지시하고, 우리는 그 글자의 bbox 중심을 실제 마우스로 누른다.
 *
 * 입력칸을 따로 찾지 않는 이유 — HTML 에서 `<label for>` 를 클릭하면 연결된
 * input 에 포커스가 간다. 라벨 글자를 누르고 타이핑하면 그게 곧 입력이다.
 * 플레이스홀더는 글자로 찍히니 직접 눌린다.
 *
 * 공급자는 둘이다. Upstage OCR 이 기본이고, 키가 없으면 tesseract 로 떨어진다 —
 * 키 없이도 앱과 실험이 돌아야 한다는 규칙 때문이다.
 */

export type Word = { text: string; x: number; y: number; w: number; h: number };

export type TextRef = {
  ref: string;
  text: string;
  /** bbox 중심. 클릭 좌표 */
  cx: number;
  cy: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ScreenRead = {
  refs: TextRef[];
  /** 줄 순서대로 이어붙인 본문. 무슨 페이지인지 모델이 알아야 한다 */
  text: string;
  provider: "upstage" | "tesseract";
};

export async function readScreen(png: Buffer): Promise<ScreenRead> {
  const words = env.UPSTAGE_API_KEY ? await upstageWords(png) : await tesseractWords(png);
  const refs = groupLines(words);
  return {
    refs,
    text: refs.map((r) => r.text).join("\n"),
    provider: env.UPSTAGE_API_KEY ? "upstage" : "tesseract",
  };
}

/* ------------------------------------------------------------------ */
/* Upstage OCR                                                          */
/* ------------------------------------------------------------------ */

type Vertices = { vertices?: Array<{ x: number; y: number }> };

type UpstageOcr = {
  pages?: Array<{
    words?: Array<{
      text?: string;
      // 실측 응답은 `boundingBox`(단수)다. 스펙 문서의 `boundingBoxes`(복수)와
      // 다르다 — 둘 다 받는다. 이걸 놓치면 모든 단어가 버려져 화면이 빈 것처럼 보인다.
      boundingBox?: Vertices;
      boundingBoxes?: Vertices;
    }>;
  }>;
};

async function upstageWords(png: Buffer): Promise<Word[]> {
  const form = new FormData();
  form.append(
    "document",
    new Blob([new Uint8Array(png)], { type: "image/png" }),
    "screen.png",
  );
  form.append("model", "ocr");
  const response = await fetch("https://api.upstage.ai/v1/document-digitization", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.UPSTAGE_API_KEY}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`[ocr] upstage ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as UpstageOcr;
  const out: Word[] = [];
  for (const page of data.pages ?? []) {
    for (const word of page.words ?? []) {
      const v = (word.boundingBox ?? word.boundingBoxes)?.vertices;
      if (!word.text || !v || v.length < 2) continue;
      const xs = v.map((p) => p.x);
      const ys = v.map((p) => p.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      out.push({ text: word.text, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* tesseract (폴백)                                                     */
/* ------------------------------------------------------------------ */

async function tesseractWords(png: Buffer): Promise<Word[]> {
  // execFile 은 input 옵션이 없다. stdin 에 직접 써야 한다 —
  // 안 그러면 tesseract 가 '-' 를 기다리며 영원히 멈춘다.
  const stdout = await new Promise<string>((resolve, reject) => {
    const proc = spawn("tesseract", ["-", "-", "-l", "kor+eng", "--psm", "11", "tsv"], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    const chunks: Buffer[] = [];
    proc.stdout.on("data", (c: Buffer) => chunks.push(c));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks).toString("utf8"))
        : reject(new Error(`tesseract exit ${code}`)),
    );
    proc.stdin.end(png);
  });
  const lines = stdout.split("\n").slice(1);
  const out: Word[] = [];
  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 12) continue;
    const conf = Number(cols[10]);
    const text = cols[11]?.trim();
    if (!text || conf < 30) continue;
    out.push({
      // tesseract 한국어 모델은 음절 사이에 공백을 끼워 넣는다 ("다 온 소프트").
      // 같은 단어 상자 안의 한글 사이 공백은 원래 없던 것이니 걷어낸다.
      text: text.replace(/(?<=[가-힣])\s+(?=[가-힣])/g, ""),
      x: Number(cols[6]),
      y: Number(cols[7]),
      w: Number(cols[8]),
      h: Number(cols[9]),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 줄 묶기                                                               */
/* ------------------------------------------------------------------ */

/**
 * 단어를 줄로 묶는다. 같은 높이에서 가까운 단어는 한 덩어리다.
 * "온라인 신청하기" 가 두 ref 로 갈라지면 모델이 어느 쪽을 눌러야 할지 헤맨다.
 */
export function groupLines(words: Word[]): TextRef[] {
  // 1) 행 군집 — 세로 중심이 글자 높이의 절반 안에 들면 같은 행이다.
  //    y 로만 정렬하면 같은 행의 단어가 1px 차이로 뒤섞여 왼쪽 단어가 나중에 온다.
  const byY = [...words].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows: Word[][] = [];
  for (const word of byY) {
    const cy = word.y + word.h / 2;
    const row = rows[rows.length - 1];
    if (row) {
      const rcy = row.reduce((s, w) => s + w.y + w.h / 2, 0) / row.length;
      const rh = row.reduce((s, w) => s + w.h, 0) / row.length;
      if (Math.abs(rcy - cy) < Math.max(rh, word.h) * 0.55) {
        row.push(word);
        continue;
      }
    }
    rows.push([word]);
  }

  // 2) 행 안에서 x 순으로 놓고, 글자 높이의 1.5배보다 넓게 비면 다른 덩어리로 끊는다.
  //    "이름 *" 과 "이메일 *" 은 같은 행이지만 한 ref 가 아니다.
  const lines: Word[][] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let current: Word[] = [];
    for (const word of row) {
      const last = current[current.length - 1];
      if (last) {
        const gap = word.x - (last.x + last.w);
        const h = Math.max(last.h, word.h);
        if (gap > h * 1.5) {
          lines.push(current);
          current = [];
        }
      }
      current.push(word);
    }
    if (current.length) lines.push(current);
  }

  return lines
    .map((line, i) => {
      const x = Math.min(...line.map((w) => w.x));
      const y = Math.min(...line.map((w) => w.y));
      const right = Math.max(...line.map((w) => w.x + w.w));
      const bottom = Math.max(...line.map((w) => w.y + w.h));
      return {
        ref: `t${i + 1}`,
        text: line.map((w) => w.text).join(" "),
        x,
        y,
        w: right - x,
        h: bottom - y,
        cx: Math.round((x + right) / 2),
        cy: Math.round((y + bottom) / 2),
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((r, i) => ({ ...r, ref: `t${i + 1}` }));
}

/** 캡챠가 떴는지. 여기 걸리면 에이전트는 멈추고 사람을 부른다. */
export function looksLikeCaptcha(text: string) {
  return /로봇이 아닙니다|사람입니까|보안문자|자동입력 방지|captcha|recaptcha|hcaptcha|i'?m not a robot|verify you are human|cloudflare/i.test(
    text,
  );
}
