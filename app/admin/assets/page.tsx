import Link from "next/link";
import { getProducts } from "@/lib/store";
import { listPatternFiles, getModelUrl } from "@/lib/pattern-files";

export const dynamic = "force-dynamic";

// Index of per-SKU production assets (CAD patterns + 3D model). Counts are read
// straight from the buckets — no extra table to keep in sync.
export default async function AssetsIndexPage() {
  const products = (await getProducts({ includeDrafts: true })).sort((a, b) => a.sortOrder - b.sortOrder);

  const rows = await Promise.all(
    products.map(async (p) => {
      const [patterns, modelUrl] = await Promise.all([listPatternFiles(p.slug), getModelUrl(p.slug)]);
      return { p, patterns: patterns.length, hasModel: Boolean(modelUrl) };
    })
  );

  return (
    <main className="page">
      <header className="assetmgr-head">
        <p className="eyebrow">Back office</p>
        <h1 className="page-title">Production assets</h1>
        <p className="assetmgr-sub">CAD pattern files (gated) + 3D models (PDP) per style.</p>
      </header>

      <table className="assetmgr-table">
        <thead>
          <tr>
            <th>Style</th>
            <th>Category</th>
            <th>Patterns</th>
            <th>3D</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, patterns, hasModel }) => (
            <tr key={p.id}>
              <td>
                <strong>{p.displayName}</strong>
                <span className="assetmgr-table-sku">{p.skuCode}</span>
              </td>
              <td>{p.category}</td>
              <td>{patterns > 0 ? `${patterns} file${patterns > 1 ? "s" : ""}` : <span className="assetmgr-muted">—</span>}</td>
              <td>{hasModel ? <span className="assetmgr-yes">✓</span> : <span className="assetmgr-muted">—</span>}</td>
              <td><Link className="assetmgr-link" href={`/admin/assets/${p.slug}`}>Manage →</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
