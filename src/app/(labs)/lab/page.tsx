import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LAB_STATUS_LABEL, labs, type LabStatus } from "@/content/labs";

export const metadata = { title: "실험" };

const VARIANT: Record<LabStatus, "default" | "secondary" | "outline"> = {
  promising: "default",
  exploring: "secondary",
  dropped: "outline",
};

export default function LabIndexPage() {
  const alive = labs.filter((lab) => lab.status !== "dropped");
  const dropped = labs.filter((lab) => lab.status === "dropped");

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">실험</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        아이디어를 병렬로 찔러보고 아니다 싶으면 폴더째 버린다. 같은 배포 URL 에서 나란히
        열어 비교한다.
      </p>

      {labs.length === 0 && (
        <p className="mt-10 rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          아직 실험이 없다. <code>src/content/labs.ts</code> 에 등록하고{" "}
          <code>src/app/(labs)/lab/&lt;slug&gt;/page.tsx</code> 를 만든다.
        </p>
      )}

      <ul className="mt-8 space-y-3">
        {[...alive, ...dropped].map((lab) => (
          <li key={lab.slug}>
            <Link
              href={`/lab/${lab.slug}`}
              className="group flex items-start gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-brand/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{lab.title}</span>
                  <Badge variant={VARIANT[lab.status]}>
                    {LAB_STATUS_LABEL[lab.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{lab.hypothesis}</p>
                <p className="mt-2 font-mono text-xs text-muted-foreground/70">
                  {lab.owner} · /lab/{lab.slug}
                </p>
              </div>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
