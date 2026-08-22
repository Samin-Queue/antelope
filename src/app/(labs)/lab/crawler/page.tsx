import { desc } from "drizzle-orm";
import { ExternalLink, ImageIcon } from "lucide-react";

import { getDb, hasDb, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "공고 수집기" };

export default async function CrawlerLabPage() {
  const cards = hasDb()
    ? await getDb()
        .select()
        .from(schema.opportunityCards)
        .orderBy(desc(schema.opportunityCards.capturedAt))
        .limit(12)
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-14">
      <header className="max-w-2xl space-y-3">
        <p className="font-mono text-xs tracking-wide text-brand">
          OFFICIAL SOURCE CRAWLER
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          공고를 카드로 모읍니다.
        </h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          정부지원사업·학자금·주택 청약 출처를 수집해 원문, URL, 캡처를 함께 보관합니다.
        </p>
      </header>
      {cards.length === 0 ? (
        <Card className="mt-10 border-dashed bg-muted/30">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            아직 수집된 카드가 없습니다. <code>pnpm crawl:opportunities</code>를
            실행하세요.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.id} className="min-w-0">
              <img
                src={`data:image/png;base64,${card.screenshot}`}
                alt={`${card.source} 캡처`}
                className="aspect-video w-full object-cover"
              />
              <CardHeader>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{card.category}</Badge>
                  <Badge variant="outline">{card.source}</Badge>
                </div>
                <CardTitle className="line-clamp-2">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">
                  {card.content}
                </p>
                <a
                  href={card.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-brand underline underline-offset-4"
                >
                  <ExternalLink className="size-3.5" />
                  원문 열기
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <ImageIcon className="size-3.5" />
        스크린샷은 외부 저장소가 아니라 Postgres에 base64로 보관됩니다.
      </p>
    </div>
  );
}
