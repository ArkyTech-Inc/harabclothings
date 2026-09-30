import { defineField, defineType } from "sanity"

export const productType = defineType({
  name: "product",
  title: "Product",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Product name",
      type: "string",
      validation: (rule) => rule.required().min(2).max(100),
    }),
    defineField({
      name: "slug",
      title: "URL slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "price",
      title: "Price (NGN)",
      type: "number",
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: "note",
      title: "Product description",
      type: "string",
      validation: (rule) => rule.required().max(160),
    }),
    defineField({
      name: "image",
      title: "Product image",
      type: "image",
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "badge",
      title: "Collection label",
      type: "string",
      validation: (rule) => rule.max(30),
    }),
    defineField({
      name: "tone",
      title: "Image background color",
      description: "Optional hex color, for example #c6b8a4.",
      type: "string",
      validation: (rule) => rule.regex(/^#[\da-f]{6}$/i),
    }),
    defineField({
      name: "variants",
      title: "Sizes and stock",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "size",
              title: "UK size",
              type: "string",
              options: { list: ["UK 8", "UK 10", "UK 12", "UK 14", "UK 16", "UK 18", "UK 20"] },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "stock",
              title: "Available quantity",
              type: "number",
              initialValue: 0,
              validation: (rule) => rule.required().integer().min(0),
            }),
          ],
          preview: {
            select: { title: "size", subtitle: "stock" },
            prepare({ title, subtitle }) {
              return { title, subtitle: `${subtitle ?? 0} in stock` }
            },
          },
        },
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "isAvailable",
      title: "Available for sale",
      description: "Only published products marked available and with at least one in-stock size appear in the storefront.",
      type: "boolean",
      initialValue: false,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "price", media: "image" },
    prepare({ title, subtitle, media }) {
      return {
        title,
        subtitle: typeof subtitle === "number" ? `₦${subtitle.toLocaleString("en-NG")}` : "No price set",
        media,
      }
    },
  },
})