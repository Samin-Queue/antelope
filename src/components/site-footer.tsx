import { Wordmark } from "@/components/brand";
import { site } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5">
        <Wordmark className="h-4 w-auto opacity-60" />
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span>{site.team} · JunctionX Korea 2026 · 포항</span>
          <span className="text-xs">
            8월 21–23일 · Demo Expo 8/23 13:00 · Final Pitch 16:00
          </span>
        </div>
      </div>
    </footer>
  );
}
