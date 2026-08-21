"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * 히어로 헤드라인의 회전 변수.
 *
 * 「무엇이든 된다」는 주장을 아래 섹션까지 스크롤해야 알 수 있으면 늦다.
 * 첫 화면에서 문장 한가운데를 갈아끼워 보여준다.
 *
 * 폭을 px 로 재서 transition 을 건다. auto 폭은 전환이 안 걸려 가운데 정렬된
 * 문장이 글자 수가 바뀔 때마다 툭 튄다.
 */

/** 목적격 조사. 받침 유무로 갈린다 — 항목을 추가할 때 손으로 적지 않게 계산한다. */
function objectParticle(word: string): string {
  const last = word.trim().at(-1) ?? "";
  const code = last.charCodeAt(0);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return "를";
  return (code - 0xac00) % 28 === 0 ? "를" : "을";
}

/** 한 문구가 머무는 시간. 더 줄이면 열 글자 넘는 문구를 다 읽기 전에 넘어간다. */
const HOLD_MS = 1400;
const OUT_MS = 140;

export function HeroRotator({ items }: { items: readonly string[] }) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const sizersRef = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // 폰트가 늦게 붙고 브레이크포인트마다 글자 크기가 달라진다. 둘 다 다시 잰다.
  useEffect(() => {
    const measure = () => {
      const element = sizersRef.current[index];
      if (element) setWidth(element.getBoundingClientRect().width);
    };
    measure();
    void document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [index]);

  // index 가 바뀔 때마다 다시 무장한다 — setInterval 안에 setTimeout 을 중첩하면
  // 언마운트 시 안쪽 타이머가 남는다.
  useEffect(() => {
    if (items.length < 2) return;
    let swap: number | undefined;
    const hold = window.setTimeout(() => {
      if (reduced) {
        setIndex((current) => (current + 1) % items.length);
        return;
      }
      setLeaving(true);
      swap = window.setTimeout(() => {
        setIndex((current) => (current + 1) % items.length);
        setLeaving(false);
      }, OUT_MS);
    }, HOLD_MS);

    return () => {
      window.clearTimeout(hold);
      if (swap) window.clearTimeout(swap);
    };
  }, [index, items.length, reduced]);

  const current = items[index];

  return (
    <span
      className="relative inline-block align-baseline whitespace-nowrap transition-[width] duration-300 ease-out motion-reduce:transition-none"
      style={width === null ? undefined : { width }}
    >
      {/* aria-live 를 걸지 않는다 — 1.4초마다 낭독이 끊기는 게 이득보다 크다 */}
      <span
        key={index}
        className={cn(
          "inline-block transition-[opacity,transform] duration-150 ease-out",
          leaving && "-translate-y-[0.22em] opacity-0",
          !leaving &&
            !reduced &&
            "animate-in duration-200 fade-in-0 slide-in-from-bottom-2",
        )}
      >
        {/* 색은 바뀌는 말에만 준다. 조사는 문장의 일부라 본문 색을 유지한다 */}
        <span className="text-brand">{current}</span>
        {objectParticle(current)}
      </span>

      {/* 폭 측정용. visibility:hidden 이라 레이아웃은 남고 화면에는 안 보인다 */}
      {items.map((item, itemIndex) => (
        <span
          key={item}
          aria-hidden
          ref={(element) => {
            sizersRef.current[itemIndex] = element;
          }}
          className="pointer-events-none invisible absolute top-0 left-0 whitespace-nowrap"
        >
          {item}
          {objectParticle(item)}
        </span>
      ))}
    </span>
  );
}
