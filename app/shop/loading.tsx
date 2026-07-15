// Branded route skeleton while the catalog loads — mirrors the shop layout
// (intro copy + product grid). Styles live under "Route loading skeletons"
// at the end of app/globals.css.
export default function ShopLoading() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading the catalog">
      <div className="skel-intro">
        <span className="skel skel--line" style={{ width: 120 }} />
        <span className="skel skel--title" style={{ width: "min(540px, 82%)" }} />
        <span className="skel skel--line" style={{ width: "min(680px, 96%)" }} />
        <span className="skel skel--line" style={{ width: "min(560px, 80%)" }} />
      </div>
      <div className="skel-grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <div className="skel-card" key={i}>
            <span className="skel skel-card-visual" />
            <div className="skel-card-body">
              <span className="skel skel--line" style={{ width: "68%" }} />
              <span className="skel skel--line" style={{ width: "88%" }} />
              <span className="skel skel--line" style={{ width: "42%" }} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
