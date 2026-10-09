const categoriesService = require('./categories.service');
const { success, created } = require('../../utils/apiResponse');
const { z } = require('zod');

const slugify = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const categorySchema = z.object({
  nameEn: z.string().min(1).max(100).optional().nullable(),
  nameFr: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6B7280'),
  icon: z.string().max(50).default('book'),
});

const getAll = async (req, res, next) => {
  try {
    const categories = await categoriesService.getAll();
    return success(res, categories);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    data.slug = data.slug || slugify(data.nameFr);
    data.nameEn = data.nameEn || data.nameFr;
    const category = await categoriesService.create(data);
    return created(res, category, 'Catégorie créée.');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const data = categorySchema.partial().parse(req.body);
    const category = await categoriesService.update(req.params.id, data);
    return success(res, category, 'Catégorie modifiée.');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await categoriesService.remove(req.params.id);
    return success(res, null, 'Catégorie supprimée.');
  } catch (err) { next(err); }
};

module.exports = { getAll, create, update, remove };
