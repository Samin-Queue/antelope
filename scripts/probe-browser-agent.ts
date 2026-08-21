import { runBrowserAgent } from "../src/app/(labs)/lab/notice/_lib/agent";
import { closeSession } from "../src/app/(labs)/lab/notice/_lib/browser";

async function main() {
  const started = Date.now();
  const result = await runBrowserAgent({
    sessionId: "probe",
    startUrl: "http://localhost:8899/",
    goal: "신청서 1단계와 2단계를 끝까지 채워라. 단, 최종 제출 버튼은 누르지 말고 직전에서 멈춘다.",
    facts: {
      "대표자 성명": "김시윤",
      생년월일: "1999-04-12",
      연락처: "010-1234-5678",
      업종: "제조업",
      기업명: "안텔로프",
      창업일: "2024-03-01",
      "사업 요약": "한국어 공고문을 구조화해 신청 준비를 자동화하는 서비스",
    },
    maxSteps: 30,
  });

  console.log(
    "소요:",
    ((Date.now() - started) / 1000).toFixed(1),
    "초 · 스텝",
    result.steps,
  );
  console.log("최종 URL:", result.finalUrl);
  console.log("--- 조작 기록 ---");
  for (const entry of result.trace) {
    const input = JSON.stringify(entry.input);
    console.log(
      `  ${String(entry.step).padStart(2)} ${entry.tool.padEnd(9)} ${input.slice(0, 60)}`,
    );
  }
  console.log("--- 에이전트 보고 ---");
  console.log(result.summary.slice(0, 500));

  await closeSession("probe");
  process.exit(0);
}
main().catch(async (error) => {
  console.error("실패:", error instanceof Error ? error.message.slice(0, 500) : error);
  await closeSession("probe").catch(() => {});
  process.exit(1);
});
