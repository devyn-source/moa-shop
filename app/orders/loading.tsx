// Branded route skeleton while the order list loads — mirrors the orders page
// (heading + list rows). Styles live under "Route loading skeletons" at the
// end of app/globals.css.
export default function OrdersLoading() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading your orders">
      <div style={{ display: "grid", gap: 10 }}>
        <span className="skel skel--line" style={{ width: 110 }} />
        <span className="skel skel--title" style={{ width: 240 }} />
        <span className="skel skel--line" style={{ width: 180 }} />
      </div>
      <div className="skel-rows">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="skel skel-row" />
        ))}
      </div>
    </main>
  );
}
