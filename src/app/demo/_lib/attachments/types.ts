/**
 * 데모 사이트가 매다는 첨부 문서.
 *
 * **내용은 Markdown 으로 한 번만 쓴다.** 포맷은 그 뒤의 문제다 — 같은 트리를
 * `_lib/render/*` 의 PDF·XLSX·HWP 렌더러가 각자 옮긴다. 포맷마다 본문을 따로
 * 두면 같은 문서가 포맷별로 다른 내용이 되고, 그때부터는 무엇이 맞는지 아무도
 * 모른다.
 *
 * 첨부가 v4 데모의 핵심이다. 공고문 본문은 「붙임 참조」로 흘리고 **실제 값은
 * 여기에만 둔다** — 마감일, 모집인원, 제출서류. 에이전트가 사이트를 타고 들어와
 * 파일을 열지 않으면 답을 못 낸다.
 */
export type DemoFileFormat = "pdf" | "xlsx" | "hwp" | "docx";

export type DemoFile = {
  /** URL 의 마지막 조각이자 다운로드 파일명 */
  name: string;
  /** 목록에 보이는 제목 */
  title: string;
  format: DemoFileFormat;
  /** 목록에 찍는 표시용 용량. 실제 렌더 결과와는 무관하다 */
  size: string;
  /** 이 파일에만 있는 정보를 한 줄로 */
  note?: string;
  markdown: string;
};
