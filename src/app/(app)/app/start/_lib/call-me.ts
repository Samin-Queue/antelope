"use client";

import { useEffect, useRef } from "react";

/**
 * 사람을 부른다.
 *
 * 캡챠는 **우리가 풀지 않는다.** 사이트가 사람인지 확인하려고 둔 통제이고,
 * 우회해서 낸 신청은 무효 처리될 때 손해가 사용자 쪽이다. 대신 남은 불편을
 * 없앤다 — 지금까지는 사람이 화면을 지키고 있어야 캡챠가 떴다는 걸 알았다.
 * 안 보고 있으면 에이전트가 10분을 기다리다 그냥 끝났다.
 *
 * 셋을 함께 쓴다. 하나만으로는 새는 경우가 있다:
 *
 * 1. **탭 제목** — 권한도 포커스도 필요 없다. 다른 탭에 있으면 이게 가장 먼저 보인다.
 * 2. **브라우저 알림** — 창이 아예 뒤에 있거나 최소화됐을 때. 권한은 **이 순간에만**
 *    묻는다. 페이지를 열자마자 묻는 것은 대개 거절당하고, 그러면 정작 필요할 때 못 쓴다.
 * 3. **소리** — 알림을 끈 브라우저가 많다. WebAudio 로 짧게 두 번.
 *
 * 사용자가 탭으로 돌아오면 전부 멈춘다. 볼일이 끝났는데 계속 부르면 그게 더 나쁘다.
 */
export function useCallMe(reason: string | null, title: string) {
  const original = useRef<string | null>(null);

  useEffect(() => {
    if (!reason) return;

    // ── 1. 탭 제목
    original.current ??= document.title;
    let on = false;
    const flash = window.setInterval(() => {
      on = !on;
      document.title = on ? `🖐 ${title}` : (original.current ?? title);
    }, 900);

    // ── 2. 알림
    const notify = () => {
      try {
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
          new Notification("신청을 이어가려면 확인이 필요합니다", {
            body: reason,
            tag: "antelope-need-human",
          });
        } else if (Notification.permission === "default") {
          void Notification.requestPermission().then((granted) => {
            if (granted === "granted") {
              new Notification("신청을 이어가려면 확인이 필요합니다", {
                body: reason,
                tag: "antelope-need-human",
              });
            }
          });
        }
      } catch {
        /* 권한 정책이 막는 환경이 있다. 나머지 둘로 충분하다 */
      }
    };
    notify();

    // ── 3. 소리
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) {
        const audio = new Ctor();
        for (const at of [0, 0.28]) {
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.0001, audio.currentTime + at);
          gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + at + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + 0.18);
          osc.connect(gain).connect(audio.destination);
          osc.start(audio.currentTime + at);
          osc.stop(audio.currentTime + at + 0.2);
        }
        window.setTimeout(() => void audio.close().catch(() => {}), 1_200);
      }
    } catch {
      /* 사용자 제스처 없이는 소리를 막는 브라우저가 있다 */
    }

    // 돌아오면 제목을 되돌린다. 아직 할 일은 화면 배너가 말한다.
    const settle = () => {
      if (document.visibilityState !== "visible") return;
      window.clearInterval(flash);
      document.title = original.current ?? title;
    };
    document.addEventListener("visibilitychange", settle);

    return () => {
      window.clearInterval(flash);
      document.removeEventListener("visibilitychange", settle);
      document.title = original.current ?? title;
    };
  }, [reason, title]);
}
