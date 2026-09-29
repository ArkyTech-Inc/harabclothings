import { defineConfig } from "sanity"
import { structureTool } from "sanity/structure"
import { productType } from "./sanity/schemaTypes/product"

export const sanityProjectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? ""
export const sanityDataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production"

export default defineConfig({
  name: "harab-clothings",
  title: "Harab Clothings",
  projectId: sanityProjectId || "project-id-not-configured",
  dataset: sanityDataset,
  plugins: [structureTool()],
  schema: { types: [productType] },
})