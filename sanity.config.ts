import { defineConfig } from "sanity"
import { structureTool } from "sanity/structure"
import { productType } from "./sanity/schemaTypes/product"

export const sanityProjectId = "ws88g2lw"
export const sanityDataset = "production"

export default defineConfig({
  name: "harab-clothings",
  title: "Harab Clothings",
  projectId: sanityProjectId,
  dataset: sanityDataset,
  plugins: [structureTool()],
  schema: { types: [productType] },
})