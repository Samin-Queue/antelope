"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Link2, Loader2, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import type { Evidence } from "./evidence";
import { Cite, EvidencePanel, EvidenceProvider } from "./evidence-view";
import { ProfileForm } from "./profile-form";
import { RunView } from "./run-view";
import type { Notice } from "./schema";

type ComposerInput =
  | { kind: "text"; text: string }
  | { kind: "url"; url: string }
  | { kind: "file"; file: File };

type Result = {
  via: string;
  chars: number;
  notice: Notice;
  /** Studio 경로에서만 온다. 링크·자연어 입력은 좌표가 없다 */
  evidence?: Evidence[];
  cited?: Evidence[];
};

const CONFIDENCE_LABEL = {
  high: "정식 공고문",
  medium: "웹페이지 본문",
  low: "설명 기반 — 확인 필요",
} as const;

export function NoticeWorkbench({
  /** 컴포저에서 넘어온 입력. 있으면 탭 UI 없이 바로 분석한다 */
  initial,
}: {
  initial?:
    | { kind: "text"; text: string }
    | { kind: "url"; url: string }
    | { kind: "file"; file: File };
} = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const startedRef = useRef(false);

  const ingestRef = useRef<
    ((kind: "file" | "url" | "text", override?: ComposerInput) => void) | null
  >(null);

  // 컴포저에서 넘어온 입력은 한 번만 자동 실행한다.
  useEffect(() => {
    if (!initial || startedRef.current) return;
    startedRef.current = true;
    ingestRef.current?.(initial.kind, initial);
  }, [initial]);

  async function ingest(kind: "file" | "url" | "text", override?: ComposerInput) {
    if (pending) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("kind", kind);
      if (kind === "file")
        body.append("file", (override?.kind === "file" ? override.file : file)!);
      if (kind === "url")
        body.append("url", override?.kind === "url" ? override.url : url);
      if (kind === "text")
        body.append("text", override?.kind === "text" ? override.text : text);

      const response = await fetch("/lab/notice/ingest", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      setResult(json as Result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  }

  // 컴포저에서 넘어온 입력은 한 번만 자동 실행한다.
  // ref 에 함수를 얹어 렌더 중 접근하면 react-hooks 규칙에 걸린다.
  useEffect(() => {
    if (!initial || startedRef.current) return;
    startedRef.current = true;
    void ingest(initial.kind, initial);
    // ingest 는 매 렌더 새로 만들어지므로 의존성에 넣지 않는다. initial 이 바뀔 때만 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div className="space-y-6">
      {!initial && (
        <Tabs defaultValue="file">
          <TabsList>
            <TabsTrigger value="file">
              <FileUp className="size-3.5" /> 공고문 파일
            </TabsTrigger>
            <TabsTrigger value="url">
              <Link2 className="size-3.5" /> 링크
            </TabsTrigger>
            <TabsTrigger value="text">
              <MessageSquare className="size-3.5" /> 말로 설명
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-3">
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setFile(event.dataTransfer.files[0] ?? null);
              }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center"
            >
              <p className="text-sm text-muted-foreground">
                {file ? file.name : "HWP · PDF · 이미지 를 끌어다 놓거나 선택하세요"}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".hwp,.hwpx,.pdf,.png,.jpg,.jpeg,.docx"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => inputRef.current?.click()}>
                  파일 선택
                </Button>
                <Button onClick={() => ingest("file")} disabled={!file || pending}>
                  {pending && <Loader2 className="animate-spin" />}분석
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.k-startup.go.kr/..."
              />
              <Button onClick={() => ingest("url")} disabled={!url.trim() || pending}>
                {pending && <Loader2 className="animate-spin" />}분석
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-3">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={5}
              placeholder="어떤 사업인지 아는 대로 적으세요. 정확하지 않아도 됩니다."
            />
            <Button
              onClick={() => ingest("text")}
              disabled={text.trim().length < 20 || pending}
            >
              {pending && <Loader2 className="animate-spin" />}분석
            </Button>
          </TabsContent>
        </Tabs>
      )}

      {pending && initial && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-brand" />
          공고를 읽는 중
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 font-mono text-xs break-words text-destructive">
          {error}
        </p>
      )}

      {result && (
        <>
          <NoticeView result={result} />
          <NextStep notice={result.notice} />
        </>
      )}
    </div>
  );
}

