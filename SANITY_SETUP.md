# Sanity product catalog

The storefront reads published products from Sanity. The hosted Sanity Studio is linked from `/studio` after the project is connected.

1. Create a Sanity project and a dataset (the default dataset name here is `production`).

2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SANITY_PROJECT_ID` and `NEXT_PUBLIC_SANITY_DATASET` to the project and dataset IDs. These IDs are public identifiers, not secrets.
3. Sign in to the Sanity CLI with `pnpm exec sanity login`, then deploy the Studio with `pnpm exec sanity deploy`. The hosted Studio is at `***`. The root `sanity.cli.ts` reads the project ID and dataset for CLI operations and uses `harab-clothings` as its hostname. The separately built Studio uses the project ID and dataset configured in `sanity.config.ts`; redeploy it with `pnpm exec sanity deploy` after changing either. If changing the hostname, set `SANITY_STUDIO_HOSTNAME` and update the Studio URL below.
4. Set `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, and `NEXT_PUBLIC_SANITY_STUDIO_URL` in the local environment and Netlify's production environment variables. These values are public configuration, not secrets. Netlify's variables configure the storefront only; they do not alter the separately hosted Sanity Studio. Add the storefront origin (for example, `http://localhost:3000`) to the Sanity project's CORS origins so editors can sign in to the Studio. Invite staff and manage their access from the Sanity project dashboard.
5. Start the app with `pnpm dev`, open `/studio`, sign in with a Sanity account that has edit access, and create products. Upload an image, set the price in whole NGN, enter the available quantity, and enable **Available for sale** before publishing.

Only published products marked available with at least one in-stock size appear in the catalog. Product sizes are UK 8, 10, 12, 14, 16, 18, and 20, with stock tracked separately per size. After deploying the updated Studio schema, add size/stock rows to each existing product; products without variants are intentionally hidden from the storefront. Without a project ID, sample products appear in local development only.

Sanity provides the product content and staff editing experience, not transactional inventory, customer accounts, orders, or payment processing. The Studio is hosted separately and `/studio` redirects staff to it; this keeps the CMS editor bundle out of the Next.js storefront build. For a custom storefront, use a transactional database such as Supabase/Postgres for carts and orders, Paystack for Nigerian payments, and verify payment status server-side before marking an order paid. Guest checkout is the lower-friction starting point; customer accounts can be added with Supabase Auth when order history and saved profiles are in scope. Delivery, tax, and service-area policies must be defined before enabling live checkout.

## Cart and Checkout Status

The bag persists product IDs, UK sizes, and quantities in the visitor's browser and calculates its subtotal from catalog prices. Complimentary delivery within Lagos applies at a subtotal of ₦250,000 or more through 1 January 2027. The agreed tax treatment is 7.5% VAT added at checkout. Lagos delivery charges below the threshold, pickup locations, delivery availability outside Lagos, exact returns/exchange terms, order storage, and payment are not implemented. Checkout remains disabled until these rules and the server-side order/payment flow are configured; the browser cart is not authoritative inventory.

## Google Analytics

Set `NEXT_PUBLIC_GA_ID` in Netlify's production environment variables to your GA4 Measurement ID (the value beginning with `G-`). Trigger a new deploy after setting it. The tag is loaded only in production when this variable is present; local development and Netlify deploy previews do not send analytics events.
