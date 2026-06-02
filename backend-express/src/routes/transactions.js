const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const prisma = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { validateCategory, EXPENSE_CATEGORIES, INCOME_CATEGORIES } = require('../utils/categories');

const upload = multer({ storage: multer.memoryStorage() });

// Helper to convert BigInt to Number for JSON
const serializeTransaction = (t) => ({
  id: t.id,
  user_id: t.userId,
  date: t.date.toISOString().split('T')[0],
  amount: Number(t.amount),
  type: t.type,
  category: t.category,
  description: t.description,
  created_at: t.createdAt,
  updated_at: t.updatedAt,
});

// GET /transactions
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, category, start_date, end_date } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where = { userId: req.user.id };

    if (type) where.type = type;
    if (category) where.category = category.toLowerCase();
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      data: transactions.map(serializeTransaction),
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(total / limitNum) || 1,
    });
  } catch (error) {
    next(error);
  }
});

// POST /transactions
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { date, amount, type, category, description } = req.body;

    if (!date || !amount || !type || !category) {
      return res.status(400).json({ detail: 'Date, amount, type, dan category wajib diisi' });
    }

    if (amount <= 0) {
      return res.status(400).json({ detail: 'Amount harus lebih dari 0' });
    }

    if (!validateCategory(type, category)) {
      const validCategories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
      return res.status(400).json({
        detail: `Kategori tidak valid untuk ${type}. Pilihan: ${validCategories.join(', ')}`
      });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        date: new Date(date),
        amount: BigInt(amount),
        type,
        category: category.toLowerCase(),
        description: description || null,
      },
    });

    res.status(201).json(serializeTransaction(transaction));
  } catch (error) {
    next(error);
  }
});

// PUT /transactions/:id
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, amount, type, category, description } = req.body;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ detail: 'Transaksi tidak ditemukan' });
    }

    const newType = type || existing.type;
    const newCategory = category || existing.category;

    if ((type || category) && !validateCategory(newType, newCategory)) {
      const validCategories = newType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
      return res.status(400).json({
        detail: `Kategori tidak valid untuk ${newType}. Pilihan: ${validCategories.join(', ')}`
      });
    }

    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({ detail: 'Amount harus lebih dari 0' });
    }

    const updateData = {};
    if (date) updateData.date = new Date(date);
    if (amount) updateData.amount = BigInt(amount);
    if (type) updateData.type = type;
    if (category) updateData.category = category.toLowerCase();
    if (description !== undefined) updateData.description = description || null;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    res.json(serializeTransaction(transaction));
  } catch (error) {
    next(error);
  }
});

// DELETE /transactions/:id
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ detail: 'Transaksi tidak ditemukan' });
    }

    await prisma.transaction.delete({ where: { id } });

    res.json({ message: 'deleted' });
  } catch (error) {
    next(error);
  }
});

// POST /transactions/import
router.post('/import', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ detail: 'File tidak ditemukan' });
    }

    if (!req.file.originalname.endsWith('.csv')) {
      return res.status(400).json({ detail: 'File harus berformat CSV' });
    }

    const content = req.file.buffer.toString('utf-8');
    let rows;

    try {
      rows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseError) {
      return res.status(400).json({ detail: `Gagal parse CSV: ${parseError.message}` });
    }

    let imported = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header

      try {
        // Normalize keys
        const normalizedRow = {};
        for (const key of Object.keys(row)) {
          normalizedRow[key.toLowerCase().trim()] = row[key];
        }

        // Parse date
        const dateStr = (normalizedRow.date || normalizedRow.tanggal || '').trim();
        if (!dateStr) throw new Error('Tanggal kosong');

        let parsedDate;
        const dateFormats = [
          /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
          /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
          /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
        ];

        for (const fmt of dateFormats) {
          const match = dateStr.match(fmt);
          if (match) {
            if (fmt === dateFormats[0]) {
              parsedDate = new Date(match[1], match[2] - 1, match[3]);
            } else {
              parsedDate = new Date(match[3], match[2] - 1, match[1]);
            }
            break;
          }
        }

        if (!parsedDate || isNaN(parsedDate.getTime())) {
          throw new Error(`Format tanggal tidak valid: ${dateStr}`);
        }

        // Parse amount
        const amountStr = (normalizedRow.amount || '').replace(/[.,]/g, '').trim();
        if (!amountStr) throw new Error('Amount kosong');
        const amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) throw new Error('Amount harus positif');

        // Parse type
        const txType = (normalizedRow.type || '').toLowerCase().trim();
        if (!['income', 'expense'].includes(txType)) {
          throw new Error(`Type harus 'income' atau 'expense', got: ${txType}`);
        }

        // Parse category
        const category = (normalizedRow.category || '').toLowerCase().trim();
        if (!category) throw new Error('Category kosong');

        if (!validateCategory(txType, category)) {
          const validCats = txType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
          throw new Error(`Category '${category}' tidak valid. Pilihan: ${validCats.join(', ')}`);
        }

        // Parse description
        const description = (normalizedRow.description || '').trim() || null;

        // Create transaction
        await prisma.transaction.create({
          data: {
            userId: req.user.id,
            date: parsedDate,
            amount: BigInt(amount),
            type: txType,
            category,
            description,
          },
        });

        imported++;
      } catch (err) {
        failed++;
        if (errors.length < 10) {
          errors.push({
            row: rowNum,
            data: row,
            error: err.message,
          });
        }
      }
    }

    res.json({
      success: failed === 0,
      total_rows: rows.length,
      imported,
      failed,
      errors,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
