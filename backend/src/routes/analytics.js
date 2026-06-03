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

    // Get MONTHLY transactions (for display)
    const monthlyTransactions = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: true,
    });

    let monthlyIncome = 0n;
    let monthlyExpense = 0n;
    let transactionCount = 0;

    for (const t of monthlyTransactions) {
      if (t.type === 'income') {
        monthlyIncome = t._sum.amount || 0n;
      } else {
        monthlyExpense = t._sum.amount || 0n;
      }
      transactionCount += t._count;
    }

    // Get CUMULATIVE balance (all-time)
    const allTimeTransactions = await prisma.transaction.groupBy({
      by: ['type'],
      where: { userId: req.user.id },
      _sum: { amount: true },
    });

    let totalIncome = 0n;
    let totalExpense = 0n;

    for (const t of allTimeTransactions) {
      if (t.type === 'income') {
        totalIncome = t._sum.amount || 0n;
      } else {
        totalExpense = t._sum.amount || 0n;
      }
    }

    const totalBalance = Number(totalIncome - totalExpense);

    // Get avg daily expense from LAST 30 DAYS
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentExpense = await prisma.transaction.aggregate({
      where: {
        userId: req.user.id,
        type: 'expense',
        date: { gte: thirtyDaysAgo },
      },
      _sum: { amount: true },
    });

    const avgDailyExpense = Number(recentExpense._sum.amount || 0) / 30;

    res.json({
      // Monthly stats (for current month display)
      monthly_income: Number(monthlyIncome),
      monthly_expense: Number(monthlyExpense),
      monthly_net: Number(monthlyIncome - monthlyExpense),
      transaction_count: transactionCount,

      // Cumulative (real balance)
      total_balance: totalBalance,

      // Legacy fields (for backward compatibility)
      total_income: Number(monthlyIncome),
      total_expense: Number(monthlyExpense),
      balance: totalBalance,

      // Average from last 30 days
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

    // Get INITIAL BALANCE before the period (cumulative up to startDate)
    const previousTransactions = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId: req.user.id,
        date: { lt: startDate },
      },
      _sum: { amount: true },
    });

    let initialBalance = 0;
    for (const t of previousTransactions) {
      if (t.type === 'income') {
        initialBalance += Number(t._sum.amount || 0);
      } else {
        initialBalance -= Number(t._sum.amount || 0);
      }
    }

    // Get transactions within the period
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

    // Generate complete date range with CUMULATIVE balance
    const result = [];
    let cumulativeBalance = initialBalance; // Start from previous balance!
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

    // Get income and expense totals (last 30 days)
    const totals = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: true,
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const t of totals) {
      if (t.type === 'income') {
        totalIncome = Number(t._sum.amount || 0);
        incomeCount = t._count;
      } else {
        totalExpense = Number(t._sum.amount || 0);
        expenseCount = t._count;
      }
    }

    // Get ALL categories with amounts
    const categories = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
        type: 'expense',
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    const topCategories = categories.slice(0, 3).map((c) => ({
      category: c.category,
      amount: Number(c._sum.amount),
    }));

    if (totalExpense === 0 && totalIncome === 0) {
      return res.json({
        has_data: false,
        message: 'Belum ada data transaksi. Mulai catat pengeluaranmu!',
      });
    }

    // Calculate metrics
    const spendingRatio = totalIncome > 0 ? totalExpense / totalIncome : 1;
    const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;

    // Get category percentages
    const categoryPercentages = {};
    for (const c of categories) {
      categoryPercentages[c.category] = totalExpense > 0
        ? (Number(c._sum.amount) / totalExpense) * 100
        : 0;
    }

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

    // Count unique income sources
    const incomeSources = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
        type: 'income',
      },
    });

    // Determine DNA type with priority order
    let dnaType, label, description;

    // Food categories
    const foodCategories = ['makan', 'kopi'];
    const foodPct = foodCategories.reduce((sum, cat) => sum + (categoryPercentages[cat] || 0), 0);

    // Shopping categories
    const shopCategories = ['belanja online', 'fashion'];
    const shopPct = shopCategories.reduce((sum, cat) => sum + (categoryPercentages[cat] || 0), 0);

    // Social categories
    const socialCategories = ['nongkrong', 'hiburan'];
    const socialPct = socialCategories.reduce((sum, cat) => sum + (categoryPercentages[cat] || 0), 0);

    // Gaming
    const gamingPct = categoryPercentages['top up game'] || 0;

    // Investment
    const investPct = categoryPercentages['investasi'] || 0;

    // Priority-based DNA determination
    if (incomeCount > 2 && incomeSources.length >= 2) {
      // Multiple income sources
      dnaType = 'hustler';
      label = 'Si Hustler';
      description = 'Cuan dari mana-mana! Kamu punya multiple income streams. Keep grinding!';
    } else if (investPct >= 10) {
      // Investor
      dnaType = 'investor';
      label = 'Si Investor';
      description = 'Money makes money! Kamu paham pentingnya investasi untuk masa depan.';
    } else if (savingsRate >= 0.5) {
      // Super saver (saves 50%+)
      dnaType = 'saver';
      label = 'Si Penabung';
      description = 'Kamu jago banget nabung! Saving rate kamu di atas 50%. Amazing!';
    } else if (gamingPct >= 25) {
      // Gamer
      dnaType = 'gamer';
      label = 'Si Gamer';
      description = 'One more game! Pengeluaran gaming kamu lumayan tinggi. GG!';
    } else if (foodPct >= 40) {
      // Foodie
      dnaType = 'foodie';
      label = 'Si Foodie';
      description = 'Perut adalah raja! Kamu suka jajan dan eksplor kuliner. Yummy!';
    } else if (shopPct >= 35) {
      // Shopaholic
      dnaType = 'shopaholic';
      label = 'Si Shopaholic';
      description = 'Add to cart adalah mantra hidupmu. Checkout = therapy session!';
    } else if (socialPct >= 30) {
      // Social butterfly
      dnaType = 'social';
      label = 'Si Gaul';
      description = 'FOMO is real! Kamu suka nongkrong dan quality time bareng temen.';
    } else if (spendingRatio >= 0.9 && spendingRatio <= 1.0) {
      // Survivor (spending almost all but managing)
      dnaType = 'survivor';
      label = 'Si Survivor';
      description = 'Pas-pasan tapi survive! Kamu bisa manage keuangan di kondisi tight.';
    } else if (spendingRatio > 1.0) {
      // Hedonist (overspending)
      dnaType = 'hedonist';
      label = 'Si Hedonist';
      description = 'YOLO! Kamu suka enjoy hidup. Tapi hati-hati, jangan sampai bokek ya.';
    } else if (variance > 0.8) {
      // Impulsive (high variance)
      dnaType = 'impulsive';
      label = 'Si Impulsif';
      description = 'Spontan adalah middle name kamu! Pengeluaran naik turun unpredictable.';
    } else if (expenseCount < 10 && spendingRatio < 0.6) {
      // Minimalist
      dnaType = 'minimalist';
      label = 'Si Minimalis';
      description = 'Less is more! Kamu gak banyak transaksi dan hemat. Simple life!';
    } else if (variance < 0.3 && savingsRate >= 0.2) {
      // Planner (consistent + saves)
      dnaType = 'planner';
      label = 'Si Planner';
      description = 'Semua terencana! Pengeluaranmu konsisten dan kamu tetap bisa nabung.';
    } else {
      // Balanced (default)
      dnaType = 'balanced';
      label = 'Si Seimbang';
      description = 'Balance is the key! Kamu udah cukup baik ngatur keuangan.';
    }

    res.json({
      has_data: true,
      dna_type: dnaType,
      label,
      description,
      top_categories: topCategories,
      stats: {
        spending_ratio: Math.round(spendingRatio * 100),
        savings_rate: Math.round(savingsRate * 100),
        variance: Math.round(variance * 100),
        income_sources: incomeSources.length,
      },
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
