import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// List members with search and pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '50', filter } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: String(search), mode: 'insensitive' } },
        { lastName: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    if (filter === 'needs-attention') {
      where.recurringDonations = { some: { failures: { gt: 0 } } };
    }

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        include: {
          recurringDonations: true,
        },
        orderBy: { lastName: 'asc' },
        skip,
        take: Number(limit),
      }),
      prisma.member.count({ where }),
    ]);

    res.json({ members, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Error listing members:', err);
    res.status(500).json({ message: 'Failed to list members' });
  }
});

// Get single member with all related data
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        recurringDonations: { orderBy: { createdAt: 'desc' } },
        oneTimeDonations: { orderBy: { date: 'desc' } },
        bills: {
          include: { lineItems: true },
          orderBy: { date: 'desc' },
        },
        zellePayments: { orderBy: { date: 'desc' } },
      },
    });

    if (!member) {
      res.status(404).json({ message: 'Member not found' });
      return;
    }

    res.json(member);
  } catch (err) {
    console.error('Error getting member:', err);
    res.status(500).json({ message: 'Failed to get member' });
  }
});

// Create member
router.post('/', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, street, city, state, zip, country, notes, status, aliyahName, wifeName, seatNumber } = req.body;

    if (!firstName || !lastName) {
      res.status(400).json({ message: 'First name and last name are required' });
      return;
    }

    const member = await prisma.member.create({
      data: {
        firstName, lastName,
        email: email || null,
        phone, street, city, state, zip, country, notes,
        status: status || 'ACTIVE',
        aliyahName, wifeName,
        seatNumber: seatNumber ? Number(seatNumber) : null,
      },
    });

    res.status(201).json(member);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(400).json({ message: 'A member with this email already exists' });
      return;
    }
    console.error('Error creating member:', err);
    res.status(500).json({ message: 'Failed to create member' });
  }
});

// Update member
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { firstName, lastName, email, phone, street, city, state, zip, country, notes, status, aliyahName, wifeName, seatNumber } = req.body;

    const member = await prisma.member.update({
      where: { id },
      data: {
        firstName, lastName,
        email: email || null,
        phone, street, city, state, zip, country, notes,
        status,
        aliyahName, wifeName,
        seatNumber: seatNumber !== undefined ? (seatNumber ? Number(seatNumber) : null) : undefined,
      },
    });

    res.json(member);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(400).json({ message: 'A member with this email already exists' });
      return;
    }
    console.error('Error updating member:', err);
    res.status(500).json({ message: 'Failed to update member' });
  }
});

// Soft delete (set inactive)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.member.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    res.json({ message: 'Member deactivated' });
  } catch (err) {
    console.error('Error deactivating member:', err);
    res.status(500).json({ message: 'Failed to deactivate member' });
  }
});

// Hard delete member and all related data
router.delete('/:id/permanent', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) {
      res.status(404).json({ message: 'Member not found' });
      return;
    }
    await prisma.member.delete({ where: { id } });
    res.json({ message: 'Member permanently deleted' });
  } catch (err) {
    console.error('Error deleting member:', err);
    res.status(500).json({ message: 'Failed to delete member' });
  }
});

// Merge two members: absorb secondaryId into primaryId
router.post('/:primaryId/merge/:secondaryId', async (req: Request, res: Response) => {
  try {
    const primaryId = req.params.primaryId as string;
    const secondaryId = req.params.secondaryId as string;

    if (primaryId === secondaryId) {
      res.status(400).json({ message: 'Cannot merge a member with themselves' });
      return;
    }

    const [primary, secondary] = await Promise.all([
      prisma.member.findUnique({ where: { id: primaryId } }),
      prisma.member.findUnique({ where: { id: secondaryId } }),
    ]);

    if (!primary || !secondary) {
      res.status(404).json({ message: 'One or both members not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Reassign all transactions from secondary to primary
      await tx.recurringDonation.updateMany({
        where: { memberId: secondaryId },
        data: { memberId: primaryId },
      });
      await tx.oneTimeDonation.updateMany({
        where: { memberId: secondaryId },
        data: { memberId: primaryId },
      });
      await tx.bill.updateMany({
        where: { memberId: secondaryId },
        data: { memberId: primaryId },
      });
      await tx.zellePayment.updateMany({
        where: { memberId: secondaryId },
        data: { memberId: primaryId },
      });

      // Collect backfill data before deleting secondary
      const fillableFields = [
        'email', 'phone', 'street', 'city', 'state', 'zip',
        'country', 'notes', 'aliyahName', 'wifeName', 'seatNumber',
      ] as const;

      const updateData: Record<string, any> = {};
      for (const field of fillableFields) {
        if (!primary[field] && secondary[field]) {
          updateData[field] = secondary[field];
        }
      }

      // Delete secondary first to avoid unique constraint violations (e.g. email)
      await tx.member.delete({ where: { id: secondaryId } });

      // Then backfill null fields on primary from secondary
      if (Object.keys(updateData).length > 0) {
        await tx.member.update({
          where: { id: primaryId },
          data: updateData,
        });
      }
    });

    // Return updated primary with all relations
    const merged = await prisma.member.findUnique({
      where: { id: primaryId },
      include: {
        recurringDonations: { orderBy: { createdAt: 'desc' } },
        oneTimeDonations: { orderBy: { date: 'desc' } },
        bills: { include: { lineItems: true }, orderBy: { date: 'desc' } },
        zellePayments: { orderBy: { date: 'desc' } },
      },
    });

    res.json(merged);
  } catch (err: any) {
    console.error('Error merging members:', err);
    const message = err?.code === 'P2002'
      ? `Merge failed: duplicate value on ${err.meta?.target || 'unique field'}`
      : 'Failed to merge members';
    res.status(500).json({ message });
  }
});

export default router;
