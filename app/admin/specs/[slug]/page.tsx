import { notFound } from "next/navigation";
import { getCatalogSpec } from "@/lib/garment-spec-store";
import { SpecEditor } from "@/components/SpecEditor";

export const dynamic = "force-dynamic";

export default async function EditSpecPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const spec = await getCatalogSpec(slug);
  if (!spec) notFound();
  return (
    <main className="page">
      <SpecEditor slug={slug} initial={spec} />
    </main>
  );
}
