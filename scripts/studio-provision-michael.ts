import { createAgent, createConfig } from "@/lib/upstage-studio";
import { michaelWorkflow } from "@/app/(labs)/lab/michael/_lib/workflow";

async function main(): Promise<void> {
  const existingAgentId = process.env.UPSTAGE_MICHAEL_AGENT_ID;
  const agent = existingAgentId ? { id: existingAgentId } : await createAgent("michael");
  const steps = michaelWorkflow();
  const config = await createConfig({
    agentId: agent.id,
    name: "michael-application-fields-json",
    steps,
    isDefault: true,
  });

  console.log("Agent:", agent.id, existingAgentId ? "(existing)" : "(new)");
  console.log("Config:", config.id);
  console.log("Steps:", steps.map((step) => step.name).join(" → "));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Michael provisioning failed:", message.slice(0, 700));
  process.exit(1);
});
