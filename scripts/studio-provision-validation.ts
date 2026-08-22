import { createAgent, createConfig } from "@/lib/upstage-studio";
import { validationWorkflow } from "@/app/(labs)/lab/validation/_lib/workflow";

async function main(): Promise<void> {
  const existingAgentId = process.env.UPSTAGE_VALIDATION_AGENT_ID;
  const agent = existingAgentId
    ? { id: existingAgentId }
    : await createAgent("validation");
  const steps = validationWorkflow();
  const config = await createConfig({
    agentId: agent.id,
    name: "validation-markdown-summary",
    steps,
    isDefault: true,
  });

  console.log("Agent:", agent.id, existingAgentId ? "(existing)" : "(new)");
  console.log("Config:", config.id);
  console.log("Steps:", steps.map((step) => step.name).join(" → "));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("유효성 검사 provisioning failed:", message.slice(0, 700));
  process.exit(1);
});
