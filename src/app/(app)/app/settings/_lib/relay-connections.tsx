"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Loader2, MessageSquare, Unplug } from "lucide-react";
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

const WHY: Record<string, string> = {
  "no-db": "데이터베이스가 연결되어 있지 않습니다.",
  "missing-code": "슬랙이 코드를 돌려주지 않았습니다.",
  "bad-state": "연결 요청이 만료됐습니다. 다시 눌러 주세요.",
  access_denied: "동의를 취소했습니다.",
  bad_redirect_uri: "슬랙 앱의 Redirect URL 설정이 이 주소와 다릅니다.",
};

/**
 * 슬랙 계정 연결.
 *
 * 구글 연동과 같은 모양이다 — **동의 화면 한 번**으로 끝난다. 코드를 손으로
 * 옮기거나 이메일이 같기를 바라지 않는다. 어느 슬랙 계정을 잇는지는 사용자가
 * 그 화면에서 직접 고른다.
 */
export function RelayConnections({
  links,
  configured,
}: {
  links: RelayLink[];
  configured: boolean;
}) {
  const [pending, setPending] = useState(false);
  const params = useSearchParams();

  // 콜백이 결과를 쿼리로 싣고 돌아온다. 조용히 끝나면 됐는지 알 수 없다.
  useEffect(() => {
    const status = params.get("relay");
    if (!status) return;
    if (status === "connected") toast.success("슬랙 계정을 연결했습니다.");
    else {
      const why = params.get("why") ?? "";
      toast.error(WHY[why] ?? `연결에 실패했습니다${why ? ` — ${why}` : ""}`);
    }
    window.history.replaceState(null, "", "/app/settings");
  }, [params]);

  async function unlink(id: string) {
    const response = await fetch("/app/settings/relay", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) {
      toast.success("연동을 해제했습니다.");
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
            슬랙에서 봇을 멘션해 일을 시키고, 진행 상황을 그 스레드에서 받습니다.
          </p>
          {!configured && (
            <p className="text-sm text-muted-foreground">
              서버에 슬랙 앱이 설정되지 않았습니다 — <code>SLACK_CLIENT_ID</code> ·
              <code>SLACK_CLIENT_SECRET</code> 이 필요합니다.
            </p>
          )}
        </div>
        {/*
          라우트 핸들러가 슬랙 동의 화면으로 302 를 준다. `router.push` 는 그
          바깥 리다이렉트를 따라가지 못하므로 평범한 링크로 나간다.
          이 스타일의 Button 은 `asChild` 가 아니라 base-ui `render` 다.
        */}
        <Button
          size="sm"
          disabled={pending || !configured}
          onClick={() => setPending(true)}
          render={<a href="/app/settings/relay" />}
        >
          {pending ? <Loader2 className="animate-spin" /> : <MessageSquare />}
          {links.length ? "다시 연결" : "슬랙 연결"}
        </Button>
      </div>

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
                    <Badge variant="secondary" className="gap-1">
                      <Check className="size-3" />
                      연결됨
                    </Badge>
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
