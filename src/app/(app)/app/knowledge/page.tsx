import { redirect } from "next/navigation";

/** 지식 베이스는 「허브」로 옮겼다. */
export default function KnowledgeRedirect() {
  redirect("/app/hub");
}
