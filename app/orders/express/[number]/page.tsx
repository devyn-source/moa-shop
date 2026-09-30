import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getExpressOrder, type ExpressOrderView } from "@/lib/express-account";
import { currency } from "@/lib/pricing";
import { ExpressDecision } from "@/components/ExpressDecision";

export const dynamic = "force-dynamic";

const STEPS = [
  { key: "received", label: "Order received" },
  { key: "proof", label: "Proof" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "production", label: "In production" },
  { key: "shipped", label: "Shipped" },
];
function stepIndex(o: ExpressOrderView): number {
  if (o.shippedAt || o.status === "shipped" || o.status === "delivered") return 5;
  if (o.status === "launched") return 4;
  if (o.invoice.paid && o.allApproved) return 4;
  if (o.invoice.paid) return 3;
  if (o.allApproved) return 2;
  if (o.rounds.length) return 1;
  return 0;
}
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) + " PT" : "");
const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", opacity: 0.6 };
const card: React.CSSProperties = { background: "#fff", borderRadius: 12, padding: 18, border: "1px solid rgba(30,30,30,.1)" };

export default async function ExpressOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/orders/express/${number}`)}`);
  const o = await getExpressOrder(decodeURIComponent(number), email);
  if (!o) notFound();
  const at = stepIndex(o);
  const round = o.openRound?.round ?? null;

  return (
    <main className="page" style={{ display: "grid", gap: 28 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <Link href="/orders" style={{ ...label, textDecoration: "none", color: "inherit" }}>Your orders</Link>
        <p className="eyebrow">{o.mode === "sandbox" ? "Sandbox order · " : ""}Order {o.orderNumber}</p>
        <h1 style={{ margin: 0 }}>{o.statusLabel}</h1>
        <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
          Submitted {fmt(o.submittedAt)}
          {!o.rounds.length && o.proofDueAt ? ` · your proof arrives by ${fmt(o.proofDueAt)}` : ""}
        </p>
      </header>

      <ol aria-label="Order progress" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))`, gap: 6 }}>
        {STEPS.map((s, i) => (
          <li key={s.key} style={{ display: "grid", gap: 6 }}>
            <span style={{ height: 4, borderRadius: 2, background: i <= at ? "#1E1E1E" : "rgba(30,30,30,.12)" }} />
            <span style={{ ...label, opacity: i <= at ? 1 : 0.45 }}>{s.label}</span>
          </li>
        ))}
      </ol>

      <section style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{round ? `Proof round ${round}` : o.rounds.length ? "Your pieces" : "Your pieces"}</h2>
          {round ? <span style={label}>{round <= o.includedRounds ? `Round ${round} of ${o.includedRounds} included` : `Round ${round}, beyond the included rounds`}</span> : null}
        </div>
        {!o.rounds.length ? <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>We are checking every placement against your artwork. Your proof and invoice arrive here within 24 business hours.</p> : null}
        <div style={{ display: "grid", gap: 14 }}>
          {o.pieces.map((p) => (
            <article key={p.ref} style={{ ...card, display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 18 }} className="express-piece">
              <div style={{ display: "grid", gridTemplateColumns: p.mockups.length > 1 ? "1fr 1fr" : "1fr", gap: 8, alignContent: "start" }}>
                {p.mockups.length ? p.mockups.map((m) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={m} src={m} alt={`Proof mockup for ${p.title}`} style={{ width: "100%", height: "auto", borderRadius: 8, background: "#EEEAE3" }} />
                )) : <div style={{ aspectRatio: "4 / 3", borderRadius: 8, background: "#EEEAE3", display: "grid", placeItems: "center", fontSize: 11, opacity: 0.6 }}>Mockup in progress</div>}
              </div>
              <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
                <div>
                  <p style={{ ...label, margin: 0 }}>{p.decision === "approved" ? "Approved" : p.decision === "changes" ? "Change requested" : p.decision === "pending" ? "Waiting for you" : "In progress"}</p>
                  <h3 style={{ margin: "6px 0 0" }}>{p.summary}</h3>
                </div>
                {p.spec ? <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12, lineHeight: 1.6, opacity: 0.8 }}>{p.spec.split("\n").filter((l) => !/^(Engine |Artwork: http)/.test(l)).join("\n")}</pre> : null}
                {p.decision === "changes" && p.comment ? <p style={{ margin: 0, fontSize: 12 }}>Your note: &ldquo;{p.comment}&rdquo;</p> : null}
                {p.decision === "pending" && p.skuId ? <ExpressDecision number={o.orderNumber} skuId={p.skuId} /> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...card, display: "grid", gap: 10 }}>
        <p style={{ ...label, margin: 0 }}>Invoice · one payment for the full order</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 24 }}>{o.invoice.total ? currency(o.invoice.total) : "Sent with your proof"}</strong>
          {o.invoice.paid ? <span style={label}>Paid</span>
            : o.invoice.canPay ? <a className="button" href={o.invoice.payUrl || "#"}>Pay invoice</a>
            : <span style={{ fontSize: 12, opacity: 0.7 }}>{o.rounds.length ? "Approve every piece to pay" : "Arrives with your proof"}</span>}
        </div>
        {o.invoice.url ? <a href={o.invoice.url} style={{ fontSize: 12 }}>View invoice</a> : null}
        <p style={{ margin: 0, fontSize: 11, opacity: 0.6, lineHeight: 1.6 }}>By approving you confirm spelling, colours, placement and sizes. Screen colours differ slightly from finished goods. Nothing changes once production starts. One round of changes is included.</p>
      </section>

      {o.tracking ? (
        <section style={{ ...card, display: "grid", gap: 6 }}>
          <p style={{ ...label, margin: 0 }}>Tracking</p>
          <p style={{ margin: 0 }}>{[o.tracking.carrier, o.tracking.number].filter(Boolean).join(" ")}</p>
          {o.tracking.url ? <a href={o.tracking.url}>Track shipment</a> : null}
        </section>
      ) : null}

      {o.rounds.length ? (
        <section style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0 }}>History</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8, fontSize: 12 }}>
            {o.rounds.map((r) => (
              <li key={r.round} style={{ ...card, padding: 14 }}>
                <strong>Round {r.round}</strong> sent {fmt(r.sentAt)}
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {r.items.map((i) => <li key={i.skuId}>{i.title}: {i.decision === "approved" ? "approved" : i.decision === "changes" ? `change requested${i.comment ? ` (${i.comment})` : ""}` : "waiting"}{i.decidedBy ? ` by ${i.decidedBy}` : ""}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <style>{`@media (max-width: 760px){ .express-piece{ grid-template-columns: 1fr !important; } }`}</style>
    </main>
  );
}
