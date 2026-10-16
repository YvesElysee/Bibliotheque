const prisma = require('../../config/database');
const { getPagination } = require('../../utils/pagination');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COVERS_DIR = path.join(__dirname, '../../../uploads/covers');
const COVER_MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Enregistre une couverture téléversée (data-URL base64) dans /uploads/covers/.
 * Renvoie le chemin local relatif, exploitable directement dans <img src>.
 */
const saveCoverFromDataUrl = (dataUrl) => {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(dataUrl || '').trim());
  if (!m) {
    const err = new Error('Format d\'image invalide.');
    err.statusCode = 400;
    throw err;
  }
  const mime = m[1].toLowerCase();
  const ext = COVER_MIME_EXT[mime];
  if (!ext) {
    const err = new Error('Type d\'image non supporté (JPEG, PNG, WEBP ou GIF).');
    err.statusCode = 400;
    throw err;
  }
  const buffer = Buffer.from(m[2], 'base64');
  if (!buffer.length) {
    const err = new Error('Fichier image vide.');
    err.statusCode = 400;
    throw err;
  }
  if (buffer.length > 5 * 1024 * 1024) {
    const err = new Error('Image trop volumineuse (5 Mo maximum).');
    err.statusCode = 413;
    throw err;
  }
  fs.mkdirSync(COVERS_DIR, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(COVERS_DIR, filename), buffer);
  return `/uploads/covers/${filename}`;
};


const BOOK_SELECT = {
  id: true,
  title: true,
  author: true,
  publisher: true,
  publishingHouse: true,
  isbn: true,
  year: true,
  edition: true,
  language: true,
  pageCount: true,
  summary: true,
  coverUrl: true,
  totalCopies: true,
  availableCopies: true,
  location: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  categories: {
    include: { category: { select: { id: true, nameFr: true, nameEn: true, slug: true, color: true, icon: true } } },
  },
  _count: { select: { reviews: true, loans: true, reservations: true } },
};

const getBooks = async (query) => {
  const { search, author, publishingHouse, publisher, category, language, available, sort = 'createdAt', order = 'desc' } = query;

  const where = { isActive: true };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { author: { contains: search, mode: 'insensitive' } },
      { publishingHouse: { contains: search, mode: 'insensitive' } },
      { publisher: { contains: search, mode: 'insensitive' } },
      { tags: { hasSome: [search] } },
    ];
  }
  if (author) where.author = { contains: author, mode: 'insensitive' };
  if (publishingHouse) where.publishingHouse = { contains: publishingHouse, mode: 'insensitive' };
  if (publisher) where.publisher = { contains: publisher, mode: 'insensitive' };
  if (language) where.language = language;
  if (available === 'true') where.availableCopies = { gt: 0 };
  if (available === 'false') where.availableCopies = 0;
  if (category) {
    where.categories = { some: { category: { slug: category } } };
  }

  const total = await prisma.book.count({ where });
  const { skip, take, meta } = getPagination(query, total);

  const books = await prisma.book.findMany({
    where,
    skip,
    take,
    orderBy: { [sort]: order },
    select: {
      ...BOOK_SELECT,
      reviews: { select: { rating: true } },
    },
  });

  // Calcul de la note moyenne
  const booksWithRating = books.map((b) => {
    const avgRating = b.reviews.length
      ? (b.reviews.reduce((sum, r) => sum + r.rating, 0) / b.reviews.length).toFixed(1)
      : null;
    const { reviews, ...book } = b;
    return { ...book, avgRating: avgRating ? parseFloat(avgRating) : null };
  });

  return { books: booksWithRating, meta };
};

const getBookById = async (id) => {
  const book = await prisma.book.findUnique({
    where: { id, isActive: true },
    select: {
      ...BOOK_SELECT,
      reviews: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!book) {
    const err = new Error('Livre introuvable.');
    err.statusCode = 404;
    throw err;
  }

  const avgRating = book.reviews.length
    ? parseFloat((book.reviews.reduce((sum, r) => sum + r.rating, 0) / book.reviews.length).toFixed(1))
    : null;

  return { ...book, avgRating };
};

const createBook = async (data, userId) => {
  const { categoryIds, ...bookData } = data;

  const book = await prisma.book.create({
    data: {
      ...bookData,
      availableCopies: bookData.totalCopies,
      addedBy: userId,
      categories: {
        create: categoryIds.map((categoryId) => ({ categoryId })),
      },
    },
    select: BOOK_SELECT,
  });

  return book;
};

const updateBook = async (id, data, userId) => {
  const { categoryIds, ...bookData } = data;

  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing || !existing.isActive) {
    const err = new Error('Livre introuvable.');
    err.statusCode = 404;
    throw err;
  }

  // Ajustement des exemplaires disponibles si totalCopies change
  if (bookData.totalCopies !== undefined) {
    const diff = bookData.totalCopies - existing.totalCopies;
    bookData.availableCopies = Math.max(0, existing.availableCopies + diff);
  }

  await prisma.$transaction(async (tx) => {
    if (categoryIds !== undefined) {
      await tx.bookCategory.deleteMany({ where: { bookId: id } });
      await tx.bookCategory.createMany({
        data: categoryIds.map((categoryId) => ({ bookId: id, categoryId })),
      });
    }
    await tx.book.update({ where: { id }, data: bookData });
  });

  return getBookById(id);
};

const deleteBook = async (id) => {
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) {
    const err = new Error('Livre introuvable.');
    err.statusCode = 404;
    throw err;
  }
  // Soft delete
  await prisma.book.update({ where: { id }, data: { isActive: false } });
};

const getBookStats = async () => {
  const [total, available, borrowed, categories] = await Promise.all([
    prisma.book.count({ where: { isActive: true } }),
    prisma.book.count({ where: { isActive: true, availableCopies: { gt: 0 } } }),
    prisma.loan.count({ where: { status: 'ACTIVE' } }),
    prisma.category.findMany({
      include: { _count: { select: { books: true } } },
    }),
  ]);

  return { total, available, borrowed, categories };
};

module.exports = { getBooks, getBookById, createBook, updateBook, deleteBook, getBookStats, saveCoverFromDataUrl };
