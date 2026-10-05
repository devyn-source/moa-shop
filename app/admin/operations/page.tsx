import Link from "next/link";
import { getExpressOperations } from "@/lib/express-operations";
export default async function OperationsPage() {
  const report = await getExpressOperations();
  return <main className="page">
    <p className="eyebrow">Operator console</p><h1 className="page-title">Launch operations</h1>
    <p className="lede">{report.mode}. Checked {report.checkedAt}. Reload to run fresh read-only checks.</p>
    <p>Passing checks do not authorize launch. Stripe rehearsal, staff access, job monitoring, samples, supplier terms, and final costs still require evidence.</p>
    <section className="info-section"><div className="section-head"><h2>Service checks</h2><Link className="ghost-button" href="/admin">Back to console</Link></div>
      <div className="table-card" style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Check</th><th>Result</th><th>Evidence and next action</th></tr></thead><tbody>{report.checks.map(check => <tr key={check.id}><td>{check.label}</td><td><span className="status-pill">{check.state}</span></td><td>{check.detail}</td></tr>)}</tbody></table></div>
    </section>
    <section className="info-section"><h2>Orders needing review</h2><p>Includes sandbox records. This page never retries payments, issues refunds, or sends messages.</p>
      {report.truncated ? <p>Queue display is limited. Resolve the oldest records and reload.</p> : null}
      {report.incidents.length ? <div className="table-card" style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Order</th><th>Mode</th><th>Issue</th><th>Recorded</th><th>Action</th></tr></thead><tbody>{report.incidents.map((item, i) => <tr key={`${item.reference}-${i}`}><td>{item.reference}</td><td>{item.mode}</td><td>{item.issue}</td><td>{item.since}</td><td>{item.action}</td></tr>)}</tbody></table></div> : <p>{report.checks.find(check => check.id === "queues")?.state === "pass" ? "No open payment or refund exceptions found." : "Queue status is unavailable. Review the service checks above."}</p>}
    </section>
  </main>;
}
