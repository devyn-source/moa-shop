// Branded route skeleton while a PDP loads — mirrors the configurator layout
// (breadcrumb, 4:5 stage, step rail + price block). Styles live under
// "Route loading skeletons" at the end of app/globals.css.
export default function ProductLoading() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading product">
      <span className="skel skel--line" style={{ width: 200, marginTop: 4 }} />
      <div className="skel-pdp">
        <span className="skel skel-stage" />
        <div className="skel-rail">
          <span className="skel skel--line" style={{ width: 90 }} />
          <span className="skel skel--title" style={{ width: "78%", height: 42 }} />
          <span className="skel skel--line" style={{ width: "92%" }} />
          <span className="skel skel--line" style={{ width: "70%" }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="skel" style={{ height: 54, marginTop: i === 0 ? 14 : 0 }} />
          ))}
          <span className="skel" style={{ height: 110, marginTop: 14 }} />
        </div>
      </div>
    </main>
  );
}
