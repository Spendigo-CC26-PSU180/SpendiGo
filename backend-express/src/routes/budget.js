const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { getCurrentMonth } = require('../utils/dateHelper');

// GET /budget
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const targetMonth = req.query.month || getCurrentMonth();

    // Parse month for date range
    const [year, mon] = targetMonth.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0, 23, 59, 59);

    // Get budget goals
    const goals = await prisma.budgetGoal.findMany({
      where: {
        userId: req.user.id,
        month: targetMonth,
      },
    });

    // Get spending by category
    const spending = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
        type: 'expense',
      },
      _sum: { amount: true },
    });

    const spendingMap = {};
    for (const s of spending) {
      spendingMap[s.category] = Number(s._sum.amount || 0);
    }

    // Build response
    let totalBudget = 0;
    let totalSpent = 0;

    const goalResponses = goals.map((goal) => {
      const spent = spendingMap[goal.category] || 0;
      const budgetLimit = Number(goal.budgetLimit);
      const percentage = budgetLimit > 0 ? Math.min((spent / budgetLimit) * 100, 100) : 0;

      totalBudget += budgetLimit;
      totalSpent += spent;

      return {
        id: goal.id,
        category: goal.category,
        budget_limit: budgetLimit,
        spent,
        percentage: Math.round(percentage * 10) / 10,
        month: goal.month,
      };
    });

    // Sort by percentage (highest first)
    goalResponses.sort((a, b) => b.percentage - a.percentage);

    res.json({
      goals: goalResponses,
      total_budget: totalBudget,
      total_spent: totalSpent,
    });
  } catch (error) {
    next(error);
  }
});

// POST /budget
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { category, budget_limit, month } = req.body;
    const targetMonth = month || getCurrentMonth();

    if (!category || !budget_limit) {
      return res.status(400).json({ detail: 'Category dan budget_limit wajib diisi' });
    }

    // Check if goal already exists
    const existing = await prisma.budgetGoal.findFirst({
      where: {
        userId: req.user.id,
        category,
        month: targetMonth,
      },
    });

    if (existing) {
      return res.status(400).json({
        detail: `Budget goal for ${category} already exists this month`,
      });
    }

    // Create goal
    const goal = await prisma.budgetGoal.create({
      data: {
        userId: req.user.id,
        category,
        budgetLimit: BigInt(budget_limit),
        month: targetMonth,
      },
    });

    // Get current spending
    const [year, mon] = targetMonth.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0, 23, 59, 59);

    const spentResult = await prisma.transaction.aggregate({
      where: {
        userId: req.user.id,
        category,
        date: { gte: startDate, lte: endDate },
        type: 'expense',
      },
      _sum: { amount: true },
    });

    const spent = Number(spentResult._sum.amount || 0);
    const budgetLimit = Number(goal.budgetLimit);
    const percentage = budgetLimit > 0 ? Math.min((spent / budgetLimit) * 100, 100) : 0;

    res.status(201).json({
      id: goal.id,
      category: goal.category,
      budget_limit: budgetLimit,
      spent,
      percentage: Math.round(percentage * 10) / 10,
      month: goal.month,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /budget/:id
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { budget_limit } = req.body;

    if (!budget_limit) {
      return res.status(400).json({ detail: 'budget_limit wajib diisi' });
    }

    const goal = await prisma.budgetGoal.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!goal) {
      return res.status(404).json({ detail: 'Budget goal not found' });
    }

    const updatedGoal = await prisma.budgetGoal.update({
      where: { id },
      data: { budgetLimit: BigInt(budget_limit) },
    });

    // Get current spending
    const [year, mon] = goal.month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0, 23, 59, 59);

    const spentResult = await prisma.transaction.aggregate({
      where: {
        userId: req.user.id,
        category: goal.category,
        date: { gte: startDate, lte: endDate },
        type: 'expense',
      },
      _sum: { amount: true },
    });

    const spent = Number(spentResult._sum.amount || 0);
    const budgetLimit = Number(updatedGoal.budgetLimit);
    const percentage = budgetLimit > 0 ? Math.min((spent / budgetLimit) * 100, 100) : 0;

    res.json({
      id: updatedGoal.id,
      category: updatedGoal.category,
      budget_limit: budgetLimit,
      spent,
      percentage: Math.round(percentage * 10) / 10,
      month: updatedGoal.month,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /budget/:id
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    const goal = await prisma.budgetGoal.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!goal) {
      return res.status(404).json({ detail: 'Budget goal not found' });
    }

    await prisma.budgetGoal.delete({ where: { id } });

    res.json({ message: 'Budget goal deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
