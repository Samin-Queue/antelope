import Link from "next/link";
import { AlertTriangle, Check, MessageSquare } from "lucide-react";

import { currentSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { slack } from "./_lib/slack";
import { identitiesOf, recentThreads } from "./_lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "릴레이 — 슬랙에서 에이전트 돌리기" };

const STATUS_LABEL: Record<string, string> = {
  queued: "대기",
  running: "준비 중",
  asking: "답을 기다림",
  ready: "준비 완료",
  applying: "신청 중",
  done: "완료",
  lost: "재시작으로 끊김",
  error: "오류",
};

/**
 * 실험 화면.
 *
 * 무엇이 설정됐고 무엇이 안 됐는지를 **먼저** 보여준다 — 슬랙 연동은 실패가
 * 조용하다(슬랙은 오류를 200 + `ok:false` 로 준다). 어디까지 됐는지 눈으로
 * 확인할 곳이 없으면 원인을 엉뚱한 데서 찾게 된다.
 */
export default async function RelayLabPage() {
  const session = await currentSession();
  const links = session ? await identitiesOf(session.user.id) : [];
  const threads = session ? await recentThreads(session.user.id) : [];
  const configured = slack.ready();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">릴레이</h1>
        <p className="text-sm text-muted-foreground">
          긴 작업을 화면 앞에서 기다리지 않는다. 슬랙 스레드에서 시작하고, 진행 상황을 그
          스레드에서 받고, 자료가 필요해지면 스레드로 되묻는다.
        </p>
      </header>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">준비 상태</h2>
        <Row
          ok={configured}
          label="서버 설정"
          detail={
            configured
              ? "SLACK_SIGNING_SECRET · SLACK_BOT_TOKEN 이 들어와 있습니다."
              : "SLACK_SIGNING_SECRET · SLACK_BOT_TOKEN 이 필요합니다. 이 값이 없으면 웹훅이 503 을 돌려줍니다."
          }
        />
        <Row
          ok={Boolean(session)}
          label="로그인"
          detail={
            session ? `${session.user.email}` : "연동하려면 먼저 로그인해야 합니다."
          }
        />
        <Row
          ok={links.length > 0}
          label="슬랙 계정 연결"
          detail={
            links.length > 0
              ? links.map((link) => link.displayName ?? link.externalId).join(", ")
              : "설정 · 연동 에서 코드를 받아 봇과의 1:1 대화에 보내세요."
          }
        />
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">최근 스레드</h2>
        {threads.length === 0 ? (
          <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            아직 없습니다. 슬랙에서 <code>@Antelope</code> 를 멘션해 보세요.
          </p>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <Card key={thread.id}>
                <CardContent className="flex items-center gap-3 py-3">
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{thread.lastNote ?? "(내용 없음)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {thread.channel} · {thread.conversation}
                    </p>
                  </div>
                  <Badge
                    variant={thread.status === "error" ? "destructive" : "secondary"}
                  >
                    {STATUS_LABEL[thread.status] ?? thread.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 space-y-2 text-sm text-muted-foreground">
        <h2 className="text-sm font-medium text-foreground">앱 설정</h2>
        <p>
          <code>src/app/(labs)/lab/relay/slack-manifest.json</code> 을 api.slack.com/apps
          → From a manifest 에 붙여 넣는다. 설치 뒤 Signing Secret 과 Bot User OAuth Token
          을 환경변수에 넣는다.
        </p>
        <p>
          설계는 <code>docs/superpowers/plans/2026-08-22-relay-channels.md</code> 에 있다.
        </p>
        <p>
          <Link
            href="/app/settings"
            className="underline underline-offset-2 hover:text-foreground"
          >
            설정 · 연동으로 가기
          </Link>
        </p>
      </section>
    </div>
  );
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 px-4 py-3">
      {ok ? (
        <Check className="mt-0.5 size-4 shrink-0 text-brand" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
