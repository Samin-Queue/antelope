import { site } from "@/content/site";

export function Proof() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-16">
      <p className="text-center text-sm font-medium">{site.proof.headline}</p>
      <p className="mt-1 text-center text-xs text-muted-foreground">{site.proof.sub}</p>
      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {site.proof.logos.map((logo) => (
          <li
            key={logo}
            className="font-mono text-sm font-semibold tracking-[0.2em] text-muted-foreground/60"
          >
            {logo}
          </li>
        ))}
      </ul>
    </section>
  );
}
