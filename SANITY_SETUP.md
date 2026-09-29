# Sanity product catalog

The storefront reads published products from Sanity. The hosted Sanity Studio is linked from `/studio` after the project is connected.

1. Create a Sanity project and a dataset (the default dataset name here is `production`).

2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SANITY_PROJECT_ID` and `NEXT_PUBLIC_SANITY_DATASET` to the project and dataset IDs. These IDs are public identifiers, not secrets.
3. Sign in to the Sanity CLI with `pnpm exec sanity login`, then deploy the Studio with `pnpm exec sanity deploy`. The hosted Studio is at `https://harab-clothings.sanity.studio`. The root `sanity.cli.ts` reads the project ID and dataset from the environment and uses `harab-clothings` as its hostname. If changing that hostname, set `SANITY_STUDIO_HOSTNAME` and update the Studio URL below.
4. Set `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, and `NEXT_PUBLIC_SANITY_STUDIO_URL=https://harab-clothings.sanity.studio` in the local environment and Netlify's production environment variables. Add the storefront origin (for example, `http://localhost:3000`) to the Sanity project's CORS origins so editors can sign in to the Studio. Invite staff and manage their access from the Sanity project dashboard.
5. Start the app with `pnpm dev`, open `/studio`, sign in with a Sanity account that has edit access, and create products. Upload an image, set the price in whole NGN, enter the available quantity, and enable **Available for sale** before publishing.

Only published products marked available with stock greater than zero appear in the catalog. Without a project ID, the storefront uses its existing sample products for local development preview only. Production without a project ID and a configured Sanity project with no available products both return an empty catalog; neither silently displays sample inventory.

Sanity provides the product content and staff editing experience, not transactional inventory, customer accounts, orders, or payment processing. The Studio is hosted separately and `/studio` redirects staff to it; this keeps the CMS editor bundle out of the Next.js storefront build. For a custom storefront, use a transactional database such as Supabase/Postgres for carts and orders, Paystack for Nigerian payments, and verify payment status server-side before marking an order paid. Guest checkout is the lower-friction starting point; customer accounts can be added with Supabase Auth when order history and saved profiles are in scope. Delivery, tax, and service-area policies must be defined before enabling live checkout.

## Google Analytics

Set `NEXT_PUBLIC_GA_ID` in Netlify's production environment variables to your GA4 Measurement ID (the value beginning with `G-`). Trigger a new deploy after setting it. The tag is loaded only in production when this variable is present; local development and Netlify deploy previews do not send analytics events.
