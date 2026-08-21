import { redirect } from "next/navigation";

/** 앱 셸이 생기면서 /app 아래로 옮겼다. 옛 링크를 살려둔다. */
export default function LegacyDocumentsPage() {
  redirect("/app/documents");
}
