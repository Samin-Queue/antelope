import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/** 앱 상단 바. 사이드바 토글 + 현재 위치 + 우측 액션. */
export function AppHeader({
  trail,
  actions,
}: {
  trail: string[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {trail.map((item, index) => (
            <BreadcrumbItem key={item}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbPage
                className={index < trail.length - 1 ? "text-muted-foreground" : undefined}
              >
                {item}
              </BreadcrumbPage>
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
