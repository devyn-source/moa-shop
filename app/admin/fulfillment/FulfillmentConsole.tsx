"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LABELS, STAGES, type ProofItem, type QueueItem, type StaffOrder } from "./types";
import css from "./fulfillment.module.css";

const endpoint = "/api/admin/express-staff";
const date = (value?: string | null) => value ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) + " PT" : "Not recorded";
async function read(response: Response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Unable to load. Check your staff sign-in and retry.");
  return result;
}

export default function FulfillmentConsole() {
  const [queue, setQueue] = useState<QueueItem[]>([]), [order, setOrder] = useState<StaffOrder | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [truncated, setTruncated] = useState(false);
  const [selected, setSelected] = useState("");
  const sequence = useRef(0);
  async function load(number?: string) {
    const attempt = ++sequence.current;
    setLoading(true); setError(""); setOrder(null);
    try {
      const list = await read(await fetch(endpoint, { cache: "no-store" }));
      if (attempt !== sequence.current) return;
      setQueue(list.orders); setTruncated(list.truncated);
      const target = number || list.orders[0]?.order_number;
      setSelected(target || "");
      if (target) {
        const detail = await read(await fetch(`${endpoint}?number=${encodeURIComponent(target)}`, { cache: "no-store" }));
        if (attempt === sequence.current) setOrder(detail.order);
      }
    } catch (e) { if (attempt === sequence.current) setError(e instanceof Error ? e.message : "Could not load orders"); }
    finally { if (attempt === sequence.current) setLoading(false); }
  }
  useEffect(() => { void load(); return () => { sequence.current++; }; }, []);
  return <main className={css.console}>
    <header className={css.header}><div><p className={css.label}>MOA Catalog / Operations</p><h1>Order fulfillment</h1></div><Link className={css.secondary} href="/admin/operations">Service checks</Link></header>
    <div className={css.banner}><strong>Sandbox rehearsal.</strong> Updates are simulated. Messages and factory release are disabled.</div>
    {error ? <p role="alert" className={css.error}>{error} <button className={css.secondary} onClick={() => load(selected)}>Reload</button></p> : null}
    <div className={css.layout}>
      <aside className={css.queue}><h2>Orders</h2>{queue.map(item => <button key={item.order_number} className={css.order} aria-current={selected === item.order_number} disabled={loading} onClick={() => load(item.order_number)}><strong>{item.order_number}</strong><span className={css.muted}>{item.status.replaceAll("_", " ")}</span></button>)}{!loading && !queue.length ? <p className={css.card}>No sandbox orders.</p> : null}{truncated ? <p className={css.muted}>Showing the latest 100 orders.</p> : null}</aside>
      {loading ? <section className={css.card} aria-live="polite">Loading order</section> : order ? <OrderWorkspace key={order.number} initial={order} reload={() => load(order.number)} /> : null}
    </div>
  </main>;
}

