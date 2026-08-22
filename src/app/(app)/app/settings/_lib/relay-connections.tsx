"use client";

import { useState } from "react";
import { Copy, Loader2, MessageSquare, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type RelayLink = {
  id: string;
  channel: "slack" | "telegram";
  externalId: string;
  displayName: string | null;
  createdAt: Date;
};

const CHANNEL_LABEL: Record<RelayLink["channel"], string> = {
  slack: "슬랙",
  telegram: "텔레그램",
};

/**
 * 슬랙 연동.
 *
 * 코드를 발급해 봇과의 1:1 대화에 보내면 연결된다. OAuth 대신 코드를 쓰는
 * 이유는 **사람이 손으로 옮겨 적는 값**이라서다 — 8자를 넘기면 그 자리에서
 * 실패한다.
 */
export function RelayConnections({
  links,
  configured,
}: {
  links: RelayLink[];
  configured: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  async function issue() {
    setPending(true);
    try {
      const response = await fetch("/app/settings/relay", { method: "POST" });
      const data = (await response.json()) as { code?: string; error?: string };
      if (!response.ok || !data.code)
        throw new Error(data.error ?? "발급에 실패했습니다.");
      setCode(data.code);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "발급에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function unlink(id: string) {
    const response = await fetch("/app/settings/relay", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) {
      toast.success("연동을 해제했습니다.");
      // 목록은 서버가 그린다. 가장 단순한 갱신이 새로고침이다.
      window.location.reload();
    } else {
      toast.error("해제에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm">
            슬랙에서 봇을 멘션해 작업을 시키고, 진행 상황을 그 스레드에서 받습니다.
          </p>
          {!configured && (
            <p className="text-sm text-muted-foreground">
              서버에 슬랙 앱이 설정되지 않았습니다 — `SLACK_SIGNING_SECRET`·
              `SLACK_BOT_TOKEN` 이 필요합니다.
            </p>
          )}
        </div>
        <Button size="sm" disabled={pending || !configured} onClick={issue}>
          {pending ? <Loader2 className="animate-spin" /> : <MessageSquare />}
          연동 코드 받기
        </Button>
      </div>

      {code && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center gap-3">
              <code className="rounded-md bg-muted px-3 py-2 font-mono text-lg tracking-[0.3em]">
                {code}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(code);
                  toast.success("복사했습니다.");
                }}
              >
                <Copy />
                복사
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              슬랙에서 <b>Antelope 봇과의 1:1 대화</b>에 이 코드를 그대로 보내세요. 10분
              뒤 만료됩니다. 공개 채널에 적지 마세요 — 먼저 본 사람이 쓸 수 있습니다.
            </p>
          </CardContent>
        </Card>
      )}

      {links.length > 0 && (
        <div className="space-y-3">
          {links.map((link) => (
            <Card key={link.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {CHANNEL_LABEL[link.channel]}
                    </span>
                    <Badge variant="secondary">연동됨</Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {link.displayName ?? link.externalId}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void unlink(link.id)}>
                  <Unplug />
                  해제
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
