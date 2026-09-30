import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getCheckoutProducts } from "@/lib/sanity"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type CheckoutRequest = {
  customer?: { name?: unknown; email?: unknown; phone?: unknown }
  deliveryRegion?: unknown
  deliveryAddress?: unknown
  items?: unknown
}

type RequestedItem = { productId: string; size: string; quantity: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function POST(request: Request) {
  if (process.env.ENABLE_CHECKOUT !== "true") {
    return NextResponse.json({ error: "Checkout is not enabled yet." }, { status: 503 })
  }

  const supabase = createSupabaseAdmin()
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY
  if (!supabase || !paystackSecret) {
    return NextResponse.json({ error: "Checkout is not configured yet." }, { status: 503 })
  }

  let payload: CheckoutRequest
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 })
  }

  const customer = payload.customer
  if (
    !customer ||
    typeof customer.name !== "string" || customer.name.trim().length < 2 || customer.name.length > 120 ||
    typeof customer.email !== "string" || customer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
    typeof customer.phone !== "string" || !/^\+?[\d\s()-]{7,20}$/.test(customer.phone)
  ) {
    return NextResponse.json({ error: "Enter a valid name, email address, and phone number." }, { status: 400 })
  }

  if (payload.deliveryRegion !== "lagos" && payload.deliveryRegion !== "outside_lagos") {
    return NextResponse.json({ error: "Choose a delivery region." }, { status: 400 })
  }
  if (!isRecord(payload.deliveryAddress)) {
    return NextResponse.json({ error: "Enter delivery address details." }, { status: 400 })
  }
  const addressLine = payload.deliveryAddress.addressLine
  const city = payload.deliveryAddress.city
  if (
    typeof addressLine !== "string" || addressLine.trim().length < 5 || addressLine.length > 300 ||
    typeof city !== "string" || city.trim().length < 2 || city.length > 100
  ) {
    return NextResponse.json({ error: "Enter a valid street address and city." }, { status: 400 })
  }

  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 20) {
    return NextResponse.json({ error: "Your bag is empty or contains too many items." }, { status: 400 })
  }

  const items: RequestedItem[] = []
  for (const value of payload.items) {
    if (
      !isRecord(value) || typeof value.productId !== "string" || value.productId.length > 100 ||
      typeof value.size !== "string" || !/^UK (8|10|12|14|16|18|20)$/.test(value.size) ||
      !Number.isInteger(value.quantity) || Number(value.quantity) < 1 || Number(value.quantity) > 10
    ) {
      return NextResponse.json({ error: "One or more bag items are invalid." }, { status: 400 })
    }
    items.push({ productId: value.productId, size: value.size, quantity: Number(value.quantity) })
  }

  const uniqueKeys = new Set(items.map((item) => `${item.productId}:${item.size}`))
  if (uniqueKeys.size !== items.length) {
    return NextResponse.json({ error: "Remove duplicate sizes from your bag and try again." }, { status: 400 })
  }

  const currentProducts = await getCheckoutProducts([...new Set(items.map((item) => item.productId))])
  const verifiedItems = []
  for (const item of items) {
    const product = currentProducts.find((candidate) => candidate._id === item.productId)
    const variant = product?.variants?.find((candidate) => candidate.size === item.size)
    if (!product || !variant) {
      return NextResponse.json({ error: "A selected product or size is no longer available. Refresh your bag and try again." }, { status: 409 })
    }
    verifiedItems.push({
      sanity_product_id: product._id,
      product_name: product.name,
      size: item.size,
      quantity: item.quantity,
      unit_price_ngn: product.priceNgn,
    })
  }

  const paymentReference = `HRB-${randomUUID()}`
  const { data: orderId, error: orderError } = await supabase.rpc("create_checkout_order", {
    p_payment_reference: paymentReference,
    p_customer_name: customer.name.trim(),
    p_customer_email: customer.email.trim().toLowerCase(),
    p_customer_phone: customer.phone.trim(),
    p_delivery_region: payload.deliveryRegion,
    p_delivery_address: {
      addressLine: addressLine.trim(),
      city: city.trim(),
      ...(typeof payload.deliveryAddress.state === "string" ? { state: payload.deliveryAddress.state.slice(0, 100) } : {}),
      provider: "Chowdeck",
    },
    p_items: verifiedItems,
  })

  if (orderError || typeof orderId !== "string") {
    return NextResponse.json({ error: "We could not reserve those items. Please refresh your bag and try again." }, { status: 409 })
  }

  const { data: order, error: readOrderError } = await supabase
    .from("orders")
    .select("total_ngn")
    .eq("id", orderId)
    .single()

  if (readOrderError || !order) {
    await supabase.rpc("cancel_checkout_order", { p_order_id: orderId })
    return NextResponse.json({ error: "We could not prepare payment. Please try again." }, { status: 500 })
  }

  const callbackUrl = process.env.PAYSTACK_CALLBACK_URL ?? `${new URL(request.url).origin}/checkout/return`
  let paymentResponse: Response
  try {
    paymentResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customer.email.trim().toLowerCase(),
        amount: order.total_ngn * 100,
        currency: "NGN",
        reference: paymentReference,
        callback_url: callbackUrl,
      }),
      cache: "no-store",
    })
  } catch {
    await supabase.rpc("cancel_checkout_order", { p_order_id: orderId })
    return NextResponse.json({ error: "Payment service is temporarily unavailable. Your items have been released." }, { status: 502 })
  }

  const payment = await paymentResponse.json().catch(() => null)
  if (!paymentResponse.ok || !payment?.status || typeof payment?.data?.authorization_url !== "string") {
    await supabase.rpc("cancel_checkout_order", { p_order_id: orderId })
    return NextResponse.json({ error: "Payment could not be started. Your items have been released." }, { status: 502 })
  }

  return NextResponse.json({ authorizationUrl: payment.data.authorization_url, reference: paymentReference })
}