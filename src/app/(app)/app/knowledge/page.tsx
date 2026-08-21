import { redirect } from "next/navigation";

/** 지식은 워크스페이스 탭으로 합쳤다. */
export default function KnowledgeRedirect() {
  redirect("/app");
}
