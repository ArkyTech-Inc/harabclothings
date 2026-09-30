# Orders and transactional inventory

Checkout uses Supabase Postgres for order records and per-size stock reservations. Sanity remains the product-content editor and defines available size labels. Before Supabase is configured, the storefront uses Sanity stock for preview; once configured, the storefront reads available quantities from Supabase and Postgres is authoritative for both display and order reservation. Paystack handles payment; card data never passes through this app.

## Configure Supabase

1. Create a Supabase project and copy its project URL and service-role key from Project Settings → API. Keep the service-role key private; add it only as a server-side Netlify environment variable and in local `.env.local` for development. Never use a `NEXT_PUBLIC_` prefix for it.
2. In the Supabase SQL Editor, run `supabase/migrations/20260929000100_orders_inventory.sql`.
3. In Sanity Manage → API → Webhooks, create an enabled POST webhook to `https://<your-site>/api/sanity/inventory`. Filter it to `_type == "product"`, trigger on create and update (published documents only; leave draft/version events disabled), and set a strong webhook secret. Add the same secret as `SANITY_WEBHOOK_SECRET` in Netlify. The endpoint verifies Sanity's signature and project/dataset headers.
4. Publish each product with its UK size variants and starting quantities. The webhook inserts missing `product_inventory` rows in Supabase. It deliberately never overwrites existing rows: after initial import, Supabase stock is authoritative and must not be reset by content edits or repeated webhook delivery. Existing legacy top-level `stock` totals are not distributed automatically; add the actual quantities for each size in the Studio and publish.
5. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SANITY_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, and `NEXT_PUBLIC_SANITY_DATASET=production` in Netlify's production environment. Add `PAYSTACK_CALLBACK_URL` as `https://<your-site>/checkout/return` if the default callback URL is not appropriate. Leave `ENABLE_CHECKOUT` unset or false until all launch checks below pass.
6. In the Paystack dashboard, set the webhook URL to `https://<your-site>/api/paystack/webhook`. Configure test keys first; use the live secret only after a successful end-to-end test.
7. Add the same server-only values to `.env.local` for local testing, restart Next.js, and test with Paystack test mode. Netlify's deploy previews should use Paystack test credentials, not live credentials.

The API rechecks product prices with a non-CDN Sanity query, then Postgres locks and reserves inventory in one transaction. VAT is calculated at 7.5% of the item subtotal. Lagos delivery costs ₦15,000, or is complimentary at an item subtotal of ₦250,000 or more through 1 January 2027. Outside-Lagos delivery costs ₦30,000. These totals are calculated server-side; the browser subtotal is only a preview.

Returns are not yet implemented as an online workflow. Current business policy: requests within 5 days after delivery, customer pays return delivery, and a 60% refund for an undamaged dress. Confirm the damaged-item outcome and have the customer-facing terms reviewed before enabling live payments.

The checkout API has an explicit `ENABLE_CHECKOUT=true` server-side kill switch. Keep it disabled until inventory rows are seeded, the webhook is reachable over HTTPS, abandoned-payment reservations have a tested expiry/reconciliation path, cancellation and idempotent webhook behavior are tested, and the full return/delivery terms have been approved. A customer can still abandon a Paystack session after stock is reserved; do not enable live keys until that case is safely handled.
