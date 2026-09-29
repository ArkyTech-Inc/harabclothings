import HarabStorefront from "@/components/harab-storefront"
import { getProducts } from "@/lib/sanity"

export default async function Page() {
  const products = await getProducts()

  return <HarabStorefront products={products} />
}
