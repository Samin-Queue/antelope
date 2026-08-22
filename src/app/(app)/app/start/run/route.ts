import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { guardProcess } from "@/lib/guard";

import { MAX_FILE_BYTES } from "../_lib/fetch";
import type { IntakeInput } from "../_lib/intake";
import { runStart } from "../_lib/pipeline";
import { closeRun } from "../_lib/run-registry";
import type { SessionSnapshot, StartEvent } from "../_lib/types";
import { getGoal } from "../../_lib/goals";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * 1~5 단계. multipart 로 받아 SSE 로 흘린다.
 *
 * 유효성 검사·정보 분석 은 Studio job 이라 각각 수십 초가 걸린다. 결과만 한 번에 주면
 * 1~2분 동안 화면이 죽어 보인다.
 */
export async function POST(req: Request) {
  // 떠 있는 프로미스 하나가 서버 전체를 내리지 않게. `src/lib/guard.ts` 참고
  guardProcess();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "multipart/form-data 로 보내세요." }, { status: 400 });
  }

  const input: IntakeInput = {};
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: "파일이 25MB 를 넘습니다." }, { status: 413 });
    }
    input.file = file;
  }
  const url = String(form.get("url") ?? "").trim();
  if (url) {
    if (!/^https?:\/\//i.test(url)) {
      return Response.json({ error: "http(s) URL 을 입력하세요." }, { status: 400 });
    }
    input.url = url;
  }
  const text = String(form.get("text") ?? "").trim();
  if (text) input.text = text;

  /** 죽은 실행을 이어받는다. 이때는 새 입력이 없어도 된다 */
  const resumeId = String(form.get("resume") ?? "").trim();

  if (!resumeId && !input.file && !input.url && !input.text) {
    return Response.json(
      { error: "파일, 링크, 문장 중 하나는 있어야 합니다." },
      { status: 400 },
    );
  }

  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;
  const userId = session?.user.id ?? null;

  /**
   * 재개는 **자기 세션만** 된다. `getGoal` 이 userId 로 걸러 주므로 남의
   * 스냅샷은 애초에 안 온다.
   */
  let resume: { id: string; snapshot: SessionSnapshot } | undefined;
  if (resumeId) {
    if (!userId) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const goal = await getGoal(userId, resumeId);
    const snapshot = goal?.snapshot as SessionSnapshot | null;
    if (!snapshot) {
      return Response.json({ error: "이어받을 준비 기록이 없습니다." }, { status: 404 });
    }
    resume = { id: resumeId, snapshot };
  }

  const encoder = new TextEncoder();
  /**
   * 탭을 닫아도 **준비는 끝까지 간다.**
   *
   * 준비는 길 때 몇 분씩 걸린다. 그동안 화면을 지키게 만들면 이 제품이 파는
   * 「맡겨 두고 다른 일을 한다」가 성립하지 않는다. `enqueue` 만 실패할 뿐
   * 실행 자체는 계속되므로(실측), 그 성질을 그대로 쓴다 — 결과는 요약 직후
   * 만든 세션 행에 단계마다 덮어써지고, 사용자는 「지난 목표」에서 이어 받는다.
   *
   * 취소는 **단계 상한**에서만 온다(`STAGE_TIMEOUT_MS`). 사람이 떠난 것은
   * 취소가 아니다.
   */
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StartEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* 클라이언트가 떠났다 */
        }
      };

      /**
       * 하트비트. SSE 주석이라 클라이언트 파서가 무시한다.
       *
       * Studio job 폴링은 최대 180초 동안 이벤트를 하나도 안 보낸다. 그 침묵을
       * 프록시가 idle 로 보고 끊으면 클라이언트는 `done` 도 못 받고 멈춘 채
       * 남는다 — 카드가 영원히 도는 「간헐적 무한로딩」의 다른 한 축이다.
       */
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* 닫혔다 */
        }
      }, 15_000);

      /**
       * 종료 신호를 **한 번은 반드시** 보낸다.
       *
       * `runStart` 안에 `end` 를 보내는 경로가 여럿이라, 하나만 빠져도 화면은
       * 「서버가 종료 이벤트 없이 연결을 닫았다」로 끝난다 — 서버가 스스로
       * 끝낸 것인지 죽은 것인지 사용자도 우리도 구분 못 한다. 여기서 마지막에
       * 한 번 더 확인한다: 이미 보냈으면 아무 일도 안 하고, 안 보냈으면 이유를
       * 지어내지 않고 「이유 없이 끝났다」고 그대로 적는다.
       */
      /**
       * 파이프라인이 만든 `runId`. 지시 상자(`/app/start/steer`)가 이 열쇠로
       * 큐에 말을 쌓으므로, 준비가 끝나면 여기서 닫아야 한다 — 안 닫으면
       * 끝난 실행에 넣은 지시가 200 을 받고 아무 데도 안 간다.
       */
      let runId: string | null = null;
      let closed = false;
      const finish = (event: StartEvent) => {
        if (closed) return;
        closed = true;
        emit(event);
      };

      try {
        await runStart(
          input,
          (event) => {
            if (event.type === "run") runId = event.runId;
            if (event.type === "end" || event.type === "error") closed = true;
            emit(event);
          },
          { userId, resume },
        );
      } catch (error) {
        // 서버 로그에도 남긴다. 화면 문구만으로는 스택을 볼 수 없다.
        console.error("[start/run] 파이프라인 예외", error);
        finish({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        finish({
          type: "error",
          error:
            "준비가 종료 신호 없이 끝났습니다. 서버 로그의 [start/run] 항목을 확인하세요.",
        });
        clearInterval(beat);
        if (runId) closeRun(runId);
        try {
          controller.close();
        } catch {
          /* 이미 닫힘 */
        }
      }
    },
    cancel() {
      // 멈추지 않는다. 남은 단계는 끝까지 돌고 세션 행에 쌓인다.
      console.log("[start/run] 클라이언트가 떠났다 — 준비는 계속한다");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
