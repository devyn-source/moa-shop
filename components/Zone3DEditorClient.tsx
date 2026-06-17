"use client";

import dynamic from "next/dynamic";
import type { CatalogProduct } from "@/lib/types";

const Zone3DEditor = dynamic(() => import("./Zone3DEditor"), {
  ssr: false,
  loading: () => <div className="z3d-loading">Preparing 3D editor…</div>,
});

export default function Zone3DEditorClient(props: {
  products: CatalogProduct[];
  modelUrls: Record<string, string | null>;
}) {
  return <Zone3DEditor {...props} />;
}
