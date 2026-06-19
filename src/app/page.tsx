import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <section className="card text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-skill-blue-dark">
          Skill-driven · ComfyUI powered
        </p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
          Create AI visuals without learning nodes
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-skill-muted">
          ComfySkill hides ComfyUI complexity. Describe what you need — we pick models,
          resolution, and workflow. Start with text to image today.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/app" className="btn-primary">
            Start creating
          </Link>
          <Link href="/pricing" className="btn-secondary">
            View pricing
          </Link>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          { title: "Pick your goal", desc: "E-commerce, short video, ASMR — coming soon" },
          { title: "Choose quality", desc: "Good, medium, or budget — no model names" },
          { title: "Get results", desc: "Credits-based, simple billing" },
        ].map((item) => (
          <div key={item.title} className="card">
            <h3 className="mb-2 font-semibold">{item.title}</h3>
            <p className="text-sm text-skill-muted">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
