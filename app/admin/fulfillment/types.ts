export type Stage = "handoff" | "acknowledged" | "production" | "qc" | "shipped" | "delivered";
export const STAGES: Stage[] = ["handoff", "acknowledged", "production", "qc", "shipped", "delivered"];
export const LABELS: Record<Stage, string> = { handoff: "Handoff prepared", acknowledged: "Factory acknowledged", production: "In production", qc: "Quality checked", shipped: "Shipped", delivered: "Delivered" };
export type ProofItem = { sku_id: string; title: string; mockups: string[]; spec: string; decision: "pending" | "approved" | "changes"; comment?: string; decided_by_name?: string };
export type StaffOrder = {
  number: string; mode: string; status: string; projectId: string | null; paid: boolean; approved: boolean; cancelled: boolean; proofDueAt: string | null;
  lines: { sku_id: string | null; ref: string; title: string; qty: number; summary?: string }[];
  specs: Record<string, string>;
  rounds: { round: number; sent_at: string; closed_at: string | null; items: ProofItem[] }[];
  fulfillment: null | { version: number; stage: Stage; hold: string | null; expectedShipDate?: string; qcEvidence?: string; deliveredAt?: string;
    tracking?: { carrier: string; number: string; url: string };
    pack: { shipTo: Record<string, string> | string; pieces: { skuId: string; title: string; qty: number; factory: string; spec: string; mockups: string[]; approvedAt: string; approvedBy: string; proofRound: number }[] };
    events: { id: string; action: string; stage: Stage; at: string; actor: string; note: string }[];
  };
};
export type QueueItem = { order_number: string; status: string; proof_due_at: string | null; paid_at: string | null; approved_at: string | null; submitted_at: string };
