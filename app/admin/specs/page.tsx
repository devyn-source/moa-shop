import Link from "next/link";
import { listCatalogSpecs } from "@/lib/garment-spec-store";
import { reviewBurden, isPassportLocked } from "@/lib/garment-spec";

export const dynamic = "force-dynamic";

export default async function SpecsPage() {
  const specs = await listCatalogSpecs();
  return (
    <main className="page">
      <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Admin</p>
      <h1 className="page-title">Garment passports</h1>
      <p className="lede" style={{ marginBottom: 18 }}>
        Capture + lock the per-SKU garment spec. A SKU is releasable to a vendor only when its passport is <strong>locked</strong> — every
        field a real, confirmed value.
      </p>
      <div className="ol-list">
        {specs.map(({ slug, spec, status }) => {
          const { assumed, questions } = reviewBurden(spec);
          const locked = isPassportLocked({ ...spec, _status: status });
          return (
            <div key={slug} className="ol-card">
              <div className="ol-top">
                <div className="ol-info">
                  <Link href={`/admin/specs/${slug}`} className="ol-title">{spec.styleName}</Link>
                  <p className="ol-meta">{slug} · {spec.styleNumber} · {spec.sizeChart.poms.length} POMs</p>
                </div>
                <span className={`spec-status spec-status--${locked ? "approved" : status}`}>{locked ? "locked" : status}</span>
              </div>
              <div className="ol-foot">
                <span className="ol-meta">{assumed} to confirm · {questions} open question{questions === 1 ? "" : "s"}</span>
                <Link href={`/admin/specs/${slug}`} className="ol-track">Edit →</Link>
              </div>
            </div>
          );
        })}
        {specs.length === 0 ? <p className="ol-meta">No passports stored yet.</p> : null}
      </div>
    </main>
  );
}
