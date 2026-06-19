import Link from "next/link";

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Features</h1>
      <div className="space-y-4">
        <div className="card">
          <h2 className="font-semibold">Milestone 0 — Text to image</h2>
          <p className="mt-2 text-sm text-skill-muted">
            Describe an image, pick quality (good / medium / budget). No model names, no node
            graphs.
          </p>
        </div>
        <div className="card opacity-70">
          <h2 className="font-semibold">Coming soon — Skill categories</h2>
          <p className="mt-2 text-sm text-skill-muted">
            E-commerce, short drama, ASMR, anime realism, 3D, game scenes, music, and more.
          </p>
        </div>
      </div>
      <Link href="/app" className="btn-primary mt-8 inline-block">
        Try it now
      </Link>
    </div>
  );
}
