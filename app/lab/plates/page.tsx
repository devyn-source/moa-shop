// Local lab for the photoreal plate compositor. Not available in production.
import { notFound } from "next/navigation";
import PlateLab from "./PlateLab";

export const metadata = { robots: { index: false } };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PlateLab />;
}
