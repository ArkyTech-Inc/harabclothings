import { createClient } from "next-sanity"
import { demoProducts, formatNaira, type StoreProduct } from "@/lib/products"

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production"

const client = projectId
  ? createClient({
  projectId,
  dataset,
      apiVersion: "2025-02-19",
      useCdn: true,
    })
  : null

type SanityProduct = Omit<StoreProduct, "price"> & { price: number }

export async function getProducts(): Promise<StoreProduct[]> {
  if (!client) return process.env.NODE_ENV === "development" ? demoProducts : []

  const products = await client.fetch<SanityProduct[]>(
    `*[_type == "product" && isAvailable == true && stock > 0] | order(_createdAt desc) {
      _id,
      name,
      price,
      note,
      badge,
      tone,
      "image": image.asset->url
    }`,
    {},
    { next: { revalidate: 60, tags: ["products"] } },
  )

  return products.map((product) => ({ ...product, price: formatNaira(product.price) }))
}