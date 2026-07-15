// Branded route skeleton while an order detail loads — mirrors the tracker
// hero + receipt card (mockup pane + spec lines). Styles live under
// "Route loading skeletons" at the end of app/globals.css.
export default function OrderLoading() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading order">
      <span className="skel skel--line" style={{ width: 170 }} />
      <span className="skel" style={{ height: 150, borderRadius: 18, marginTop: 16, display: "block" }} />
      <div className="skel-ord">
        <span className="skel skel-ord-mockup" />
        <div className="skel-ord-detail">
          <span className="skel skel--line" style={{ width: 80 }} />
          <span className="skel skel--title" style={{ width: "64%" }} />
          <span className="skel skel--line" style={{ width: "50%" }} />
          <span className="skel skel--line" style={{ width: "72%" }} />
          <span className="skel skel--line" style={{ width: "58%" }} />
          <span className="skel" style={{ height: 84, marginTop: 8 }} />
        </div>
      </div>
    </main>
  );
}
