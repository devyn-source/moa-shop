import type { CatalogProduct } from "@/lib/types";

type View = "front" | "back";

export function ProductVisual({
  type,
  label,
  swatch,
  view = "front"
}: {
  type: CatalogProduct["visual"];
  label: string;
  swatch?: string;
  view?: View;
}) {
  const color = swatch ?? "#1d1b18";
  const isBack = view === "back";

  return (
    <svg className="product-visual" viewBox="0 0 320 360" role="img" aria-label={`${label} ${view}`}>
      <rect x="28" y="24" width="264" height="312" fill="rgba(255,255,255,0.42)" />

      {type === "hoodie" ? (
        isBack ? (
          <>
            <path d="M105 74c10-28 100-28 110 0l52 50-34 54-22-19v137H109V159l-22 19-34-54 52-50Z" fill={color} />
            <path d="M121 82c12 36 66 36 78 0 12 12 18 27 18 45H103c0-18 6-33 18-45Z" fill="rgba(255,255,255,0.18)" />
            <path d="M137 156h46v6h-46zM137 168h46v3h-46z" fill="rgba(255,255,255,0.18)" />
          </>
        ) : (
          <>
            <path d="M105 74c10-28 100-28 110 0l52 50-34 54-22-19v137H109V159l-22 19-34-54 52-50Z" fill={color} />
            <path d="M121 82c12 36 66 36 78 0 12 12 18 27 18 45H103c0-18 6-33 18-45Z" fill="rgba(255,255,255,0.24)" />
            <path d="M120 222h80v30c-16 9-64 9-80 0v-30Z" fill="rgba(255,255,255,0.16)" />
            <path d="M155 90v60M165 90v60" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
          </>
        )
      ) : null}

      {type === "tee" ? (
        isBack ? (
          <>
            <path d="M106 74h108l52 49-34 48-25-19v145H113V152l-25 19-34-48 52-49Z" fill={color} />
            <path d="M152 76q8 6 16 0" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
          </>
        ) : (
          <>
            <path d="M106 74h108l52 49-34 48-25-19v145H113V152l-25 19-34-48 52-49Z" fill={color} />
            <path d="M142 76q18 22 36 0" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="3" />
          </>
        )
      ) : null}

      {type === "pant" ? (
        <>
          <path d="M108 88h104v30l-10 200h-44l-6-150-6 150h-44l-10-200V88Z" fill={color} />
          <rect x="108" y="88" width="104" height="18" fill="rgba(255,255,255,0.22)" />
          {!isBack ? (
            <path d="M150 100v18M170 100v18" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          ) : (
            <rect x="176" y="150" width="34" height="30" fill="rgba(255,255,255,0.16)" />
          )}
        </>
      ) : null}

      {type === "jacket" ? (
        <>
          <path d="M92 65h136l46 56-34 42-23-20v154H103V143l-23 20-34-42 46-56Z" fill={color} />
          {isBack ? (
            <path d="M160 69v224" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          ) : (
            <path d="M160 69v224M112 178h38M170 178h38" stroke="rgba(255,255,255,0.35)" strokeWidth="7" />
          )}
        </>
      ) : null}

      {type === "tote" ? (
        <>
          <path d="M86 122h148l22 178H64l22-178Z" fill={color} />
          <path d="M113 128c0-48 94-48 94 0" fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" />
          {!isBack ? <rect x="102" y="172" width="116" height="76" fill="rgba(255,255,255,0.18)" /> : null}
        </>
      ) : null}

      {type === "cap" ? (
        <>
          <path d="M70 184c16-61 136-87 181 0-40 24-144 26-181 0Z" fill={color} />
          <path d="M92 190c-12 17-31 26-55 31 65 31 160 21 222-20-42 9-89 8-167-11Z" fill={color} opacity="0.7" />
          {!isBack ? <path d="M121 165c20-28 68-29 87 0" fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="8" /> : null}
          {isBack ? <rect x="120" y="188" width="80" height="22" fill="rgba(255,255,255,0.18)" /> : null}
        </>
      ) : null}

      {type === "beanie" ? (
        <>
          <path d="M84 158c0-78 152-78 152 0v77H84v-77Z" fill={color} />
          <rect x="72" y="218" width="176" height="62" rx="9" fill={color} opacity="0.82" />
          <path d="M112 219v59M144 219v59M176 219v59M208 219v59" stroke="rgba(255,255,255,0.24)" strokeWidth="6" />
        </>
      ) : null}

      <text x="160" y="326" textAnchor="middle" fill="rgba(29,27,24,0.45)" fontSize="11" fontWeight="700" letterSpacing="2">
        {view.toUpperCase()}
      </text>
    </svg>
  );
}
