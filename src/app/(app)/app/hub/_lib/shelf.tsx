import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { StoredDocument } from "@/app/(app)/app/start/_lib/documents";

/**
 * 보관 서류.
 *
 * 값만 기억하고 파일은 매번 다시 달라고 하면 「다시 묻지 않는다」가 반쪽이다.
 * 사업자등록증·4대보험 명부는 공고마다 같은 것을 낸다.
 */
export function DocumentShelf({ documents }: { documents: StoredDocument[] }) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">보관 서류</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {documents.length}
        </span>
      </div>

      {documents.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          아직 없다. 신청 준비 화면에서 발급 서류를 올리면 여기에 쌓이고, 다음 공고에서는
          다시 묻지 않는다.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {documents.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm"
            >
              <FileText className="size-3.5 shrink-0 text-brand" />
              <span>{item.label}</span>
              <Badge variant="outline">{item.filename}</Badge>
              {item.sourceNotice && (
                <span className="truncate text-xs text-muted-foreground">
                  {item.sourceNotice}
                </span>
              )}
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {(item.bytes / 1024).toFixed(0)}KB
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
