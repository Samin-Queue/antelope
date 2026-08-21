"use client";

/** 루트 레이아웃 자체가 터졌을 때의 마지막 방어선. html/body 를 직접 렌더한다. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>앱을 불러오지 못했습니다</h1>
        <p style={{ fontFamily: "monospace", fontSize: "0.875rem", opacity: 0.7 }}>
          {error.message}
        </p>
        <button onClick={reset} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
          다시 시도
        </button>
      </body>
    </html>
  );
}
