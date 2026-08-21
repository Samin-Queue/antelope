/**
 * Studio 에이전트·Config 를 코드로 만든다.
 * Config 는 불변이라 워크플로를 고치면 이 스크립트를 다시 돌려 새 Config 를 만든다.
 */
import { noticeWorkflow } from "@/lib/studio-workflow";
import { createAgent, createConfig } from "@/lib/upstage-studio";

async function main() {
  const existing = process.env.UPSTAGE_AGENT_ID;
  const agent = existing ? { id: existing } : await createAgent("Antelope 공고 처리");
  console.log("Agent:", agent.id, existing ? "(기존)" : "(신규)");

  const steps = noticeWorkflow();
  console.log("스텝:", steps.map((s) => `${s.name}(${s.type})`).join(" → "));

  const config = await createConfig({
    agentId: agent.id,
    name: `notice-${steps.length}step`,
    steps,
    isDefault: true,
  });

  console.log(
    "\nConfig:",
    config.id,
    config.external_id ? `(external ${config.external_id})` : "",
  );
  console.log("\n.env.local 에 넣을 값:");
  console.log(`UPSTAGE_AGENT_ID=${agent.id}`);
  process.exit(0);
}
main().catch((error) => {
  console.error("실패:", error instanceof Error ? error.message.slice(0, 700) : error);
  process.exit(1);
});
