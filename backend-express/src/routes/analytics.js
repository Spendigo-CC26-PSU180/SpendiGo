const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { parseMonth } = require('../utils/dateHelper');

// GET /analytics/summary
router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    const { month } = req.query;
    const { startDate, endDate } = parseMonth(month);
    const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    const transactions = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: true,
    });

    let totalIncome = 0n;
    let totalExpense = 0n;
    let transactionCount = 0;

    for (const t of transactions) {
      if (t.type === 'income') {
        totalIncome = t._sum.amount || 0n;
      } else {
        totalExpense = t._sum.amount || 0n;
      }
      transactionCount += t._count;
    }

    const avgDailyExpense = daysInPeriod > 0 ? Number(totalExpense) / daysInPeriod : 0;

    res.json({
      total_income: Number(totalIncome),
      total_expense: Number(totalExpense),
      balance: Number(totalIncome - totalExpense),
      transaction_count: transactionCount,
      avg_daily_expense: Math.round(avgDailyExpense),
    });
  } catch (error) {
    next(error);
  }
});

// GET /analytics/category
router.get('/category', authMiddleware, async (req, res, next) => {
  try {
    const { month, type = 'expense' } = req.query;
    const { startDate, endDate } = parseMonth(month);

    const categories = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
        type,
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });

    const total = categories.reduce((sum, c) => sum + Number(c._sum.amount || 0n), 0);

    if (total === 0) {
      return res.json([]);
    }

    res.json(
      categories.map((c) => ({
        category: c.category,
        total: Number(c._sum.amount),
        percentage: Math.round((Number(c._sum.amount) / total) * 1000) / 10,
        count: c._count,
      }))
    );
  } catch (error) {
    next(error);
  }
});

// GET /analytics/trend
router.get('/trend', authMiddleware, async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
      },
      select: { date: true, type: true, amount: true },
    });

    // Build data map
    const dataMap = {};
    for (const t of transactions) {
      const dateKey = t.date.toISOString().split('T')[0];
      if (!dataMap[dateKey]) {
        dataMap[dateKey] = { income: 0, expense: 0 };
      }
      dataMap[dateKey][t.type] += Number(t.amount);
    }

    // Generate complete date range
    const result = [];
    let cumulativeBalance = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateKey = current.toISOString().split('T')[0];
      const dayData = dataMap[dateKey] || { income: 0, expense: 0 };
      cumulativeBalance += dayData.income - dayData.expense;

      result.push({
        date: dateKey,
        income: dayData.income,
        expense: dayData.expense,
        balance: cumulativeBalance,
      });

      current.setDate(current.getDate() + 1);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /analytics/spending-dna
router.get('/spending-dna', authMiddleware, async (req, res, next) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Get income and expense totals
    const totals = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    for (const t of totals) {
      if (t.type === 'income') totalIncome = Number(t._sum.amount || 0);
      else totalExpense = Number(t._sum.amount || 0);
    }

    // Get top categories
    const categories = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
        type: 'expense',
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 3,
    });

    const topCategories = categories.map((c) => ({
      category: c.category,
      amount: Number(c._sum.amount),
    }));

    if (totalExpense === 0 && totalIncome === 0) {
      return res.json({
        has_data: false,
        message: 'Belum ada data transaksi. Mulai catat pengeluaranmu!',
      });
    }

    // Calculate spending ratio and variance
    const spendingRatio = totalIncome > 0 ? totalExpense / totalIncome : 1;

    // Get daily expenses for variance calculation
    const dailyExpenses = await prisma.transaction.groupBy({
      by: ['date'],
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
        type: 'expense',
      },
      _sum: { amount: true },
    });

    const dailyAmounts = dailyExpenses.map((d) => Number(d._sum.amount));
    let variance = 0;
    if (dailyAmounts.length > 1) {
      const mean = dailyAmounts.reduce((a, b) => a + b, 0) / dailyAmounts.length;
      const sumSquares = dailyAmounts.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0);
      variance = mean > 0 ? Math.sqrt(sumSquares / dailyAmounts.length) / mean : 0;
    }

    // Determine DNA type
    let dnaType, icon, label, description;

    if (spendingRatio > 0.9) {
      dnaType = 'hedonist';
      icon = '🎉';
      label = 'Si Hedonist';
      description = 'Kamu suka menikmati hidup! Tapi hati-hati, jangan sampai kantong jebol ya.';
    } else if (spendingRatio < 0.5) {
      dnaType = 'saver';
      icon = '🐿️';
      label = 'Si Penabung';
      description = 'Kamu jago banget nabung! Tapi sesekali treat yourself juga boleh kok.';
    } else if (variance > 0.8) {
      dnaType = 'unpredictable';
      icon = '🎲';
      label = 'Si Unpredictable';
      description = 'Pengeluaranmu naik turun kayak roller coaster. Coba lebih konsisten ya!';
    } else {
      dnaType = 'balanced';
      icon = '⚖️';
      label = 'Si Seimbang';
      description = 'Balance is the key! Kamu udah bagus ngatur keuangan.';
    }

    res.json({
      has_data: true,
      dna_type: dnaType,
      icon,
      label,
      description,
      top_categories: topCategories,
    });
  } catch (error) {
    next(error);
  }
});

