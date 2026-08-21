import Link from "next/link";
import { ArrowRight, FileText, MessagesSquare, Sparkles } from "lucide-react";

import { hasDb } from "@/lib/db";
import { llmInfo } from "@/lib/llm";
import { AppHeader } from "@/components/app/app-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "개요" };

const ENTRIES = [
  {
    href: "/app/notices",
    icon: Sparkles,
    title: "공고 분석",
    body: "공고문 파일·링크·설명을 넣으면 자격 판정부터 신청서 설계까지 한 번에 처리한다.",
  },
  {
    href: "/app/documents",
    icon: FileText,
    title: "문서 파이프라인",
    body: "업로드한 문서를 구조화하고 임의 스키마로 필요한 필드만 뽑는다.",
  },
  {
    href: "/app/playground",
    icon: MessagesSquare,
    title: "플레이그라운드",
    body: "연결된 모델을 직접 두드려 본다.",
  },
];

export default function AppOverviewPage() {
  const llm = llmInfo();

  return (
    <>
      <AppHeader trail={["개요"]} />
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">워크스페이스</h1>
          {"error" in llm ? (
            <Badge variant="destructive">{llm.error}</Badge>
          ) : (
            <>
              <Badge variant="secondary">{llm.provider}</Badge>
              <Badge variant="outline">{llm.model}</Badge>
            </>
          )}
          <Badge variant={hasDb() ? "outline" : "destructive"}>
            {hasDb() ? "DB 연결됨" : "DB 미연결"}
          </Badge>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ENTRIES.map((entry) => (
            <Card
              key={entry.href}
              className="group transition-colors hover:border-brand/40"
            >
              <CardHeader>
                <entry.icon className="size-5 text-brand" />
                <CardTitle className="mt-2 text-base">
                  <Link href={entry.href} className="after:absolute after:inset-0">
                    {entry.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                {entry.body}
                <ArrowRight className="mt-3 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
