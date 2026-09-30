import Link from "next/link"

type CheckoutReturnProps = {
  searchParams: Promise<{ reference?: string }>
}

export default async function CheckoutReturn({ searchParams }: CheckoutReturnProps) {
  const { reference } = await searchParams

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16 text-[#24221f]">
      <p className="text-xs uppercase tracking-[0.18em] text-[#936f49]">Payment verification</p>
      <h1 className="mt-5 font-serif text-4xl">We&apos;re confirming your payment.</h1>
      <p className="mt-5 leading-7 text-[#6e665e]">
        Your order is confirmed only after Paystack verifies the payment. Keep this reference for your records.
      </p>
      {reference && <p className="mt-6 break-all border-y border-[#24221f]/15 py-4 text-sm">Reference: {reference}</p>}
      <Link href="/" className="mt-8 inline-flex w-fit items-center border-b border-[#24221f] pb-1 text-sm">Return to the collection</Link>
    </main>
  )
}