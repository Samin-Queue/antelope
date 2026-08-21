import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { site } from "@/content/site";

export function Pillars() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20">
      <div className="grid gap-4 sm:grid-cols-3">
        {site.pillars.map((pillar) => (
          <Card key={pillar.title} className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-base">{pillar.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              {pillar.body}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
