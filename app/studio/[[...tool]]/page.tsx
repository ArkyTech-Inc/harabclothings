import { redirect } from "next/navigation"

export default function StudioPage() {
  const studioUrl = process.env.NEXT_PUBLIC_SANITY_STUDIO_URL

  if (!studioUrl) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 font-sans text-neutral-900">
        <h1 className="text-2xl font-semibold">Connect the Harab product studio</h1>
        <p className="mt-4 leading-7 text-neutral-700">
          Deploy the Sanity Studio, then set NEXT_PUBLIC_SANITY_STUDIO_URL to its URL.
          Product editing will be available here after the studio is connected.
        </p>
      </main>
    )
  }

  redirect(studioUrl)
}