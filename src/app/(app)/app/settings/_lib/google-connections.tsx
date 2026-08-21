"use client";

import { useState } from "react";
import { Check, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import {
  GOOGLE_ALL_SCOPES,
  GOOGLE_CONSENT_PARAMS,
  type GoogleConnection,
} from "@/lib/google-scopes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function GoogleConnections({
  connections,
  signedIn,
}: {
  connections: GoogleConnection[];
  signedIn: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const allConnected = connections.every((connection) => connection.connected);

  /**
   * 스코프를 한 배열로 넘기면 동의 화면도 한 번이다 — 구글이 항목을 나열해준다.
   * 성공하면 구글로 리다이렉트되므로 pending 을 풀지 않는다.
   */
  async function connect(key: string, scopes: string[]) {
    setPending(key);
    const { error } = await authClient.linkSocial({
      provider: "google",
      scopes,
      additionalParams: { ...GOOGLE_CONSENT_PARAMS },
      callbackURL: "/app/settings",
    });
    if (error) {
      setPending(null);
      toast.error(error.message ?? "연동에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {allConnected
            ? "캘린더와 Gmail 이 모두 연결되어 있습니다."
            : "동의 화면 한 번으로 캘린더와 Gmail 을 함께 연결합니다."}
        </p>
        <Button
          size="sm"
          disabled={!signedIn || pending !== null}
          onClick={() => connect("all", GOOGLE_ALL_SCOPES)}
        >
          {pending === "all" ? <Loader2 className="animate-spin" /> : <Plug />}
          {allConnected ? "다시 연결" : "한 번에 연결"}
        </Button>
      </div>

      <div className="space-y-3">
        {connections.map((connection) => (
          <Card key={connection.key}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{connection.label}</span>
                  {connection.connected && (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="size-3" />
                      연동됨
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{connection.description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={!signedIn || pending !== null}
                onClick={() => connect(connection.key, connection.scopes)}
              >
                {pending === connection.key ? (
                  <Loader2 className="animate-spin" />
                ) : connection.connected ? (
                  "다시 연동"
                ) : (
                  "따로 연동"
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
