"use client";

import { useState } from "react";
import { Brain, History, Target } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Composer,
  type ComposerSubmit,
  type ModelOption,
} from "@/components/app/composer";
import { Button } from "@/components/ui/button";
import { NoticeWorkbench } from "@/app/(labs)/lab/notice/_lib/workbench";

type TabId = "start" | "past" | "knowledge";

const TABS: Array<{ id: TabId; label: string; icon: typeof Target }> = [
  { id: "start", label: "목표 시작하기", icon: Target },
  { id: "past", label: "지난 목표", icon: History },
  { id: "knowledge", label: "지식 베이스", icon: Brain },
];

export function AppTabs({
  greeting,
  models,
  past,
  knowledge,
}: {
  greeting: string;
  models: ModelOption[];
  past: React.ReactNode;
  knowledge: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("start");
  const [input, setInput] = useState<ComposerSubmit | null>(null);

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] flex-col">
      <nav className="flex justify-center gap-1 border-b border-border/60 px-4">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm transition-colors",
              tab === item.id
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "start" &&
        (input ? (
          <div className="mx-auto w-full max-w-4xl px-6 py-8">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm text-muted-foreground">
                {input.kind === "file"
                  ? input.file.name
                  : input.kind === "url"
                    ? input.url
                    : input.text}
              </p>
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto"
                onClick={() => setInput(null)}
              >
                새 목표
              </Button>
            </div>
            <div className="mt-6">
              <NoticeWorkbench initial={input} />
            </div>
          </div>
        ) : (
          <Composer greeting={greeting} models={models} onSubmit={setInput} />
        ))}

      {tab === "past" && <div className="mx-auto w-full max-w-4xl px-6 py-8">{past}</div>}
      {tab === "knowledge" && (
        <div className="mx-auto w-full max-w-4xl px-6 py-8">{knowledge}</div>
      )}
    </div>
  );
}
