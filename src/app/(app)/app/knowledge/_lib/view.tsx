import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentList } from "@/app/(app)/app/hub/_lib/shelf";
import type { StoredDocument } from "@/app/(app)/app/start/_lib/documents";
import type { GraphEdge, Memory } from "@/app/(labs)/lab/notice/_lib/memory";

import { CuratorPanel } from "./curator-panel";
import { KnowledgeGraph } from "./graph";

const KIND_LABEL: Record<Memory["kind"], string> = {
  fact: "사실",
  item: "아이템",
  strength: "강점",
  narrative: "서술",
};

/**
 * 서술 탭에 묶이는 종류.
 *
 * `recallNarratives` 가 사업계획을 쓸 때 꺼내는 것과 **같은 셋**이다. 화면의
 * 분류가 검색의 분류와 다르면, 여기서 본 것과 문서에 실리는 것이 어긋난다.
 */
const NARRATIVE_KINDS: Memory["kind"][] = ["item", "strength", "narrative"];

/**
 * 지식은 하나의 큰 컨텍스트로 보여준다.
 *
 * 항목마다 수정 버튼을 달지 않는다 — 이 컨텍스트를 관리하는 주체는
 * 에이전트이고, 사용자는 말로 지시한다.
 */
export function KnowledgeView({
  memories,
  edges,
  documents,
  signedIn,
}: {
  memories: Memory[];
  edges: GraphEdge[];
  documents: StoredDocument[];
  signedIn: boolean;
}) {
  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          지식은 계정에 쌓인다. 로그인하면 여기서 볼 수 있다.
        </p>
        <Button render={<Link href="/sign-in" />} className="mt-4">
          로그인
        </Button>
      </div>
    );
  }

  const facts = memories.filter((memory) => memory.kind === "fact");
  const narratives = memories.filter((memory) => NARRATIVE_KINDS.includes(memory.kind));

  return (
    <div className="space-y-6">
      <KnowledgeGraph memories={memories} edges={edges} />
      <CuratorPanel />

      {/* 셋을 한 줄로 늘어놓으면 사실 스무 개 아래로 파일이 밀려 안 보인다 */}
      <Tabs defaultValue="fact" className="gap-4">
        {/* 알약 대신 밑줄 — 목록 위에 얹히는 탭이라 배경 블록이 하나 더 생기면
            그래프·큐레이터 상자와 층이 겹쳐 보인다. 준비 화면의 탭과 같은 모양이다 */}
        <TabsList variant="line" className="w-full justify-start gap-4">
          <TabsTrigger value="fact" className="h-8 flex-none px-0.5">
            사실 <Count value={facts.length} />
          </TabsTrigger>
          <TabsTrigger value="narrative" className="h-8 flex-none px-0.5">
            서술 <Count value={narratives.length} />
          </TabsTrigger>
          <TabsTrigger value="file" className="h-8 flex-none px-0.5">
            파일 <Count value={documents.length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fact">
          <MemoryList
            items={facts}
            empty="아직 없다. 목표를 하나 처리하면 여기서부터 자란다."
          />
        </TabsContent>
        <TabsContent value="narrative">
          <MemoryList
            items={narratives}
            showKind
            empty="아직 없다. 사업계획서를 쓸 때 근거로 꺼내 쓸 강점·서술이 여기 쌓인다."
          />
        </TabsContent>
        <TabsContent value="file">
          <DocumentList documents={documents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Count({ value }: { value: number }) {
  return <span className="font-mono text-xs text-muted-foreground">{value}</span>;
}

function MemoryList({
  items,
  empty,
  showKind = false,
}: {
  items: Memory[];
  empty: string;
  /** 서술 탭은 세 종류가 섞여 있다. 어느 것인지 보이지 않으면 구분이 사라진다 */
  showKind?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {items.map((memory) => (
        <li key={memory.id} className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">{memory.label}</span>
            {showKind && (
              <Badge variant="secondary" className="text-[10px]">
                {KIND_LABEL[memory.kind]}
              </Badge>
            )}
            {memory.sourceNotice && (
              <Badge variant="outline" className="text-[10px]">
                {memory.sourceNotice}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {memory.value}
          </p>
        </li>
      ))}
    </ul>
  );
}
