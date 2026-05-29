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
        Industry-standard placement: pick a print location per view, drop artwork into its zone, fine-tune size and
        rotation. Front and back hold separate artwork. Upload a grey base + logo to see recolor and fold shading.
      </p>

      <StudioPreview
        defaultFront="/products/heavyweight-hoodie/hoodie-black-front.png"
        defaultBack="/products/heavyweight-hoodie/hoodie-black-back.png"
      />
    </main>
  );
}
