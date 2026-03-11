import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// List all unmatched donations (OneTimeDonation with no memberId + unmatched ZellePayments)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [unmatchedDonations, unmatchedZelle] = await Promise.all([
      prisma.oneTimeDonation.findMany({
        where: { memberId: null },
        orderBy: { date: 'desc' },
      }),
      prisma.zellePayment.findMany({
        where: { matched: false },
        orderBy: { date: 'desc' },
      }),
    ]);

    // Normalize into a single list
    const items = [
      ...unmatchedDonations.map(d => ({
        id: d.id,
        type: 'donation' as const,
        date: d.date.toISOString(),
        amount: Number(d.amount),
        source: d.source,
        donorName: d.donorName || 'Unknown',
        description: d.description,
        externalId: d.externalId,
      })),
      ...unmatchedZelle.map(z => ({
        id: z.id,
        type: 'zelle' as const,
        date: z.date.toISOString(),
        amount: Number(z.amount),
        source: 'ZELLE' as const,
        donorName: z.senderName,
        description: null as string | null,
        externalId: z.transactionNumber,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ items, total: items.length });
  } catch (err) {
    console.error('Error listing unmatched donations:', err);
    res.status(500).json({ message: 'Failed to list unmatched donations' });
  }
});

// Attach an unmatched donation to a member
router.put('/:id/match', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { memberId, type } = req.body;

    if (!memberId) {
      res.status(400).json({ message: 'memberId is required' });
      return;
    }

    if (type === 'zelle') {
      await prisma.zellePayment.update({
        where: { id },
        data: { memberId, matched: true },
      });
    } else {
      await prisma.oneTimeDonation.update({
        where: { id },
        data: { memberId, donorName: null },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error matching donation:', err);
    res.status(500).json({ message: 'Failed to match donation' });
  }
});

export default router;
