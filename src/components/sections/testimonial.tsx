import { site } from "@/content/site";

export function Testimonial() {
  return (
    <section id="usecases" className="border-y border-border/60 bg-card/30">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-24 lg:grid-cols-[1fr_auto] lg:items-end">
        <blockquote className="max-w-3xl text-xl leading-relaxed font-medium text-balance sm:text-2xl">
          <span aria-hidden className="mr-1 text-brand">
            “
          </span>
          {site.testimonial.quote}
        </blockquote>
        <footer className="text-sm">
          <div className="font-medium">{site.testimonial.author}</div>
          <div className="text-muted-foreground">{site.testimonial.role}</div>
        </footer>
      </div>
    </section>
  );
}
