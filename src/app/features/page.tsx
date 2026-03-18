import Link from "next/link";

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Features</h1>
      <div className="space-y-4">
        <div className="card">
          <h2 className="font-semibold">Studio canvas</h2>
          <p className="mt-2 text-sm text-skill-muted">
            Infinite canvas for shots and beats. See flow relationships and generation results
            (image / text) on the board; change prompts and quality in the right panel only.
          </p>
        </div>
        <div className="card">
          <h2 className="font-semibold">Skill openings</h2>
          <p className="mt-2 text-sm text-skill-muted">
            Start from productized templates — Pixar-style short, viral remake, scene beat —
            then refine on the canvas without learning ComfyUI nodes.
          </p>
        </div>
        <div className="card opacity-70">
          <h2 className="font-semibold">Coming soon — Video blocks</h2>
          <p className="mt-2 text-sm text-skill-muted">
            Short motion and frame sequences as first-class canvas results.
          </p>
        </div>
      </div>
      <Link href="/studio" className="btn-primary mt-8 inline-block">
        Open studio
      </Link>
    </div>
  );
}
