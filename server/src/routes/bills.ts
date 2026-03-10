import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// List bills for a member
router.get('/:memberId/bills', async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;
    const bills = await prisma.bill.findMany({
      where: { memberId },
      include: { lineItems: true },
      orderBy: { date: 'desc' },
    });
    res.json(bills);
  } catch (err) {
    console.error('Error listing bills:', err);
    res.status(500).json({ message: 'Failed to list bills' });
  }
});

// Create a bill with line items
router.post('/:memberId/bills', async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;
    const { lineItems, date, notes } = req.body;

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      res.status(400).json({ message: 'At least one line item is required' });
      return;
    }

    const totalAmount = lineItems.reduce((sum: number, item: { amount: number }) => sum + Number(item.amount), 0);

    const bill = await prisma.bill.create({
      data: {
        memberId,
        totalAmount,
        date: new Date(date || Date.now()),
        notes: notes || null,
        lineItems: {
          create: lineItems.map((item: { itemName: string; amount: number }) => ({
            itemName: item.itemName,
            amount: Number(item.amount),
          })),
        },
      },
      include: { lineItems: true },
    });

    res.status(201).json(bill);
  } catch (err) {
    console.error('Error creating bill:', err);
    res.status(500).json({ message: 'Failed to create bill' });
  }
});

// Update bill status
router.put('/bills/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!['PAID', 'UNPAID', 'PARTIAL'].includes(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }

    const bill = await prisma.bill.update({
      where: { id },
      data: { status },
      include: { lineItems: true },
    });

    res.json(bill);
  } catch (err) {
    console.error('Error updating bill:', err);
    res.status(500).json({ message: 'Failed to update bill' });
  }
});

export default router;
