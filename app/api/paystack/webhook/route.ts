import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  const supabase = createSupabaseAdmin()
  if (!secret || !supabase) {
    return NextResponse.json({ error: "Payment verification is not configured." }, { status: 503 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get("x-paystack-signature") ?? ""
  const expectedSignature = createHmac("sha512", secret).update(rawBody).digest("hex")
  const received = Buffer.from(signature, "hex")
  const expected = Buffer.from(expectedSignature, "hex")
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 })
  }

  let event: { event?: string; data?: { reference?: unknown } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 })
  }

  if (event.event !== "charge.success") return NextResponse.json({ received: true })
  if (typeof event.data?.reference !== "string") {
    return NextResponse.json({ error: "Missing payment reference." }, { status: 400 })
  }

  const reference = event.data.reference
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,total_ngn,status")
    .eq("payment_reference", reference)
    .maybeSingle()

  if (orderError) return NextResponse.json({ error: "Could not locate the order." }, { status: 500 })
  if (!order) return NextResponse.json({ received: true })
  if (order.status === "paid" || order.status === "fulfilled") return NextResponse.json({ received: true })

  let verificationResponse: Response
  try {
    verificationResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 502 })
  }

  const verification = await verificationResponse.json().catch(() => null)
  const transaction = verification?.data
  if (
    !verificationResponse.ok || !verification?.status || transaction?.status !== "success" ||
    transaction?.reference !== reference || transaction?.currency !== "NGN" ||
    transaction?.amount !== order.total_ngn * 100
  ) {
    return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 })
  }

  const { error: completionError } = await supabase.rpc("complete_paid_order", {
    p_payment_reference: reference,
  })
  if (completionError) {
    return NextResponse.json({ error: "Verified payment could not be recorded." }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}