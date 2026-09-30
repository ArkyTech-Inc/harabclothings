"use client"

import { useEffect, useState, type FormEvent } from "react"
import { formatNaira, type StoreProduct } from "@/lib/products"
import {
  ArrowRight,
  ChevronDown,
  Heart,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react"

type CartItem = { productId: string; size: string; quantity: number }
type DeliveryRegion = "lagos" | "outside_lagos"

const cartStorageKey = "harab-cart-v1"
const freeDeliveryThreshold = 250_000
const freeDeliveryEndsAt = new Date("2027-01-01T00:00:00+01:00").getTime()

const filters = [
  ["Shop by coverage", "Full sleeve · Floor length"],
  ["Fabric opacity", "100% opaque · No inner required"],
  ["Size & length", "Size 12 · 58 inches"],
]

export default function HarabStorefront({ products }: { products: StoreProduct[] }) {
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [saved, setSaved] = useState<number[]>([])
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({})
  const [cartReady, setCartReady] = useState(false)
  const [cartMessage, setCartMessage] = useState("")
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")
  const [checkoutForm, setCheckoutForm] = useState({
    name: "",
    email: "",
    phone: "",
    addressLine: "",
    city: "",
    state: "",
    region: "lagos" as DeliveryRegion,
  })
  const [openFilter, setOpenFilter] = useState<number | null>(null)
  const [orderConfirmed, setOrderConfirmed] = useState(false)

  useEffect(() => {
    try {
      const storedItems: unknown = JSON.parse(window.localStorage.getItem(cartStorageKey) ?? "[]")
      if (Array.isArray(storedItems)) {
        setCartItems(storedItems.flatMap((item): CartItem[] => {
          if (!item || typeof item.productId !== "string" || typeof item.size !== "string" || !Number.isInteger(item.quantity)) return []
          const product = products.find((candidate) => candidate._id === item.productId)
          const variant = product?.variants.find((candidate) => candidate.size === item.size)
          if (!product || !variant || item.quantity < 1 || variant.stock < 1) return []
          return [{ productId: product._id, size: variant.size, quantity: Math.min(item.quantity, variant.stock) }]
        }))
      }
    } catch {
      setCartItems([])
    }
    setCartReady(true)
  }, [products])

  useEffect(() => {
    if (!cartReady) return
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cartItems))
    } catch {
      setCartMessage("Your bag could not be saved on this device.")
    }
  }, [cartItems, cartReady])

  const cartLines = cartItems.flatMap((item) => {
    const product = products.find((candidate) => candidate._id === item.productId)
    const variant = product?.variants.find((candidate) => candidate.size === item.size)
    return product && variant ? [{ ...item, product, variant }] : []
  })
  const cartCount = cartLines.reduce((total, item) => total + item.quantity, 0)
  const cartSubtotal = cartLines.reduce((total, item) => total + item.product.priceNgn * item.quantity, 0)
  const freeDeliveryActive = Date.now() < freeDeliveryEndsAt
  const qualifiesForFreeDelivery = checkoutForm.region === "lagos" && freeDeliveryActive && cartSubtotal >= freeDeliveryThreshold
  const vatAmount = Math.round(cartSubtotal * 0.075)
  const deliveryFee = qualifiesForFreeDelivery ? 0 : checkoutForm.region === "lagos" ? 15_000 : 30_000

  const addToBag = (product: StoreProduct, size: string) => {
    const variant = product.variants.find((item) => item.size === size)
    if (!variant || variant.stock < 1) return
    const existingItem = cartItems.find((item) => item.productId === product._id && item.size === size)
    if (existingItem && existingItem.quantity >= variant.stock) {
      setCartMessage(`All available stock in ${size} is already in your bag.`)
      setCartOpen(true)
      return
    }

    setCartItems((items) => {
      const currentItem = items.find((item) => item.productId === product._id && item.size === size)
      if (!currentItem) return [...items, { productId: product._id, size, quantity: 1 }]
      return items.map((item) => item.productId === product._id && item.size === size
        ? { ...item, quantity: Math.min(item.quantity + 1, variant.stock) }
        : item)
    })
    setCartMessage(`${product.name} · ${size} added to your bag.`)
    setCartOpen(true)
  }

  const changeQuantity = (productId: string, size: string, change: number) => {
    const product = products.find((candidate) => candidate._id === productId)
    const variant = product?.variants.find((candidate) => candidate.size === size)
    if (!product || !variant) return
    setCartItems((items) => items.flatMap((item) => {
      if (item.productId !== productId || item.size !== size) return [item]
      const quantity = Math.min(item.quantity + change, variant.stock)
      return quantity > 0 ? [{ ...item, quantity }] : []
    }))
    setCartMessage("")
  }

  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCheckoutBusy(true)
    setCheckoutError("")
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: checkoutForm.name, email: checkoutForm.email, phone: checkoutForm.phone },
          deliveryRegion: checkoutForm.region,
          deliveryAddress: {
            addressLine: checkoutForm.addressLine,
            city: checkoutForm.city,
            state: checkoutForm.state,
          },
          items: cartItems,
        }),
      })
      const result = await response.json()
      if (!response.ok || typeof result.authorizationUrl !== "string") {
        setCheckoutError(typeof result.error === "string" ? result.error : "Checkout could not be started. Please try again.")
        return
      }
      window.location.assign(result.authorizationUrl)
    } catch {
      setCheckoutError("We could not reach checkout. Please try again.")
    } finally {
      setCheckoutBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#24221f]">
      {freeDeliveryActive && <div className="bg-[#24221f] px-6 py-2.5 text-center text-[10px] font-medium uppercase tracking-[0.26em] text-[#e9dfd0]">Complimentary Lagos delivery on orders of ₦250,000 or more until 1 January 2027 · Shop the new season</div>}
      <header className="sticky top-0 z-30 border-b border-[#24221f]/10 bg-[#f8f6f1]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between px-5 md:px-10">
          <button aria-label="Open menu" className="md:hidden" onClick={() => setMobileOpen(true)}><Menu size={21} strokeWidth={1.5} /></button>
          <div className="flex items-center gap-3 md:w-1/4"><div className="text-[21px] font-semibold tracking-[-0.08em]">HARAB CLOTHINGS</div><div className="hidden h-7 w-px bg-[#24221f]/25 sm:block" /><div className="hidden text-[9px] uppercase leading-[1.4] tracking-[0.2em] text-[#6e665e] sm:block">Since 2019</div></div>
          <nav className="hidden items-center gap-7 text-[10px] font-medium uppercase tracking-[0.14em] lg:flex"><a href="#new-in" className="hover:text-[#936f49]">New in</a><a href="#collection" className="hover:text-[#936f49]">The collection</a><a href="#story" className="hover:text-[#936f49]">Our story</a><a href="#journal" className="hover:text-[#936f49]">Journal</a></nav>
          <div className="flex items-center justify-end gap-4 md:w-1/4"><button aria-label="Search" className="hidden sm:block"><Search size={18} strokeWidth={1.4} /></button><button aria-label="Account" className="hidden sm:block" onClick={() => setOrderConfirmed(true)}><UserRound size={18} strokeWidth={1.4} /></button><button aria-label="Wishlist" className="relative" onClick={() => setSaved(saved.length ? [] : [0])}><Heart size={18} strokeWidth={1.4} fill={saved.length ? "#936f49" : "none"} />{saved.length > 0 && <span className="absolute -right-2 -top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#936f49] text-[8px] text-white">{saved.length}</span>}</button><button aria-label="Open shopping bag" className="relative" onClick={() => setCartOpen(true)}><ShoppingBag size={19} strokeWidth={1.4} /><span className="absolute -right-2 -top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#24221f] text-[8px] text-white">{cartCount}</span></button></div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1440px] grid-cols-1 gap-8 px-5 pb-16 pt-7 md:grid-cols-[0.82fr_1.18fr] md:px-10 md:pb-24 md:pt-10">
        <div className="flex flex-col justify-between py-7 md:py-14"><div><p className="mb-8 text-[10px] uppercase tracking-[0.28em] text-[#936f49]">The autumn / winter edit · 2024</p><h1 className="max-w-[500px] font-serif text-[clamp(3.3rem,6.2vw,7.2rem)] leading-[0.88] tracking-[-0.065em]">Rooted in<br /><em className="font-normal">quiet</em> luxury.</h1><p className="mt-8 max-w-[350px] text-[14px] leading-7 text-[#6e665e]">Thoughtful silhouettes for a life well lived. Made in Lagos, designed for everywhere.</p><div className="mt-10 flex items-center gap-5"><button onClick={() => document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" })} className="group flex items-center gap-7 bg-[#24221f] px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-[#936f49]">Shop the edit <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></button><a href="#story" className="border-b border-[#24221f] pb-1 text-[10px] font-semibold uppercase tracking-[0.18em]">Discover Harab Clothings</a></div></div><div className="mt-16 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-[#936f49]"><span className="h-px w-10 bg-[#936f49]" /> Designed with intention</div></div>
        <div className="relative min-h-[530px] overflow-hidden bg-[#cfc0b2] md:min-h-[680px]"><img src="https://images.unsplash.com/photo-1618244972963-dbee1a7edc95?auto=format&fit=crop&w=1400&q=90" alt="Woman wearing an elegant neutral-toned flowing dress" className="h-full w-full object-cover object-center mix-blend-multiply opacity-90 transition-transform duration-700 hover:scale-[1.03]" /><div className="absolute inset-0 bg-gradient-to-t from-[#3c3027]/25 via-transparent to-transparent" /><div className="absolute bottom-6 left-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-white"><span className="h-px w-8 bg-white" /> Look 01 / 12</div><div className="absolute right-6 top-6 border border-white/70 px-3 py-2 text-[9px] uppercase tracking-[0.2em] text-white">The new ritual</div></div>
      </section>

      <section className="border-y border-[#24221f]/10 bg-[#eee9e1] px-5 py-8 md:px-10"><div className="mx-auto flex max-w-[1440px] flex-col gap-6 md:flex-row md:items-center md:justify-between"><div><p className="text-[10px] uppercase tracking-[0.24em] text-[#936f49]">Find your fit</p><h2 className="mt-2 font-serif text-2xl tracking-[-0.04em]">Modesty, made considered.</h2></div><div className="grid w-full gap-2 md:w-[64%] md:grid-cols-3">{filters.map(([title, detail], index) => <div key={title} className="relative"><button onClick={() => setOpenFilter(openFilter === index ? null : index)} className="flex w-full items-center justify-between border-b border-[#24221f]/25 px-1 py-3 text-left"><span><span className="block text-[9px] uppercase tracking-[0.16em] text-[#6e665e]">0{index + 1} / {title}</span><span className="mt-1 block text-[12px]">{detail}</span></span><ChevronDown size={15} className={`transition-transform ${openFilter === index ? "rotate-180" : ""}`} /></button>{openFilter === index && <div className="absolute left-0 right-0 top-full z-10 mt-1 border border-[#24221f]/10 bg-[#f8f6f1] p-3 text-[11px] shadow-lg"><div className="py-2 hover:text-[#936f49]">{detail}</div><div className="py-2 hover:text-[#936f49]">Loose / fluid fit</div><div className="py-2 hover:text-[#936f49]">Maxi length</div></div>}</div>)}</div></div></section>

      <section id="collection" className="mx-auto max-w-[1440px] px-5 py-20 md:px-10 md:py-28">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#936f49]">01 — The collection</p>
            <h2 className="mt-3 font-serif text-4xl tracking-[-0.05em] md:text-6xl">The quiet statement</h2>
          </div>
          <a href="#new-in" className="hidden items-center gap-3 border-b border-[#24221f] pb-1 text-[10px] font-semibold uppercase tracking-[0.17em] md:flex">View all <ArrowRight size={14} /></a>
        </div>
        {products.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#6e665e]">The next collection is being prepared.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-4 md:gap-5">
            {products.map((product, index) => (
              <article key={product._id} className="group">
                <div className="relative aspect-[0.78] overflow-hidden bg-[#eee9e1]" style={product.tone ? { backgroundColor: product.tone } : undefined}>
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover grayscale-[15%] transition duration-700 group-hover:scale-105" />
                  <span className="absolute left-3 top-3 bg-[#f8f6f1]/90 px-2 py-1 text-[8px] uppercase tracking-[0.15em]">{product.badge}</span>
                  <button aria-label={`Save ${product.name}`} onClick={() => setSaved(saved.includes(index) ? saved.filter((item) => item !== index) : [...saved, index])} className="absolute right-3 top-3 rounded-full bg-[#f8f6f1]/85 p-2"><Heart size={15} strokeWidth={1.4} fill={saved.includes(index) ? "#936f49" : "none"} /></button>
                </div>
                <div className="mt-4 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-lg leading-none">{product.name}</h3>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#8a8176]">{product.note}</p>
                  </div>
                  <p className="text-[11px] font-medium">{product.price}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <select
                    aria-label={`Choose UK size for ${product.name}`}
                    value={selectedSizes[product._id] ?? ""}
                    onChange={(event) => setSelectedSizes((sizes) => ({ ...sizes, [product._id]: event.target.value }))}
                    className="min-w-0 flex-1 border border-[#24221f]/20 bg-transparent px-2 py-2 text-xs"
                  >
                    <option value="">Choose size</option>
                    {product.variants.map((variant) => (
                      <option key={variant.size} value={variant.size} disabled={variant.stock < 1}>{variant.size}{variant.stock < 1 ? " · Sold out" : ""}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => addToBag(product, selectedSizes[product._id] ?? "")}
                    disabled={!selectedSizes[product._id] || !product.variants.some((variant) => variant.size === selectedSizes[product._id] && variant.stock > 0)}
                    className="bg-[#24221f] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#936f49] disabled:cursor-not-allowed disabled:bg-[#8a8176]"
                  >Add to bag</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="story" className="bg-[#24221f] px-5 py-20 text-[#f8f6f1] md:px-10 md:py-28"><div className="mx-auto grid max-w-[1200px] gap-14 md:grid-cols-[0.85fr_1.15fr] md:items-center"><div className="relative aspect-[0.8] overflow-hidden"><img src="https://images.unsplash.com/photo-1605763240000-7e93b172d754?auto=format&fit=crop&w=900&q=85" alt="Detail of warm textured fashion fabric" className="h-full w-full object-cover opacity-80" /><span className="absolute bottom-5 left-5 text-[9px] uppercase tracking-[0.2em] text-[#e9dfd0]">Made slowly / Worn often</span></div><div><p className="text-[10px] uppercase tracking-[0.24em] text-[#b39470]">02 — Our point of view</p><h2 className="mt-5 max-w-[580px] font-serif text-5xl leading-[0.94] tracking-[-0.06em] md:text-7xl">Clothes with a<br /><em className="font-normal text-[#c9af8f]">sense of place.</em></h2><p className="mt-8 max-w-[420px] text-[14px] leading-7 text-[#c6bdb2]">Harab Clothings is a Lagos-born wardrobe built around the beauty of restraint. We make pieces that honour where we come from, while leaving room for where you’re going.</p><a href="#journal" className="mt-9 inline-flex items-center gap-3 border-b border-[#c9af8f] pb-2 text-[10px] uppercase tracking-[0.18em] text-[#e9dfd0]">Read our story <ArrowRight size={14} /></a></div></div></section>

      <footer className="bg-[#eee9e1] px-5 pb-8 pt-16 md:px-10 md:pt-20"><div className="mx-auto max-w-[1440px]"><div className="grid gap-12 border-b border-[#24221f]/15 pb-16 md:grid-cols-[1.3fr_0.7fr_0.7fr_1.2fr]"><div><div className="text-2xl font-semibold tracking-[-0.08em]">HARAB CLOTHINGS</div><p className="mt-5 max-w-[240px] text-[12px] leading-6 text-[#6e665e]">A considered wardrobe for the modern woman. Rooted in Nigeria, made for everywhere.</p></div><div><h3 className="text-[10px] font-semibold uppercase tracking-[0.18em]">Explore</h3><div className="mt-5 space-y-3 text-[12px] text-[#6e665e]"><a className="block hover:text-[#936f49]" href="#collection">The collection</a><a className="block hover:text-[#936f49]" href="#story">Our story</a><a className="block hover:text-[#936f49]" href="#journal">Journal</a></div></div><div><h3 className="text-[10px] font-semibold uppercase tracking-[0.18em]">Client services</h3><div className="mt-5 space-y-3 text-[12px] text-[#6e665e]"><a className="block hover:text-[#936f49]" href="#">Shipping & returns</a><a className="block hover:text-[#936f49]" href="#">Size guide</a><a className="block hover:text-[#936f49]" href="#">Contact us</a></div></div><div><h3 className="text-[10px] font-semibold uppercase tracking-[0.18em]">Join the inner circle</h3><p className="mt-4 max-w-[280px] text-[12px] leading-6 text-[#6e665e]">Early access to new drops, studio notes, and things worth knowing.</p><div className="mt-5 flex border-b border-[#24221f]/35 pb-3"><input aria-label="Email address" placeholder="Your email address" className="w-full bg-transparent text-[12px] outline-none placeholder:text-[#8a8176]" /><button aria-label="Subscribe"><ArrowRight size={16} /></button></div></div></div><div className="flex flex-col justify-between gap-4 pt-7 text-[9px] uppercase tracking-[0.15em] text-[#8a8176] md:flex-row"><span>© 2024 Harab Clothings</span><div className="flex gap-5"><span>Sourced & tailored in Nigeria</span><span>Secure checkout</span></div></div></div></footer>

      {orderConfirmed && <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#f8f6f1] text-[#24221f]"><div className="mx-auto flex min-h-full max-w-[1180px] flex-col px-5 py-6 md:px-10 md:py-8"><div className="flex items-center justify-between border-b border-[#24221f]/15 pb-5"><div className="text-[21px] font-semibold tracking-[-0.08em]">HARAB CLOTHINGS</div><button aria-label="Close order confirmation" onClick={() => setOrderConfirmed(false)}><X size={20} strokeWidth={1.4} /></button></div><div className="grid flex-1 items-center gap-12 py-14 md:grid-cols-[1.05fr_0.95fr] md:gap-20 md:py-20"><div><p className="text-[10px] uppercase tracking-[0.24em] text-[#936f49]">Order confirmed · #HRB-24018</p><h2 className="mt-6 max-w-[620px] font-serif text-5xl leading-[0.94] tracking-[-0.06em] md:text-7xl">Thank you for<br /><em className="font-normal text-[#936f49]">your order.</em></h2><p className="mt-7 max-w-[470px] text-[15px] leading-7 text-[#6e665e]">Your luxury RTW piece is being prepared. We&apos;ll send delivery updates to the details used at checkout.</p><div className="mt-10 border-y border-[#24221f]/15 py-5"><p className="text-[10px] uppercase tracking-[0.18em] text-[#936f49]">The account hook</p><p className="mt-3 max-w-[470px] text-[13px] leading-6 text-[#6e665e]">Save your details for faster checkout next time, track your delivery, and save your modesty fit profile.</p><label className="mt-6 block text-[10px] font-semibold uppercase tracking-[0.16em]" htmlFor="account-password">Create a password</label><input id="account-password" type="password" placeholder="At least 8 characters" className="mt-3 w-full max-w-[420px] border-b border-[#24221f]/35 bg-transparent px-0 py-3 text-sm outline-none placeholder:text-[#8a8176] focus:border-[#936f49]" /><button className="mt-6 flex items-center gap-5 bg-[#24221f] px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#936f49]">Create My Account <ArrowRight size={15} /></button></div></div><div className="bg-[#eee9e1] p-6 md:p-10"><p className="text-[10px] uppercase tracking-[0.2em] text-[#936f49]">A moment worth keeping</p><div className="mt-6 aspect-[0.82] overflow-hidden bg-[#d9c7b7]"><img src={products[0].image} alt="Abeni Silk Abaya order" className="h-full w-full object-cover" /></div><div className="mt-5 flex items-end justify-between"><div><p className="font-serif text-2xl">Abeni Silk Abaya</p><p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#8a8176]">Mocha · Size 12 · 58&quot;</p></div><p className="text-[12px]">₦185,000</p></div></div></div><div className="flex flex-col gap-3 border-t border-[#24221f]/15 pt-5 text-[9px] uppercase tracking-[0.16em] text-[#8a8176] md:flex-row md:justify-between"><span>Made in Lagos · Delivered with care</span><button className="text-left hover:text-[#936f49] md:text-right" onClick={() => setOrderConfirmed(false)}>Return to the collection <ArrowRight className="ml-2 inline" size={12} /></button></div></div></div>}

      {mobileOpen && <div className="fixed inset-0 z-50 bg-[#f8f6f1] p-6"><div className="flex items-center justify-between"><div className="text-xl font-semibold tracking-[-0.08em]">HARAB CLOTHINGS</div><button aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={22} /></button></div><nav className="mt-20 space-y-7 font-serif text-4xl"><a className="block" href="#new-in" onClick={() => setMobileOpen(false)}>New in</a><a className="block" href="#collection" onClick={() => setMobileOpen(false)}>The collection</a><a className="block" href="#story" onClick={() => setMobileOpen(false)}>Our story</a><a className="block" href="#journal" onClick={() => setMobileOpen(false)}>Journal</a></nav><div className="absolute bottom-8 left-6 right-6 border-t border-[#24221f]/15 pt-5 text-[10px] uppercase tracking-[0.18em] text-[#6e665e]">Lagos · London · Everywhere</div></div>}

      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <button aria-label="Close cart" className="absolute inset-0 bg-[#24221f]/35" onClick={() => setCartOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-labelledby="cart-title" className="absolute right-0 top-0 flex h-full w-full max-w-[430px] flex-col bg-[#f8f6f1] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#24221f]/15 pb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#936f49]">Your selection</p>
                <h2 id="cart-title" className="mt-1 font-serif text-3xl">Shopping bag <span className="text-base text-[#8a8176]">({cartCount})</span></h2>
              </div>
              <button aria-label="Close cart" onClick={() => setCartOpen(false)}><X size={20} /></button>
            </div>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto py-6">
              {cartLines.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="font-serif text-xl">Your bag is empty</p>
                  <p className="mt-2 text-sm text-[#6e665e]">Explore the collection to find your next favourite.</p>
                </div>
              ) : (
                cartLines.map(({ product, quantity, size, variant }) => (
                  <div key={product._id} className="flex gap-4 border-b border-[#24221f]/10 pb-5">
                    <div className="h-28 w-24 shrink-0 overflow-hidden bg-[#eee9e1]">
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <h3 className="font-serif text-xl">{product.name}</h3>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#8a8176]">{size} · {product.note}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 border border-[#24221f]/20 px-2 py-1">
                          <button aria-label={quantity === 1 ? `Remove ${product.name} ${size}` : `Decrease ${product.name} ${size} quantity`} onClick={() => changeQuantity(product._id, size, -1)}><Minus size={12} /></button>
                          <span className="min-w-4 text-center text-[11px]">{quantity}</span>
                          <button aria-label={`Increase ${product.name} ${size} quantity`} disabled={quantity >= variant.stock} onClick={() => changeQuantity(product._id, size, 1)}><Plus size={12} /></button>
                        </div>
                        <span className="text-[12px]">{formatNaira(product.priceNgn * quantity)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {cartMessage && <p role="status" className="text-xs text-[#6e665e]">{cartMessage}</p>}
              {cartCount > 0 && freeDeliveryActive && (
                <p className="border-y border-[#24221f]/10 py-4 text-xs leading-5 text-[#6e665e]">
                  {qualifiesForFreeDelivery
                    ? "You qualify for complimentary delivery."
                    : `Add ${formatNaira(freeDeliveryThreshold - cartSubtotal)} more for complimentary delivery.`}
                  <span className="mt-1 block text-[10px] uppercase tracking-[0.12em]">Offer ends 1 January 2027</span>
                </p>
              )}
            </div>
            <div className="border-t border-[#24221f]/15 pt-5">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatNaira(cartSubtotal)}</span></div>
              {checkoutOpen && (
                <>
                  <div className="mt-3 flex justify-between text-sm"><span>VAT (7.5%)</span><span>{formatNaira(vatAmount)}</span></div>
                  <div className="mt-3 flex justify-between text-sm"><span>Delivery</span><span>{formatNaira(deliveryFee)}</span></div>
                  <div className="mt-3 flex justify-between border-t border-[#24221f]/15 pt-3 text-sm font-semibold"><span>Estimated total</span><span>{formatNaira(cartSubtotal + vatAmount + deliveryFee)}</span></div>
                </>
              )}
              {!checkoutOpen ? (
                <button
                  disabled={cartCount === 0}
                  onClick={() => { setCheckoutOpen(true); setCheckoutError("") }}
                  className="mt-5 flex w-full items-center justify-center gap-4 bg-[#24221f] py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#936f49] disabled:cursor-not-allowed disabled:bg-[#8a8176]"
                >Continue to checkout <ArrowRight size={14} /></button>
              ) : (
                <form onSubmit={submitCheckout} className="mt-5 max-h-[45vh] space-y-3 overflow-y-auto pr-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.12em]" htmlFor="checkout-name">Full name</label>
                  <input id="checkout-name" autoComplete="name" required minLength={2} maxLength={120} value={checkoutForm.name} onChange={(event) => setCheckoutForm((form) => ({ ...form, name: event.target.value }))} className="w-full border border-[#24221f]/20 bg-transparent px-3 py-3 text-sm" />
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.12em]" htmlFor="checkout-email">Email</label>
                  <input id="checkout-email" type="email" autoComplete="email" required maxLength={254} value={checkoutForm.email} onChange={(event) => setCheckoutForm((form) => ({ ...form, email: event.target.value }))} className="w-full border border-[#24221f]/20 bg-transparent px-3 py-3 text-sm" />
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.12em]" htmlFor="checkout-phone">Phone</label>
                  <input id="checkout-phone" type="tel" autoComplete="tel" required value={checkoutForm.phone} onChange={(event) => setCheckoutForm((form) => ({ ...form, phone: event.target.value }))} className="w-full border border-[#24221f]/20 bg-transparent px-3 py-3 text-sm" />
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.12em]" htmlFor="checkout-region">Delivery region</label>
                  <select id="checkout-region" value={checkoutForm.region} onChange={(event) => setCheckoutForm((form) => ({ ...form, region: event.target.value as DeliveryRegion }))} className="w-full border border-[#24221f]/20 bg-[#f8f6f1] px-3 py-3 text-sm">
                    <option value="lagos">Lagos</option>
                    <option value="outside_lagos">Outside Lagos</option>
                  </select>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.12em]" htmlFor="checkout-address">Street address</label>
                  <input id="checkout-address" autoComplete="street-address" required minLength={5} maxLength={300} value={checkoutForm.addressLine} onChange={(event) => setCheckoutForm((form) => ({ ...form, addressLine: event.target.value }))} className="w-full border border-[#24221f]/20 bg-transparent px-3 py-3 text-sm" />
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.12em]" htmlFor="checkout-city">City / area</label>
                  <input id="checkout-city" autoComplete="address-level2" required minLength={2} maxLength={100} value={checkoutForm.city} onChange={(event) => setCheckoutForm((form) => ({ ...form, city: event.target.value }))} className="w-full border border-[#24221f]/20 bg-transparent px-3 py-3 text-sm" />
                  {checkoutForm.region === "outside_lagos" && <p className="text-xs leading-5 text-[#6e665e]">Outside-Lagos delivery is currently available at the flat rate shown above.</p>}
                  {checkoutError && <p role="alert" className="text-xs text-red-700">{checkoutError}</p>}
                  <button type="submit" disabled={checkoutBusy || cartCount === 0} className="flex w-full items-center justify-center gap-4 bg-[#24221f] py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#936f49] disabled:cursor-wait disabled:opacity-60">
                    {checkoutBusy ? "Connecting to Paystack…" : "Continue to Paystack"} <ArrowRight size={14} />
                  </button>
                  <p className="text-center text-[10px] leading-4 text-[#8a8176]">Delivery is arranged through Chowdeck after payment confirmation. Payment is completed on Paystack.</p>
                </form>
              )}
              {!checkoutOpen && <p className="mt-3 text-center text-[10px] text-[#8a8176]">VAT and delivery are shown before you continue to payment.</p>}
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}
