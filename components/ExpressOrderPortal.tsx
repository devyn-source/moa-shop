import Link from "next/link";
import type { ExpressOrderView } from "@/lib/express-account";
import { currency } from "@/lib/pricing";
import { ExpressDecision } from "./ExpressDecision";
import { ExpressCancellation } from "./ExpressCancellation";
import styles from "./ExpressOrderPortal.module.css";

const STEPS = ["Order placed", "Artwork & approval", "Production", "Shipping", "Delivered"];
function stage(o: ExpressOrderView) {
  if (o.status === "delivered") return 4;
  if (o.shippedAt || o.status === "shipped") return 3;
  if (o.status === "launched" || o.fulfillment) return 2;
  if (o.rounds.length || o.invoice.paid) return 1;
  return 0;
}
function date(value: string | null, time = false) {
  return value ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", ...(time ? { hour: "numeric", minute: "2-digit" } as const : { year: "numeric" } as const), timeZone: "America/Los_Angeles" }) + (time ? " PT" : "") : "";
}
function Icon({ name, className }: { name: "check" | "arrow" | "box" | "clock" | "mail" | "file"; className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "check" ? <path d="m5 12 4 4L19 6" /> : name === "arrow" ? <path d="M5 12h14m-5-5 5 5-5 5" /> : name === "box" ? <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5M3 8l9 5v9M7.5 5.5l9 5v4" /></> : name === "clock" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : name === "mail" ? <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></> : <><path d="M14 3H6v18h12V7l-4-4Zm0 0v5h4M9 12h6M9 16h6" /></>}
  </svg>;
}
function heading(o: ExpressOrderView) {
  if (o.status === "cancelled") return { title: "Order cancelled.", text: "Your cancellation and refund details are below." };
  if (o.fulfillment?.onHold) return { title: "Your order is on hold.", text: "Your order is on hold while our team resolves an issue. We will confirm the next update." };
  if (o.status === "delivered") return { title: "Made for you. Delivered.", text: o.mode === "sandbox" ? "Your test order has reached its final milestone. This delivery was simulated." : "Your order has arrived. Thank you for making it with Magnum Opus." };
  if (o.shippedAt || o.status === "shipped") return { title: "On its way to you.", text: o.mode === "sandbox" ? "Your test shipment is ready to review. No parcel was dispatched." : "Your pieces have shipped. Follow their journey with the tracking details below." };
  if (o.status === "launched" || o.fulfillment) return { title: "Your order is taking shape.", text: "Your artwork is approved. Follow your order through production right here." };
  if (o.allApproved) return { title: "All pieces approved.", text: "Every piece is approved. We will update your order as it moves into production." };
  if (o.openRound && o.pieces.some(p => p.decision === "pending")) return { title: "Ready for your review.", text: "Your proofs are ready. Take a close look, then approve each piece or let us know what to change." };
  if (o.pieces.some(p => p.decision === "changes")) return { title: "Refining the details.", text: "We have your feedback. Your next proof will appear here when it is ready to review." };
  return { title: o.invoice.paid ? "Your proof is in progress." : "Let’s make it yours.", text: o.invoice.paid ? "We are checking your artwork, measurements and placements. Your first proof is up next." : "Your order is here. Complete payment to get your production proof underway." };
}

/** Presentation only. The route authenticates and scopes the order to its owner. */
export function ExpressOrderPortal({ order: o }: { order: ExpressOrderView }) {
  const at = stage(o), round = o.openRound?.round ?? null, hero = heading(o);
  const units = o.pieces.reduce((n, p) => n + p.qty, 0);
  const events = [...(o.fulfillment?.events ?? [])].reverse();
  const refundComplete = o.cancellation?.status === "succeeded";
  const timeline = (items: typeof events) => <ol className={styles.timeline}>{items.map((event, i) => <li key={event.id}><span className={styles.timelineDot}><Icon name={i === 0 && event.id === events[0]?.id ? "check" : "clock"} /></span><div><strong>{event.label}</strong><time dateTime={event.at}>{date(event.at, true)}</time></div></li>)}</ol>;

  return <main className={styles.portal}>
    <div className={styles.topline}><Link className={styles.back} href="/orders"><span aria-hidden="true">←</span> All orders</Link><span className={styles.micro}>Your MOA workspace</span></div>
    <section className={styles.hero} aria-labelledby="order-heading">
      <div className={styles.heroMain}>
        <div className={styles.eyebrowRow}><span className={styles.micro}>Order {o.orderNumber}</span>{o.mode === "sandbox" ? <span className={styles.sandbox}>Sandbox preview</span> : null}</div>
        <h1 id="order-heading">{hero.title}</h1>
        <p className={styles.lede}>{hero.text}</p>
        <div className={styles.heroMeta}><span className={styles.status}><span />{o.fulfillment?.onHold ? "On hold" : o.statusLabel}</span><span>Placed {date(o.submittedAt)}</span></div>
      </div>
      <div className={styles.heroArt} aria-hidden="true"><div className={styles.orbit}><svg viewBox="0 0 160 160" fill="none"><path d="m80 28 52 29v51l-52 29-52-29V57l52-29Z" fill="var(--color-cream-dark)" stroke="currentColor" strokeWidth="1.4"/><path d="m28 57 52 29 52-29M80 86v51M54 42l52 29v24l-13 7V79L41 50" stroke="currentColor" strokeWidth="1.4"/><path d="m43 94 17 10m-17-2 11 6" stroke="currentColor" strokeWidth="1.4"/></svg><span className={styles.artSeal}><Icon name={at === 4 ? "check" : "box"} /></span></div><span className={styles.micro}>Considered. Crafted. Yours.</span></div>
      {o.status !== "cancelled" ? <ol className={styles.progress} aria-label="Order progress">{STEPS.map((step, i) => <li key={step} data-state={i < at ? "complete" : i === at ? "current" : "upcoming"} aria-current={i === at ? "step" : undefined}><span className={styles.stepNumber}>{i < at || at === 4 ? <Icon name="check" /> : String(i + 1).padStart(2, "0")}</span><span>{step}</span></li>)}</ol> : null}
      {o.status !== "cancelled" ? <p className={styles.mobileProgress}>Step {at + 1} of {STEPS.length} · {STEPS[at]}</p> : null}
    </section>
    {o.mode === "sandbox" ? <p className={styles.sandboxNote}><Icon name="file" />Test order only. Payments, production and delivery shown here are simulated.</p> : null}
    <div className={styles.layout}>
      <div className={styles.mainColumn}>
        <section aria-labelledby="pieces-heading" className={styles.pieces}>
          <div className={styles.sectionHead}><div><span className={styles.micro}>The details, made yours</span><h2 id="pieces-heading">Your pieces<span className={styles.count}>{o.pieces.length}</span></h2></div>{round ? <span className={styles.round}>Proof round {round}<small>{round <= o.includedRounds ? `${round} of ${o.includedRounds} included` : "Additional round"}</small></span> : null}</div>
          {!o.rounds.length && o.status !== "cancelled" ? <p className={styles.intro}>{o.invoice.paid ? `Your first production proof is due ${o.proofDueAt ? `by ${date(o.proofDueAt, true)}` : "by 5 p.m. Pacific on the next business day after payment (Monday to Friday)"}. You can approve it or request a change here.` : "After payment, your first production proof is due by 5 p.m. Pacific on the next business day (Monday to Friday)."}</p> : null}
          {o.pieces.map((p, i) => <article key={p.ref} className={styles.piece}>
            <div className={styles.proofVisual}>
              <div className={styles.proofLabel}><span className={styles.micro}>Piece {String(i + 1).padStart(2, "0")}</span><span>{p.mockups.length ? "Artwork proof" : "Proof in preparation"}</span></div>
              <div className={styles.proofImages} data-multiple={p.mockups.length > 1}>{p.mockups.length ? p.mockups.map((src, index) => <a key={src} className={styles.proofImage} href={src} target="_blank" rel="noopener noreferrer" aria-label={`Open proof ${index + 1} for ${p.title} in a new tab`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Proof ${index + 1} for ${p.title}`} loading="lazy" />
                <span className={styles.expand}>View full proof <Icon name="arrow" /></span>
              </a>) : <div className={styles.placeholder}><Icon name="file" /><p>A little care.<br />Every detail.</p><span>Your proof will appear here.</span></div>}</div>
            </div>
            <div className={styles.pieceBody}><div className={styles.pieceHeading}><div><h3>{p.title}</h3><p>{p.qty.toLocaleString()} units</p></div><span className={styles.badge} data-tone={p.decision === "approved" ? "success" : p.decision === "pending" ? "action" : "neutral"}>{p.decision === "approved" ? <Icon name="check" /> : null}{p.decision === "approved" ? "Approved" : p.decision === "changes" ? "Changes requested" : p.decision === "pending" ? "Review needed" : "In progress"}</span></div>
              {p.summary && p.summary !== p.title ? <p className={styles.pieceSummary}>{p.summary}</p> : null}
              {p.spec ? <details className={styles.details} open={p.decision === "pending"}><summary>Specifications & size run<span aria-hidden="true">+</span></summary><pre>{p.spec.split("\n").filter(l => !/^(Engine |Artwork: http)/.test(l)).join("\n")}</pre></details> : null}
              {p.decision === "changes" && p.comment ? <blockquote className={styles.feedback}><span className={styles.micro}>Your feedback</span><p>{p.comment}</p></blockquote> : null}
              {p.decision === "pending" && p.skuId && round && !["cancelled", "launched", "shipped", "delivered"].includes(o.status) ? <div className={styles.decisions}><ExpressDecision key={`${p.skuId}-${round}`} number={o.orderNumber} skuId={p.skuId} round={round} /></div> : null}
            </div>
          </article>)}
          <p className={styles.approvalNote}>Your first proof and one revision round are included. By approving, you confirm spelling, colours, placement and sizes. Screen colours may differ slightly from finished goods. Production timing starts after every piece is approved.</p>
        </section>
        {o.fulfillment ? <section className={styles.panel} aria-labelledby="journey-heading"><div className={styles.sectionHead}><div><span className={styles.micro}>From our hands to yours</span><h2 id="journey-heading">Your order’s journey</h2></div><Icon name="clock" /></div>
          {o.fulfillment.onHold ? <p className={styles.notice}>Your order is on hold. Our team will confirm the next update.</p> : null}
          {o.fulfillment.expectedShipDate && !o.shippedAt ? <p className={styles.notice}>Estimated ship date: {o.fulfillment.expectedShipDate}. Timing may change.</p> : null}
          {timeline(events.slice(0, 3))}{events.length > 3 ? <details className={styles.details}><summary>View {events.length - 3} earlier updates<span aria-hidden="true">+</span></summary>{timeline(events.slice(3))}</details> : null}
        </section> : null}
        {o.rounds.length ? <section className={styles.history}><details className={styles.details}><summary><span><Icon name="file" /> Proof history <small>{o.rounds.length} {o.rounds.length === 1 ? "round" : "rounds"}</small></span><span aria-hidden="true">+</span></summary><div className={styles.historyRounds}>{o.rounds.map(r => <div key={r.round}><div className={styles.historyHead}><strong>Round {r.round}</strong><time dateTime={r.sentAt}>Sent {date(r.sentAt, true)}</time></div><ul>{r.items.map(item => <li key={item.skuId}><strong>{item.title}</strong><span>{item.decision === "approved" ? "Approved" : item.decision === "changes" ? "Changes requested" : "Awaiting review"}{item.decidedBy ? ` by ${item.decidedBy}` : ""}</span>{item.comment ? <p>{item.comment}</p> : null}</li>)}</ul></div>)}</div></details></section> : null}
      </div>
      <aside className={styles.sidebar} aria-label="Order summary and support">
        <section className={`${styles.panel} ${styles.summary}`}><span className={styles.micro}>At a glance</span><h2>Order summary</h2><dl><div><dt>Order</dt><dd>{o.orderNumber}</dd></div>{o.company ? <div><dt>Prepared for</dt><dd>{o.company}</dd></div> : null}<div><dt>Pieces</dt><dd>{o.pieces.length} {o.pieces.length === 1 ? "style" : "styles"} · {units.toLocaleString()} units</dd></div><div><dt>Placed</dt><dd>{date(o.submittedAt)}</dd></div></dl><div className={styles.payment}><span className={styles.micro}>Order total</span><div className={styles.total}><strong>{currency(o.invoice.total)}</strong><span className={styles.badge} data-tone={o.invoice.paid || refundComplete ? "success" : "neutral"}>{refundComplete ? o.mode === "sandbox" ? "Test refund complete" : "Refund issued" : o.invoice.paid ? "Paid" : "Payment pending"}</span></div><p>One payment for your full order.{o.mode !== "sandbox" && o.invoice.tax != null ? ` Includes ${currency(o.invoice.tax)} sales tax.` : ""}</p>{!o.invoice.paid && o.invoice.canPay && o.invoice.payUrl ? <a className={styles.primaryLink} href={o.invoice.payUrl}>Pay invoice <Icon name="arrow" /></a> : null}{o.invoice.url ? <a className={styles.textLink} href={o.invoice.url}>View invoice <Icon name="arrow" /></a> : null}</div></section>
        {o.tracking ? <section className={`${styles.panel} ${styles.shipping}`}><div className={styles.sectionHead}><Icon name="box" /><span className={styles.micro}>{o.mode === "sandbox" ? "Test shipment" : "Delivery details"}</span></div><h2>{o.status === "delivered" ? "Delivered to you" : "Follow your shipment"}</h2>{o.fulfillment?.deliveredAt ? <p>{date(o.fulfillment.deliveredAt)}</p> : null}<div className={styles.tracking}><strong>{o.tracking.carrier || "Tracking number"}</strong><span>{o.tracking.number}</span></div>{o.tracking.url && o.mode !== "sandbox" ? <a className={styles.primaryLink} href={o.tracking.url} target="_blank" rel="noopener noreferrer">Track shipment <Icon name="arrow" /></a> : o.mode === "sandbox" ? <p className={styles.muted}>Simulated tracking. No parcel was dispatched.</p> : null}</section> : null}
        <section className={styles.support}><span className={styles.supportIcon}><Icon name="mail" /></span><h2>Your production team</h2><p>Questions about your order? Your production team is a message away.</p><a className={styles.textLink} href={`mailto:production@magnumopus.agency?subject=${encodeURIComponent(`Order ${o.orderNumber}`)}`}>Contact the team <Icon name="arrow" /></a></section>
        {o.canCancel || o.cancellation ? <section className={styles.cancellation}><h2>{o.cancellation ? "Cancellation & refund" : "Plans changed?"}</h2><p>{o.cancellation ? refundComplete ? o.mode === "sandbox" ? "Your test order is cancelled. No real charge or refund was made." : "Your order is cancelled and your full refund has been issued to the original payment method. Your bank may take 5 to 10 business days to display it." : ["failed", "canceled", "requires_action"].includes(o.cancellation.status) ? "Your order is cancelled, but the refund needs attention. Contact production@magnumopus.agency for help." : "Your order is cancelled. Refund processing is in progress; no pieces will enter production." : "You can cancel the whole order for a full refund before approving any piece."}</p>{o.canCancel || o.cancellation?.status === "requested" ? <ExpressCancellation number={o.orderNumber} retry={!!o.cancellation} /> : null}</section> : null}
      </aside>
    </div>
    <div className={styles.signoff}><span className={styles.micro}>Magnum Opus</span><span>Good work is in the details.</span></div>
  </main>;
}
