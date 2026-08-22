"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { engine } from "@/content/engine";

/**
 * 절 탭.
 *
 * 이 문서는 열한 절이고 세로로 길다. 목차 없이 두면 「Studio 구성이 어디
 * 있나」를 스크롤로 찾아야 하는데, 검증하러 온 사람은 대개 한두 절만 보러 온다.
 *
 * **지금 어느 절을 보고 있는지도 같이 보여준다.** 탭이 이동만 하고 현재 위치를
 * 안 알려주면 긴 문서에서 자기가 어디쯤인지 잃는다. 스크롤 위치를 계산하지 않고
 * `IntersectionObserver` 로 판정한다 — 절 높이가 제각각이라 비율로는 안 맞는다.
 */

/**
 * 판정선.
 *
 * `Section` 의 `scroll-mt-28`(112px)과 **같은 값이어야 한다.** 이보다 위에
 * 그으면 탭을 눌러 막 도착한 절이 선 아래에 서서 안 잡히고, 활성 표시가
 * 한 칸 앞 절에 머문다(실측: 「슬랙」을 눌렀는데 「브라우저」가 켜짐).
 * 여유 24px 은 부드러운 스크롤이 1px 단위로 멈추지 않기 때문이다.
 */
const SCROLL_MARGIN = 112;
const LINE = SCROLL_MARGIN + 24;

export function SectionTabs() {
  const [active, setActive] = useState<string>(engine.tabs[0].id);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = engine.tabs
      .map((tab) => document.getElementById(tab.id))
      .filter((node): node is HTMLElement => node !== null);
    if (sections.length === 0) return;

    /**
     * 화면 위쪽에 걸린 것 중 **가장 아래**를 현재로 본다.
     *
     * 교차 상태만 보면 절 두 개가 동시에 보일 때 위쪽이 이기는데, 사람이 읽고
     * 있는 것은 방금 올라온 아래쪽이다.
     */
    const pick = () => {
      let current = sections[0];
      for (const node of sections) {
        if (node.getBoundingClientRect().top <= LINE) current = node;
      }
      setActive(current.id);
    };

    const observer = new IntersectionObserver(pick, {
      rootMargin: `-${SCROLL_MARGIN}px 0px 0px 0px`,
      threshold: [0, 1],
    });
    for (const node of sections) observer.observe(node);
    // 관측자는 경계를 지날 때만 깨어난다. 새로고침 직후·해시 진입은 따로 한 번.
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", pick);
    };
  }, []);

  // 활성 탭이 가로 스크롤 밖으로 나가면 따라 들어오게 한다. 모바일에서 필수다.
  useEffect(() => {
    const node = bar.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    node?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <div className="sticky top-14 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div
        ref={bar}
        className="mx-auto flex w-full max-w-6xl [scrollbar-width:none] gap-1 overflow-x-auto px-5 [&::-webkit-scrollbar]:hidden"
      >
        {engine.tabs.map((tab) => (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            data-tab={tab.id}
            aria-current={active === tab.id ? "true" : undefined}
            onClick={(event) => {
              // 기본 동작은 순간이동이다. 어디로 갔는지 보이지 않으면 긴 문서에서
              // 방향 감각을 잃는다. 주소창의 해시는 그대로 남긴다.
              const target = document.getElementById(tab.id);
              if (!target) return;
              event.preventDefault();
              target.scrollIntoView({ behavior: "smooth", block: "start" });
              history.replaceState(null, "", `#${tab.id}`);
              setActive(tab.id);
            }}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-xs whitespace-nowrap transition-colors",
              active === tab.id
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </a>
        ))}
      </div>
    </div>
  );
}