// GET /analytics/weekly-wrapped
router.get('/weekly-wrapped', authMiddleware, async (req, res, next) => {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysSinceMonday);
    weekStart.setHours(0, 0, 0, 0);

    const lastWeekEnd = new Date(weekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

    const lastWeekStart = new Date(lastWeekEnd);
    lastWeekStart.setDate(lastWeekStart.getDate() - 6);

    // This week's total
    const thisWeekResult = await prisma.transaction.aggregate({
      where: {
        userId: req.user.id,
        date: { gte: weekStart, lte: today },
        type: 'expense',
      },
      _sum: { amount: true },
    });
    const thisWeekTotal = Number(thisWeekResult._sum.amount || 0);

    // Last week's total
    const lastWeekResult = await prisma.transaction.aggregate({
      where: {
        userId: req.user.id,
        date: { gte: lastWeekStart, lte: lastWeekEnd },
        type: 'expense',
      },
      _sum: { amount: true },
    });
    const lastWeekTotal = Number(lastWeekResult._sum.amount || 0);

    // Percentage change
    let vsLastWeek = 0;
    if (lastWeekTotal > 0) {
      vsLastWeek = Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 1000) / 10;
    } else {
      vsLastWeek = thisWeekTotal === 0 ? 0 : 100;
    }

    // Busiest day
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dailyTotals = await prisma.$queryRaw`
      SELECT EXTRACT(DOW FROM date) as day_of_week, SUM(amount) as total
      FROM transactions
      WHERE user_id = ${req.user.id}
        AND date >= ${weekStart}
        AND date <= ${today}
        AND type = 'expense'
      GROUP BY EXTRACT(DOW FROM date)
      ORDER BY total DESC
      LIMIT 1
    `;

    const busiestDay = dailyTotals.length > 0 ? dayNames[Number(dailyTotals[0].day_of_week)] : '-';

    // Top category
    const topCategory = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId: req.user.id,
        date: { gte: weekStart, lte: today },
        type: 'expense',
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 1,
    });

    const topCat = topCategory.length > 0 ? topCategory[0].category : '-';
    const topCatAmount = topCategory.length > 0 ? Number(topCategory[0]._sum.amount) : 0;

    // Generate insight
    let insight;
    if (vsLastWeek > 20) {
      insight = `Minggu ini kamu lebih boros ${Math.abs(vsLastWeek)}% dari minggu lalu!`;
    } else if (vsLastWeek < -20) {
      insight = `Mantap! Kamu hemat ${Math.abs(vsLastWeek)}% dari minggu lalu!`;
    } else {
      insight = 'Pengeluaranmu minggu ini cukup stabil.';
    }

    res.json({
      total_spent: thisWeekTotal,
      vs_last_week: vsLastWeek,
      busiest_day: busiestDay,
      top_category: topCat,
      top_category_amount: topCatAmount,
      insight,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
