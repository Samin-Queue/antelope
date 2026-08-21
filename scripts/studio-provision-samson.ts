import { createAgent, createConfig } from "@/lib/upstage-studio";
import { samsonWorkflow } from "@/app/(labs)/lab/samson/_lib/workflow";

async function main(): Promise<void> {
  const existingAgentId = process.env.UPSTAGE_SAMSON_AGENT_ID;
  const agent = existingAgentId ? { id: existingAgentId } : await createAgent("samson");
  const steps = samsonWorkflow();
  const config = await createConfig({
    agentId: agent.id,
    name: "samson-markdown-summary",
    steps,
    isDefault: true,
  });

  console.log("Agent:", agent.id, existingAgentId ? "(existing)" : "(new)");
  console.log("Config:", config.id);
  console.log("Steps:", steps.map((step) => step.name).join(" → "));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Samson provisioning failed:", message.slice(0, 700));
  process.exit(1);
});
