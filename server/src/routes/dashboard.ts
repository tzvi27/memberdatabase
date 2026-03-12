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
      unmatchedDonations,
      unmatchedZelle,
    ] = await Promise.all([
      prisma.member.count({ where: { status: 'ACTIVE' } }),
      prisma.recurringDonation.findMany({ where: { status: 'active' } }),
      prisma.recurringDonation.count({ where: { failures: { gt: 0 } } }),
      prisma.bill.aggregate({
        where: { status: { not: 'PAID' } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.oneTimeDonation.count({ where: { memberId: null, donorId: null } }),
      prisma.zellePayment.count({ where: { matched: false } }),
    ]);

    // Split recurring by category
    const membershipRecurring = recurringDonations
      .filter(d => d.category === 'MEMBERSHIP_RECURRING')
      .reduce((sum, d) => sum + (d.frequency === 'ANNUAL' ? Number(d.amount) / 12 : Number(d.amount)), 0);

    const otherRecurring = recurringDonations
      .filter(d => d.category !== 'MEMBERSHIP_RECURRING')
      .reduce((sum, d) => sum + (d.frequency === 'ANNUAL' ? Number(d.amount) / 12 : Number(d.amount)), 0);

    const monthlyRevenue = membershipRecurring + otherRecurring;

    // Current month one-time donations
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [monthlyOneTime, monthlyZelle, monthlyMiscOneTime, monthlyMiscZelle] = await Promise.all([
      prisma.oneTimeDonation.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.zellePayment.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.oneTimeDonation.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd }, memberId: null, donorId: null },
        _sum: { amount: true },
      }),
      prisma.zellePayment.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd }, matched: false },
        _sum: { amount: true },
      }),
    ]);

    const monthlyOtherDonations = Number(monthlyOneTime._sum.amount || 0) + Number(monthlyZelle._sum.amount || 0);
    const monthlyMiscDonations = Number(monthlyMiscOneTime._sum.amount || 0) + Number(monthlyMiscZelle._sum.amount || 0);

    res.json({
      activeMembers,
      monthlyRecurringRevenue: Math.round(monthlyRevenue * 100) / 100,
      membershipRecurring: Math.round(membershipRecurring * 100) / 100,
      otherRecurring: Math.round(otherRecurring * 100) / 100,
      monthlyOtherDonations: Math.round(monthlyOtherDonations * 100) / 100,
      monthlyMiscDonations: Math.round(monthlyMiscDonations * 100) / 100,
      needsAttention: failedCount,
      unmatchedCount: unmatchedDonations + unmatchedZelle,
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

// Stats endpoint with period filtering
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { period = 'this-month', start, end } = req.query;

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (period) {
      case 'last-month':
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'this-year':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      case 'custom':
        periodStart = start ? new Date(String(start)) : new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = end ? new Date(String(end) + 'T23:59:59') : now;
        break;
      default: // this-month
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const [recurringDonations, oneTimeDonations, zellePayments, miscOneTime, miscZelle] = await Promise.all([
      prisma.recurringDonation.findMany({ where: { status: 'active' } }),
      prisma.oneTimeDonation.findMany({
        where: { date: { gte: periodStart, lte: periodEnd } },
      }),
      prisma.zellePayment.findMany({
        where: { date: { gte: periodStart, lte: periodEnd } },
      }),
      prisma.oneTimeDonation.findMany({
        where: { date: { gte: periodStart, lte: periodEnd }, memberId: null, donorId: null },
      }),
      prisma.zellePayment.findMany({
        where: { date: { gte: periodStart, lte: periodEnd }, matched: false },
      }),
    ]);

    // Calculate months in period for recurring normalization
    const monthsInPeriod = Math.max(1,
      (periodEnd.getFullYear() - periodStart.getFullYear()) * 12 +
      (periodEnd.getMonth() - periodStart.getMonth()) + 1
    );

    const membershipRecurring = recurringDonations
      .filter(d => d.category === 'MEMBERSHIP_RECURRING')
      .reduce((sum, d) => sum + (d.frequency === 'ANNUAL' ? Number(d.amount) / 12 : Number(d.amount)), 0) * monthsInPeriod;

    const otherRecurring = recurringDonations
      .filter(d => d.category !== 'MEMBERSHIP_RECURRING')
      .reduce((sum, d) => sum + (d.frequency === 'ANNUAL' ? Number(d.amount) / 12 : Number(d.amount)), 0) * monthsInPeriod;

    const oneTimeTotal = oneTimeDonations.reduce((sum, d) => sum + Number(d.amount), 0) +
      zellePayments.reduce((sum, z) => sum + Number(z.amount), 0);

    const miscTotal = miscOneTime.reduce((sum, d) => sum + Number(d.amount), 0) +
      miscZelle.reduce((sum, z) => sum + Number(z.amount), 0);

    const total = membershipRecurring + otherRecurring + oneTimeTotal + miscTotal;

    res.json({
      period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
      membershipRecurring: Math.round(membershipRecurring * 100) / 100,
      otherRecurring: Math.round(otherRecurring * 100) / 100,
      oneTimeDonations: Math.round(oneTimeTotal * 100) / 100,
      miscDonations: Math.round(miscTotal * 100) / 100,
      total: Math.round(total * 100) / 100,
      donationCount: oneTimeDonations.length + zellePayments.length + miscOneTime.length + miscZelle.length,
      breakdown: [
        { category: 'MEMBERSHIP_RECURRING', amount: Math.round(membershipRecurring * 100) / 100 },
        { category: 'OTHER_RECURRING', amount: Math.round(otherRecurring * 100) / 100 },
        { category: 'ONE_TIME_DONATION', amount: Math.round(oneTimeTotal * 100) / 100 },
        { category: 'MISC_UNMATCHED', amount: Math.round(miscTotal * 100) / 100 },
      ],
    });
  } catch (err) {
    console.error('Error loading stats:', err);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

export default router;
