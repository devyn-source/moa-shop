import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page nf">
      <div className="nf-inner">
        <p className="eyebrow">404</p>
        <h1 className="nf-headline">This page isn&apos;t in the catalog</h1>
        <p className="nf-lede">
          The URL might be off, the SKU was retired, or the link is older than this build. Head back to the catalog —
          everything live is there.
        </p>
        <div className="action-row" style={{ marginTop: 24 }}>
          <Link href="/" className="button">
            Back to catalog
          </Link>
        </div>
      </div>
    </main>
  );
}
