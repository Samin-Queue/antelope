import { llmInfo } from "@/lib/llm";
import { ChatPanel } from "@/components/chat-panel";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Playground" };

export default function PlaygroundPage() {
  const info = llmInfo();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-8">
        <div className="flex flex-wrap items-center gap-2">
          {"error" in info ? (
            <Badge variant="destructive">{info.error}</Badge>
          ) : (
            <>
              <Badge>{info.provider}</Badge>
              <Badge variant="secondary">{info.model}</Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {info.baseURL}
              </span>
            </>
          )}
        </div>
        <div className="min-h-0 flex-1">
          <ChatPanel />
        </div>
      </main>
    </>
  );
}
