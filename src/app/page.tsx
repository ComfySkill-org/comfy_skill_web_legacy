import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <section className="card text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-skill-blue-dark">
          Story-first creation canvas
        </p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
          Arrange shots on a canvas. See results, not node graphs.
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-skill-muted">
          ComfySkill is built around your work — scenes, beats, and previews on an infinite
          canvas. Edit parameters in the side panel; the engine stays behind the curtain.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/studio" className="btn-primary">
            Open studio
          </Link>
          <Link href="/pricing" className="btn-secondary">
            View pricing
          </Link>
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
            desc: "Pick quality when you need it; billing stays out of the way.",
          },
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
