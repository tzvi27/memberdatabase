import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [
      activeMembers,
      recurringDonations,
      failedCount,
      unpaidBills,
    ] = await Promise.all([
      prisma.member.count({ where: { status: 'ACTIVE' } }),
      prisma.recurringDonation.findMany({ where: { status: 'active' } }),
      prisma.recurringDonation.count({ where: { failures: { gt: 0 } } }),
      prisma.bill.aggregate({
        where: { status: { not: 'PAID' } },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    // Calculate monthly recurring revenue
    const monthlyRevenue = recurringDonations.reduce((sum, d) => {
      const amount = Number(d.amount);
      return sum + (d.frequency === 'ANNUAL' ? amount / 12 : amount);
    }, 0);

    res.json({
      activeMembers,
      monthlyRecurringRevenue: Math.round(monthlyRevenue * 100) / 100,
      needsAttention: failedCount,
      outstandingBills: {
        count: unpaidBills._count,
        total: Number(unpaidBills._sum.totalAmount || 0),
      },
    });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.status(500).json({ message: 'Failed to load dashboard' });
  }
});

export default router;