/** 공고를 읽었으면 그다음은 「나는 되는가」다. 프로필을 받아 파이프라인으로 넘긴다. */
function NextStep({ notice }: { notice: Notice }) {
  const [profile, setProfile] = useState<Record<string, string> | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);

  if (!profile) {
    return (
      <ProfileForm
        notice={notice}
        onSubmit={(next) => {
          setProfile(next);
          // 저장 실패가 신청을 막지 않도록 기다리지 않는다.
          void fetch("/lab/notice/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profile: next, sourceNotice: notice.title }),
          }).catch(() => {});

          // 읽기만 한 공고는 목표가 아니다. 정보를 채워 넣은 순간부터 목표다.
          void fetch("/app/goals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notice }),
          })
            .then((response) => response.json())
            .then((json: { id?: string | null }) => setGoalId(json.id ?? null))
            .catch(() => {});
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">신청 준비</h2>
        <Button variant="ghost" size="xs" onClick={() => setProfile(null)}>
          정보 수정
        </Button>
      </div>
      <RunView notice={notice} profile={profile} goalId={goalId} />
    </div>
  );
}

function NoticeView({ result }: { result: Result }) {
  const evidence = result.evidence ?? [];
  return (
    <EvidenceProvider evidence={evidence}>
      <div className="grid gap-4 lg:grid-cols-[1fr_19rem] lg:items-start">
        <NoticeCard result={result} />
        {evidence.length > 0 && (
          <div className="lg:sticky lg:top-6">
            <EvidencePanel evidence={evidence} cited={result.cited ?? []} />
          </div>
        )}
      </div>
    </EvidenceProvider>
  );
}

function NoticeCard({ result }: { result: Result }) {
  const { notice } = result;
  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={notice.confidence === "high" ? "default" : "secondary"}>
            {CONFIDENCE_LABEL[notice.confidence]}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {result.via} · {result.chars.toLocaleString()}자
          </span>
        </div>
        <h2 className="text-lg font-medium">{notice.title}</h2>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <Field label="주관" value={notice.organization} />
          <Field
            label="마감"
            value={notice.deadline && readableDate(notice.deadline)}
            needle={notice.deadline}
          />
          <Field label="규모" value={notice.budget} />
        </dl>
      </header>

      {notice.unknowns.length > 0 && (
        <div className="rounded-xl border border-dashed border-brand/50 bg-brand/5 p-4">
          <p className="text-sm font-medium">직접 확인해야 합니다</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {notice.unknowns.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
      )}

      <Block title={`자격 요건 ${notice.requirements.length}`}>
        {notice.requirements.map((item) => (
          <li key={item.text} className="rounded-lg bg-muted/40 px-3 py-2">
            <Cite label="자격 요건" needle={item.source ?? item.text} className="text-sm">
              {item.text}
            </Cite>
          </li>
        ))}
      </Block>

      <Block title={`제출 서류 ${notice.documents.length}`}>
        {notice.documents.map((item) => (
          <li
            key={item.name}
            className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
          >
            <Cite label="제출 서류" needle={item.name}>
              {item.name}
            </Cite>
            {item.formName && <Badge variant="outline">{item.formName}</Badge>}
            {!item.required && <Badge variant="secondary">해당 시</Badge>}
          </li>
        ))}
      </Block>

      {notice.scoring.length > 0 && (
        <Block title="평가 배점">
          {notice.scoring.map((item) => (
            <li
              key={item.criterion}
              className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
            >
              <Cite label="평가 배점" needle={item.criterion}>
                {item.criterion}
              </Cite>
              <span className="font-mono text-brand">{item.points ?? "—"}</span>
            </li>
          ))}
        </Block>
      )}
    </section>
  );
}

/** 마감은 `2026-09-15T18:00` 로 정규화돼 온다. 사람이 읽는 자리에서는 T 를 뗀다. */
function readableDate(value: string): string {
  return value.replace("T", " ");
}

function Field({
  label,
  value,
  /** 화면에 보이는 값과 원문에서 찾을 값이 다를 때만 따로 준다 */
  needle,
}: {
  label: string;
  value: string | null | undefined;
  needle?: string | null;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm", !value && "text-muted-foreground")}>
        {value ? (
          <Cite label={label} needle={needle ?? value}>
            {value}
          </Cite>
        ) : (
          "미확인"
        )}
      </dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="mt-2 space-y-1.5">{children}</ul>
    </div>
  );
}
