/**
 * 프로세스가 조용히 죽지 않게 한다.
 *
 * Node 는 **처리되지 않은 Promise 거부에 스스로를 종료한다**(15 이상 기본값).
 * 이 서버에는 화면 문구를 만드는 것처럼 결과를 기다리지 않는 호출이 여럿 있고,
 * 그중 하나가 거부되면 신청 준비 전체가 함께 죽는다 — 증상은 「서버가 종료
 * 이벤트 없이 연결을 닫았다」로만 보이고 스택은 어디에도 안 남는다. 실제로
 * 프로덕션에서 그렇게 끊겼다(`uptime` 은 짧은데 원장이 비어 있었다 — 인메모리
 * 원장이 프로세스와 함께 사라졌다는 뜻이다).
 *
 * 그래서 두 가지를 한다:
 *
 * 1. **남긴다.** 무엇이 거부됐는지 스택째 로그로. 이게 없으면 다음에도 못 찾는다.
 * 2. **살린다.** 핸들러를 등록하는 것만으로 기본 종료 동작이 꺼진다.
 *
 * ⚠ `uncaughtException` 까지 삼키는 것은 **일반적으로 나쁜 선택이다** — 상태가
 * 깨진 채로 계속 도는 것이 죽는 것보다 나쁠 수 있다. 여기서 그렇게 두는 이유는
 * 이 서버가 하는 일이 요청 단위로 격리돼 있고(각 SSE 실행이 자기 상태만 만진다),
 * 한 실행이 서버 전체를 내리는 쪽이 확실히 더 나쁘기 때문이다. 로그에 찍히면
 * 원인을 고치고 이 관용은 걷어낸다.
 */
let armed = false;

export function guardProcess(): void {
  if (armed) return;
  armed = true;

  process.on("unhandledRejection", (reason) => {
    console.error(
      "[guard] 처리되지 않은 Promise 거부 — 프로세스는 살려 둔다",
      reason instanceof Error ? (reason.stack ?? reason.message) : reason,
    );
  });

  process.on("uncaughtException", (error) => {
    console.error(
      "[guard] 잡히지 않은 예외 — 프로세스는 살려 둔다",
      error.stack ?? error,
    );
  });
}
