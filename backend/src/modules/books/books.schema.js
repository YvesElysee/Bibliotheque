const { z } = require('zod');

// Une couverture peut être :
//  - une URL distante (http/https),
//  - un chemin local téléchargé par le serveur (/uploads/covers/…),
//     y compris après téléversement manuel d'une image via POST /api/books/cover.
const coverUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (v) => v === '' || v.startsWith('/uploads/') || /^https?:\/\//i.test(v),
    { message: 'URL de couverture invalide.' }
  )
  .nullish();

const createBookSchema = z.object({
  title: z.string().min(1).max(255),
  author: z.string().min(1).max(255),
  publisher: z.string().max(255).nullish(),
  publishingHouse: z.string().max(255).nullish(),
  isbn: z.string().max(20).nullish(),
  year: z.number().int().min(1000).max(new Date().getFullYear() + 1).nullish(),
  edition: z.string().max(50).nullish(),
  language: z.string().max(10).default('fr'),
  pageCount: z.number().int().positive().nullish(),
  summary: z.string().max(5000).nullish(),
  coverUrl: coverUrlSchema,
  totalCopies: z.number().int().min(1).default(1),
  location: z.string().max(100).nullish(),
  tags: z.array(z.string()).default([]),
  categoryIds: z.array(z.string().uuid()).default([]),
});

const updateBookSchema = createBookSchema.partial();

const bookQuerySchema = z.object({
  search: z.string().optional(),
  author: z.string().optional(),
  publishingHouse: z.string().optional(),
  publisher: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  available: z.enum(['true', 'false']).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sort: z.enum(['title', 'author', 'year', 'createdAt', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createBookSchema, updateBookSchema, bookQuerySchema };
