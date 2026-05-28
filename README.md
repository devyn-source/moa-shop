# MOA Shop

Standalone MVP for the MOA self-service standardized merch catalog.

The app is intentionally isolated from MoaOS. It uses local JSON persistence in `.data/` for the MVP so the complete flow can run before Supabase, Clerk, Stripe, and Resend credentials exist.

## Local Commands

```bash
npm install
npm run dev
npm run build
```

## MVP Routes

- `/` public catalog
- `/p/[slug]` product detail
- `/p/[slug]/configure` bounded configurator, artwork metadata, simulated checkout
- `/orders/[id]` customer-facing order status
- `/catalog-pdf` print/save-PDF catalog output
- `/admin` operator dashboard
- `/admin/orders` Amanda queue
- `/admin/orders/[id]` artwork QA, revision, vendor, production, shipment controls
- `/admin/catalog` product control
- `/admin/vendors` local vendor directory

## External Services Still To Wire

- Supabase: replace `.data` store with dedicated `moa-shop` project
- Clerk: gate admin routes and customer order ownership
- Stripe: replace simulated payment with Checkout + webhook
- Resend: send order confirmation, revision request, vendor notification, shipped email
- Supabase Storage: replace mock file-name capture with signed artwork/template uploads

## Asset Work Required

See [docs/mockup-asset-spec.md](docs/mockup-asset-spec.md).
