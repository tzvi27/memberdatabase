import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// List donations for a member
router.get('/:memberId/donations', async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;
    const donations = await prisma.oneTimeDonation.findMany({
      where: { memberId },
      orderBy: { date: 'desc' },
    });
    res.json(donations);
  } catch (err) {
    console.error('Error listing donations:', err);
    res.status(500).json({ message: 'Failed to list donations' });
  }
});

// Add a one-time donation
router.post('/:memberId/donations', async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;
    const { amount, date, source, description, notes } = req.body;

    if (!amount || !date || !source) {
      res.status(400).json({ message: 'Amount, date, and source are required' });
      return;
    }

    const donation = await prisma.oneTimeDonation.create({
      data: {
        memberId,
        amount: Number(amount),
        date: new Date(date),
        source,
        description: description || null,
        notes: notes || null,
      },
    });

    res.status(201).json(donation);
  } catch (err) {
    console.error('Error creating donation:', err);
    res.status(500).json({ message: 'Failed to create donation' });
  }
});

// Delete a one-time donation
router.delete('/donations/:id', async (req: Request, res: Response) => {
  try {
    await prisma.oneTimeDonation.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Donation deleted' });
  } catch (err) {
    console.error('Error deleting donation:', err);
    res.status(500).json({ message: 'Failed to delete donation' });
  }
});

export default router;
