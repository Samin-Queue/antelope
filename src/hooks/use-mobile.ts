import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * shadcn 생성본은 useEffect 안에서 setState 를 불러 react-hooks 규칙에 걸린다.
 * matchMedia 는 외부 스토어이므로 useSyncExternalStore 가 정확한 도구다 —
 * 이펙트 없이 구독하고, 서버에서는 스냅샷을 false 로 준다.
 */
const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // 서버에는 뷰포트가 없다. 데스크톱을 기본으로 두고 하이드레이션 후 정정된다.
    () => false,
  );
}
