import { llmInfo } from "@/lib/llm";
import { AppHeader } from "@/components/app/app-header";
import { ChatPanel } from "@/components/chat-panel";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "플레이그라운드" };

export default function PlaygroundPage() {
  const info = llmInfo();

  return (
    <>
      <AppHeader
        trail={["개발자 도구", "플레이그라운드"]}
        actions={
          "error" in info ? (
            <Badge variant="destructive">키 미설정</Badge>
          ) : (
            <Badge variant="secondary">{info.model}</Badge>
          )
        }
      />
      <div className="mx-auto flex h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col px-6 py-6">
        <ChatPanel />
      </div>
    </>
  );
}
