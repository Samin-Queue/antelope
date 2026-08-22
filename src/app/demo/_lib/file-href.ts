/**
 * 첨부 다운로드 주소.
 *
 * `attachments/index.ts` 와 갈라 둔다. 그쪽은 문서 본문 Markdown 을 통째로 들고
 * 있어서, 주소 한 줄이 필요한 **클라이언트 컴포넌트가 import 하면 본문 전체가
 * 브라우저 번들에 실린다.** 신청 폼 세 개가 정확히 그 경우다.
 */
export function fileHref(slug: string, name: string): string {
  return `/demo/${slug}/files/${encodeURIComponent(name)}`;
}
