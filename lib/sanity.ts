import { createClient } from "next-sanity"
import { demoProducts, formatNaira, type ProductVariant, type StoreProduct } from "@/lib/products"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

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
const checkoutClient = projectId
  ? createClient({ projectId, dataset, apiVersion: "2025-02-19", useCdn: false })
  : null

type SanityProduct = Omit<StoreProduct, "price" | "stock"> & { variants: ProductVariant[] }
type SanityInventoryProduct = {
  _id: string
  _type: "product"
  isAvailable: boolean
  variants: ProductVariant[] | null
}

export async function getProducts(): Promise<StoreProduct[]> {
  if (!client) return process.env.NODE_ENV === "development" ? demoProducts : []

  const products = await client.fetch<SanityProduct[]>(
    `*[_type == "product" && isAvailable == true] | order(_createdAt desc) {
      _id,
      name,
      "priceNgn": price,
      "variants": variants[]{ size, stock },
      note,
      badge,
      tone,
      "image": image.asset->url
    }`,
    {},
    { next: { revalidate: 60, tags: ["products"] } },
  )

  const supabase = createSupabaseAdmin()
  let inventoryByVariant: Map<string, number> | null = null
  if (supabase) {
    const { data: inventory, error } = await supabase
      .from("product_inventory")
      .select("sanity_product_id,size,stock_on_hand,reserved_quantity")
      .in("sanity_product_id", products.map((product) => product._id))

    if (error) throw new Error("Could not load product inventory.")
    inventoryByVariant = new Map(
      inventory.map((item) => [`${item.sanity_product_id}:${item.size}`, Math.max(0, item.stock_on_hand - item.reserved_quantity)]),
    )
  }

  return products.map((product) => {
    const variants = (product.variants ?? [])
      .map((variant) => ({
        size: variant.size,
        stock: inventoryByVariant?.get(`${product._id}:${variant.size}`) ?? (inventoryByVariant ? 0 : variant.stock),
      }))
      .filter((variant) => variant.stock > 0)
    return { ...product, variants, stock: variants.reduce((total, variant) => total + variant.stock, 0), price: formatNaira(product.priceNgn) }
  }).filter((product) => product.stock > 0)
}

export async function getCheckoutProducts(productIds: string[]) {
  if (!checkoutClient || productIds.length === 0) return []

  return checkoutClient.fetch<SanityProduct[]>(
    `*[_type == "product" && _id in $productIds && isAvailable == true] {
      _id,
      name,
      "priceNgn": price,
      "variants": variants[]{ size }
    }`,
    { productIds },
    { next: { revalidate: 0 } },
  )
}

export async function getPublishedProductInventory(productId: string) {
  if (!checkoutClient) return null

  return checkoutClient.fetch<SanityInventoryProduct | null>(
    `*[_type == "product" && _id == $productId][0] {
      _id,
      _type,
      isAvailable,
      "variants": variants[]{ size, stock }
    }`,
    { productId },
    { next: { revalidate: 0 } },
  )
}