import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { StoredDocument } from "@/app/(app)/app/start/_lib/documents";

/**
 * 보관 서류.
 *
 * 값만 기억하고 파일은 매번 다시 달라고 하면 「다시 묻지 않는다」가 반쪽이다.
 * 사업자등록증·4대보험 명부는 공고마다 같은 것을 낸다.
 *
 * 제목을 달지 않는다 — 탭 이름이 이미 「파일」이다.
 */
export function DocumentList({ documents }: { documents: StoredDocument[] }) {
  if (documents.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        아직 없다. 신청 준비 화면에서 발급 서류를 올리면 여기에 쌓이고, 다음 공고에서는
        다시 묻지 않는다.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
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
  );
}
