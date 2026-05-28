import Link from "next/link";
import { StudioPreview } from "@/components/StudioPreview";

export default function StudioPage() {
  return (
    <main className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Catalog</Link>
        <span aria-hidden>/</span>
        <span className="crumb-current">Design studio (prototype)</span>
      </nav>

      <div className="section-head">
        <div>
          <p className="eyebrow">Prototype</p>
          <h2>Live garment recolor + artwork</h2>
        </div>
      </div>

      <p className="lede" style={{ marginBottom: 18 }}>
        2.5D proof: artwork is masked to the garment and blended onto the fabric so it picks up folds; the garment
        recolors live. Upload your grey hoodie base and a logo to judge the real quality.
      </p>

      <StudioPreview defaultBase="/products/heavyweight-hoodie/hoodie-black-front.png" />
    </main>
  );
}
