import { site } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 text-sm text-muted-foreground">
        <span>
          {site.team} · JunctionX Korea 2026 · 포항
        </span>
        <span className="text-xs">8월 21–23일 · Demo Expo 8/23 13:00 · Final Pitch 16:00</span>
      </div>
    </footer>
  );
}
