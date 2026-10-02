// The only contact path from the shop: the project inquiry form, for work the shop can't do.
// utm tags let the sales pipeline see which shop surface the lead came from.
export const inquiryUrl = (from: string) => `https://moa-intake.vercel.app/?utm_source=moa-shop&utm_medium=${encodeURIComponent(from)}`;

export function BespokeLine({ from, className = "hx-body" }: { from: string; className?: string }) {
  return (
    <p className={className}>
      Need something more custom or bespoke?{" "}
      <a href={inquiryUrl(from)} target="_blank" rel="noopener">Start a project</a>
    </p>
  );
}