function OrderWorkspace({ initial, reload }: { initial: StaffOrder; reload: () => void }) {
  const [order, setOrder] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState("");
  const [uncertain, setUncertain] = useState(false), [note, setNote] = useState(""), [shipDate, setShipDate] = useState("");
  const [factories, setFactories] = useState<Record<string, string>>({}), [evidence, setEvidence] = useState(""), [checked, setChecked] = useState(false);
  const [carrier, setCarrier] = useState("UPS"), [tracking, setTracking] = useState(""), [trackingUrl, setTrackingUrl] = useState("");
  const [mockups, setMockups] = useState<Record<string, string[]>>({}), [specChecked, setSpecChecked] = useState(false);
  const inFlight = useRef(false);
  const state = order.fulfillment;
  const latest = new Map<string, ProofItem>();
  for (const round of order.rounds) for (const item of round.items) if (latest.get(item.sku_id)?.decision !== "approved") latest.set(item.sku_id, item);
  const needs = order.lines.filter(line => line.sku_id && (!order.rounds.length || latest.get(line.sku_id)?.decision === "changes"));
  const nextRound = order.rounds.length + 1;
  const proofOpen = order.rounds.some(round => !round.closed_at);
  const proofReady = order.paid && !order.cancelled && !order.approved && !proofOpen && needs.length > 0 && nextRound <= 2;
  const disabled = busy || uncertain || order.cancelled || !order.paid;
  const action = state ? ({ handoff: "acknowledge", acknowledged: "start", production: "qc", qc: "ship", shipped: "deliver", delivered: "" } as const)[state.stage] : "prepare";
  const actionLabel: Record<string, string> = { prepare: "Prepare handoff", acknowledge: "Record acknowledgment", start: "Record production start", qc: "Record QC passed", ship: "Record shipment", deliver: "Record delivery" };

  async function post(command: Record<string, unknown>) {
    if (inFlight.current || disabled) return;
    inFlight.current = true; setBusy(true); setError(""); setSaved("");
    try {
      const result = await read(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...command, number: order.number }) }));
      setOrder(result.order); setNote(""); setSpecChecked(false); setMockups({}); setChecked(false); setSaved("Update saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection interrupted. Reload to check the saved order.");
      setUncertain(true);
    } finally { inFlight.current = false; setBusy(false); }
  }
  function milestone(change: Record<string, unknown>) { return post({ kind: "fulfillment", version: state?.version ?? 0, operationId: crypto.randomUUID(), change }); }
  function advance() {
    const change = action === "prepare" ? { action, factories } : action === "acknowledge" ? { action, note, expectedShipDate: shipDate } : action === "qc" ? { action, note, evidenceUrl: evidence, allUnitsChecked: checked } : action === "ship" ? { action, note, carrier, trackingNumber: tracking, trackingUrl } : { action, note };
    void milestone(change);
  }
  async function upload(sku: string, files: FileList | null) {
    if (!files?.length || inFlight.current || disabled) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      for (const file of Array.from(files)) {
        const form = new FormData(); form.set("file", file);
        const result = await read(await fetch("/api/upload-artwork", { method: "POST", body: form }));
        setMockups(previous => ({ ...previous, [sku]: [...(previous[sku] || []), result.previewUrl] }));
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const validMilestone = action === "prepare" ? order.lines.every(line => line.sku_id && factories[line.sku_id]?.trim().length >= 2) : note.trim().length >= 3 && (action !== "acknowledge" || !!shipDate) && (action !== "qc" || checked && evidence.startsWith("https://")) && (action !== "ship" || tracking.trim().length >= 4 && trackingUrl.startsWith("https://"));
  return <div className={css.content}>
    <section className={css.card}><div className={css.row}><div><p className={css.label}>{order.number}</p><h2>{order.cancelled ? "Cancelled" : state?.hold ? "On hold" : state ? LABELS[state.stage] : order.approved ? "Ready for handoff" : proofOpen ? "Awaiting customer review" : "Prepare the proof"}</h2><p className={css.muted}>{order.lines.length} {order.lines.length === 1 ? "style" : "styles"} / {order.lines.reduce((n, line) => n + line.qty, 0)} units</p></div><span className={css.badge}>{order.cancelled ? "Cancelled" : order.paid ? "Paid" : "Payment required"}</span></div><div className={css.row}><Link href={`/orders/express/${order.number}`} className={css.muted}>Customer view</Link>{order.projectId ? <a className={css.muted} href={`https://os.magnumopus.agency/projects/${order.projectId}`} target="_blank" rel="noreferrer">MoaOS project</a> : null}<button className={css.secondary} disabled={busy} onClick={reload}>Reload order</button></div></section>
    {error ? <p role="alert" className={css.error}>{error}{uncertain ? " Reload the order before another update." : ""}</p> : null}
    {saved ? <p role="status" className={css.success}>{saved}</p> : null}
    <section className={css.card}><div className={css.row}><h2>Production proof</h2><span className={css.muted}>{order.rounds.length ? `Round ${order.rounds.length}` : `Due ${date(order.proofDueAt)}`}</span></div>
      {order.lines.map(line => { const item = line.sku_id ? latest.get(line.sku_id) : undefined; const needed = proofReady && needs.includes(line); const images = needed ? mockups[line.sku_id!] || [] : item?.mockups || [];
        return <article className={css.piece} key={line.ref}><div className={css.row}><h3>{line.title} / {line.qty} units</h3><span className={css.badge}>{item?.decision || "Needs proof"}</span></div>{item?.comment ? <p>Customer note: {item.comment}</p> : null}
          <details><summary>Production specification</summary><p className={css.spec}>{(needed ? order.specs[line.sku_id!] : item?.spec || order.specs[line.sku_id!]) || "Add the production specification in the MoaOS project before preparing the proof."}</p></details>
          <div className={css.images}>{images.map((url, index) => <div key={url}><a href={url} target="_blank" rel="noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={`${line.title} proof ${index + 1}`} /></a>{needed ? <button className={css.secondary} disabled={disabled} onClick={() => setMockups(previous => ({ ...previous, [line.sku_id!]: previous[line.sku_id!].filter(value => value !== url) }))}>Remove</button> : null}</div>)}</div>
          {needed ? <label className={css.form}><span className={css.label}>Upload proof / PNG, JPG, WebP or PDF</span><input aria-label={`Upload proof for ${line.title}`} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple disabled={disabled || images.length >= 8} onChange={e => upload(line.sku_id!, e.target.files)} /></label> : null}
        </article>;
      })}
      {proofReady ? <div className={css.form}><label className={css.check}><input type="checkbox" checked={specChecked} disabled={disabled} onChange={e => setSpecChecked(e.target.checked)} />I checked the artwork, method, dimensions, placement, colours and size run for every piece.</label><button className={css.button} disabled={disabled || !specChecked || !needs.every(line => mockups[line.sku_id!]?.length && mockups[line.sku_id!].length <= 8 && order.specs[line.sku_id!]?.trim())} onClick={() => post({ kind: "proof", expectedRound: nextRound, specsChecked: true, items: needs.map(line => ({ skuId: line.sku_id, mockups: mockups[line.sku_id!], spec: order.specs[line.sku_id!] })) })}>Save proof round {nextRound} to customer portal</button><p className={css.muted}>The customer reviews this saved version in their account. No email is sent.</p></div> : proofOpen ? <p className={css.muted}>Waiting for the customer to approve or request changes.</p> : nextRound > 2 && !order.approved ? <p className={css.muted}>Additional rounds require separate review with Devyn.</p> : null}
    </section>
    <section className={css.card}><h2>Production and delivery</h2><div className={css.steps}>{STAGES.map((stage, i) => <div key={stage} className={`${css.step} ${state && i <= STAGES.indexOf(state.stage) ? css.complete : ""}`}><span className={css.label}>{String(i + 1).padStart(2, "0")}</span><br />{LABELS[stage]}</div>)}</div>
      {order.cancelled ? <p>This order is cancelled. Fulfillment is closed.</p> : !order.approved ? <p className={css.muted}>Available after payment and every piece is approved by the customer.</p> : state?.stage === "delivered" ? <p className={css.success}>Delivered {date(state.deliveredAt)}.</p> : <div className={css.form}>
        {state?.hold ? <p className={css.error}>On hold: {state.hold}</p> : null}
        {!state ? order.lines.map(line => <label key={line.ref}>Factory for {line.title}<input value={factories[line.sku_id!] || ""} maxLength={120} disabled={disabled} placeholder="Factory name" onChange={e => setFactories(previous => ({ ...previous, [line.sku_id!]: e.target.value }))} /></label>) : <label>Evidence or reference<textarea maxLength={2000} value={note} disabled={disabled} placeholder="Who confirmed this update and where it is recorded" onChange={e => setNote(e.target.value)} /></label>}
        {action === "acknowledge" && !state?.hold ? <label>Expected ship date<input type="date" value={shipDate} disabled={disabled} onChange={e => setShipDate(e.target.value)} /></label> : null}
        {action === "qc" && !state?.hold ? <><label>QC report link<input type="url" value={evidence} disabled={disabled} placeholder="https://" onChange={e => setEvidence(e.target.value)} /></label><label className={css.check}><input type="checkbox" checked={checked} disabled={disabled} onChange={e => setChecked(e.target.checked)} />All ordered units are accounted for and approved for dispatch.</label></> : null}
        {action === "ship" && !state?.hold ? <><label>Carrier<select value={carrier} disabled={disabled} onChange={e => setCarrier(e.target.value)}>{["UPS", "FedEx", "DHL", "USPS", "Other"].map(value => <option key={value}>{value}</option>)}</select></label><label>Tracking number<input value={tracking} disabled={disabled} maxLength={100} onChange={e => setTracking(e.target.value)} /></label><label>Tracking link<input type="url" value={trackingUrl} disabled={disabled} placeholder="https://" onChange={e => setTrackingUrl(e.target.value)} /></label><p className={css.muted}>This shipment must cover the entire order.</p></> : null}
        <div className={css.row}>{!state?.hold ? <button className={css.button} disabled={disabled || !validMilestone} onClick={advance}>{busy ? "Saving" : actionLabel[action]}</button> : null}{state ? <button className={css.secondary} disabled={disabled || note.trim().length < 3} onClick={() => milestone({ action: state.hold ? "resume" : "hold", note })}>{state.hold ? "Resolve hold" : "Put on hold"}</button> : null}</div>
      </div>}
      {state ? <details className={css.piece}><summary>Approved factory handoff</summary><p className={css.spec}>Ship to: {typeof state.pack.shipTo === "string" ? state.pack.shipTo : Object.values(state.pack.shipTo).filter(Boolean).join(", ")}</p>{state.pack.pieces.map(piece => <article key={piece.skuId} className={css.piece}><h3>{piece.title} / {piece.qty} units / {piece.factory}</h3><p className={css.muted}>Proof {piece.proofRound}, approved by {piece.approvedBy} / {date(piece.approvedAt)}</p><p className={css.spec}>{piece.spec}</p></article>)}</details> : null}
    </section>
    {state?.events.length ? <section className={css.card}><h2>Order history</h2><div style={{ marginTop: 24 }}>{[...state.events].reverse().map(event => <article className={css.event} key={event.id}><div className={css.row}><h3>{event.action === "hold" ? "On hold" : event.action === "resume" ? "Hold resolved" : LABELS[event.stage]}</h3><span className={css.muted}>{date(event.at)}</span></div><p className={css.spec}>{event.note}</p><span className={css.muted}>{event.actor}</span></article>)}</div></section> : null}
  </div>;
}
