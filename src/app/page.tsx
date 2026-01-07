import { QUALITY_CREDITS } from "@/lib/credits";
import { HomeFooterLinks, HomeHero } from "@/components/HomeHero";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <HomeHero />

      <section
        aria-hidden
        className="relative mt-10 overflow-hidden rounded-2xl border border-skill-blue/20 bg-slate-950 shadow-inner"
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative grid min-h-[220px] grid-cols-[1fr_140px] gap-0">
          <div className="relative p-6">
            <div className="absolute left-10 top-12 w-36 rounded-lg border border-slate-700 bg-slate-900/90 p-2 shadow-lg">
              <div className="mb-2 h-2 w-16 rounded bg-slate-700" />
              <div className="h-16 rounded bg-slate-800" />
            </div>
            <div className="absolute left-44 top-24 w-36 rounded-lg border border-sky-500/40 bg-slate-900/90 p-2 shadow-lg">
              <div className="mb-2 h-2 w-20 rounded bg-slate-700" />
              <div className="h-16 rounded bg-gradient-to-br from-sky-900/80 to-slate-800" />
            </div>
            <svg
              className="absolute left-[148px] top-[88px] text-sky-400/70"
              width="40"
              height="24"
              viewBox="0 0 40 24"
              fill="none"
            >
              <path
                d="M0 12 H28 M28 12 L20 6 M28 12 L20 18"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <div className="border-l border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 h-2 w-16 rounded bg-slate-700" />
            <div className="space-y-2">
              <div className="h-8 rounded bg-slate-800" />
              <div className="h-8 rounded bg-slate-800" />
              <div className="h-8 rounded bg-sky-700/60" />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Flow on the canvas",
            desc: "Drag blocks, link shots, keep the story layout visible.",
          },
          {
            title: "Results in place",
            desc: "Images and text land on the block — params stay on the right.",
          },
          {
            title: "Simple credits",
            desc: `Pick Good (${QUALITY_CREDITS.premium}), Medium (${QUALITY_CREDITS.standard}), or Budget (${QUALITY_CREDITS.budget}) when you generate — billing stays out of the way.`,
          },
        ].map((item) => (
          <div key={item.title} className="card">
            <h3 className="mb-2 font-semibold">{item.title}</h3>
            <p className="text-sm text-skill-muted">{item.desc}</p>
          </div>
        ))}
      </section>

      <HomeFooterLinks />
    </div>
  );
}
