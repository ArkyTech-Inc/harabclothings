import { isValidSignature, SIGNATURE_HEADER_NAME } from "@sanity/webhook"
import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { getPublishedProductInventory } from "@/lib/sanity"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const supportedSizes = new Set(["UK 8", "UK 10", "UK 12", "UK 14", "UK 16", "UK 18", "UK 20"])

export async function POST(request: Request) {
  const secret = process.env.SANITY_WEBHOOK_SECRET
  const supabase = createSupabaseAdmin()
  if (!secret || !supabase) {
    return NextResponse.json({ error: "Sanity inventory sync is not configured." }, { status: 503 })
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production"
  if (
    request.headers.get("sanity-project-id") !== projectId ||
    request.headers.get("sanity-dataset") !== dataset
  ) {
    return NextResponse.json({ error: "Unexpected Sanity project or dataset." }, { status: 403 })
  }

  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody, "utf8") > 64 * 1024) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 })
  }

  const signature = request.headers.get(SIGNATURE_HEADER_NAME)
  if (!signature || !(await isValidSignature(rawBody, signature, secret))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 })
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 })
  }

  const operation = request.headers.get("sanity-operation")
  if (operation === "delete") {
    return NextResponse.json({ received: true, inventory: "retained" })
  }
  if (operation !== "create" && operation !== "update") {
    return NextResponse.json({ error: "Unsupported Sanity webhook operation." }, { status: 400 })
  }

  const productId = request.headers.get("sanity-document-id")
  if (!productId || productId.length > 200 || productId.startsWith("drafts.")) {
    return NextResponse.json({ error: "Invalid Sanity document ID." }, { status: 400 })
  }

  const product = await getPublishedProductInventory(productId)
  if (!product || product._type !== "product") {
    return NextResponse.json({ received: true, inventory: "unchanged" })
  }

  const variants = product.variants ?? []
  const rows = []
  const seenSizes = new Set<string>()
  for (const variant of variants) {
    if (
      !supportedSizes.has(variant.size) || !Number.isInteger(variant.stock) ||
      variant.stock < 0 || seenSizes.has(variant.size)
    ) {
      return NextResponse.json({ error: "Product has invalid or duplicate size inventory." }, { status: 422 })
    }
    seenSizes.add(variant.size)
    rows.push({
      sanity_product_id: product._id,
      size: variant.size,
      stock_on_hand: variant.stock,
      reserved_quantity: 0,
    })
  }

  if (rows.length === 0) {
    return NextResponse.json({ received: true, inventory: "no-variants-to-sync" })
  }

  const { error } = await supabase
    .from("product_inventory")
    .upsert(rows, { onConflict: "sanity_product_id,size", ignoreDuplicates: true })

  if (error) {
    console.error("Sanity inventory sync failed", { productId, error: error.message })
    return NextResponse.json({ error: "Inventory sync failed." }, { status: 500 })
  }

  revalidatePath("/", "page")
  return NextResponse.json({ received: true, inventory: "initialized" })
}