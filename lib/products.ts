export type StoreProduct = {
  _id: string
  name: string
  price: string
  note: string
  image: string
  badge: string
  tone?: string
}

export const formatNaira = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount)

export const demoProducts: StoreProduct[] = [
  { _id: "demo-abeni", name: "Abeni Silk Abaya", price: "₦185,000", note: "Matching hijab included", image: "https://images.unsplash.com/photo-1728487235101-664d87965931?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", badge: "Best seller" },
  { _id: "demo-ife", name: "Ife Boubou Gown", price: "₦145,000", note: "Hand-finished Ankara print", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=85", tone: "#c6b8a4", badge: "New in" },
  { _id: "demo-dune", name: "Dune A-Line Maxi", price: "₦98,000", note: "Breathable cotton blend", image: "https://images.unsplash.com/photo-1585488431730-8d6d4e0b1b64?auto=format&fit=crop&w=900&q=85", tone: "#b9b5a8", badge: "Everyday" },
  { _id: "demo-sade", name: "Sade Chiffon Set", price: "₦52,000", note: "Soft chiffon & inner slip", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=85", tone: "#d6c0ac", badge: "Add-on" },
]