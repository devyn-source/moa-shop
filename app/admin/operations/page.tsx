import Link from "next/link";
import { getExpressOperations } from "@/lib/express-operations";
import { getSupabase } from "@/lib/supabase";
import { acknowledgeIncident } from "./actions";
import AlertReview from "./AlertReview";
export default async function OperationsPage() {
  const report = await getExpressOperations();
  const cases = await getSupabase().from("express_operation_incidents").select("id,summary,owner,opened_at,acknowledged_at,next_action,next_review_at").is("recovered_at", null).order("opened_at").limit(100);
  return <main className="page">
    <p className="eyebrow">Operator console</p><h1 className="page-title">Launch operations</h1>
    <p className="lede">{report.mode}. Checked {report.checkedAt}. Reload to run fresh read-only checks.</p>
    <p>Passing checks do not authorize launch. Stripe rehearsal, staff access, job monitoring, samples, supplier terms, and final costs still require evidence.</p>
    <p>Primary operator: Devyn. Backup: Tyler. Outbound alerts require approved content.</p>
    <section className="info-section"><div className="section-head"><h2>Service checks</h2><Link className="ghost-button" href="/admin">Back to console</Link></div>
      <div className="table-card" style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Check</th><th>Result</th><th>Evidence and next action</th></tr></thead><tbody>{report.checks.map(check => <tr key={check.id}><td>{check.label}</td><td><span className="status-pill">{check.state}</span></td><td>{check.detail}</td></tr>)}</tbody></table></div>
    </section>
    <section className="info-section"><h2>Orders needing review</h2><p>Includes sandbox records. Reviewing this queue does not retry payments or issue refunds. Slack alerts require separate approval below.</p>
      {report.truncated ? <p>Queue display is limited. Resolve the oldest records and reload.</p> : null}
      {report.incidents.length ? <div className="table-card" style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Order</th><th>Mode</th><th>Issue</th><th>Recorded</th><th>Action</th></tr></thead><tbody>{report.incidents.map((item, i) => <tr key={`${item.reference}-${i}`}><td>{item.reference}</td><td>{item.mode}</td><td>{item.issue}</td><td>{item.since}</td><td>{item.action}</td></tr>)}</tbody></table></div> : <p>{report.checks.find(check => check.id === "queues")?.state === "pass" ? "No open payment or refund exceptions found." : "Queue status is unavailable. Review the service checks above."}</p>}
    </section>
    <section className="info-section"><h2>Incident follow-through</h2>
      {cases.error ? <p>Incident records are unavailable. Do not treat this as an empty queue.</p> : !cases.data?.length ? <p>No active monitoring incidents.</p> : cases.data.map(item => <article className="table-card" style={{ padding: 24, marginBottom: 16 }} key={item.id}>
        <h3>{item.summary}</h3><p>Opened {item.opened_at}. {item.acknowledged_at ? `Acknowledged ${item.acknowledged_at}.` : "Awaiting acknowledgment."}</p>
        {item.next_review_at ? <p>Next review: {item.next_review_at}</p> : null}
        <form action={acknowledgeIncident} style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="id" value={item.id} />
          <label>Responsible operator <select name="owner" defaultValue={item.owner}><option>Devyn</option><option>Tyler</option></select></label>
          <label>Next action <textarea name="action" required minLength={5} maxLength={1000} defaultValue={item.next_action || ""} /></label>
          <label>Review again <select name="reviewHours" defaultValue="1"><option value="1">In one hour</option><option value="4">In four hours</option><option value="24">In 24 hours</option></select></label>
          <button type="submit" className="ghost-button">Acknowledge and save action</button>
        </form>
        <AlertReview incidentId={item.id} />
      </article>)}
    </section>
  </main>;
}
