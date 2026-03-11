import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// List donors with search and pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '50' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { firstName: { contains: String(search), mode: 'insensitive' } },
        { lastName: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [donors, total] = await Promise.all([
      prisma.donor.findMany({
        where,
        include: {
          oneTimeDonations: { orderBy: { date: 'desc' }, take: 5 },
          zellePayments: { orderBy: { date: 'desc' }, take: 5 },
        },
        orderBy: { lastName: 'asc' },
        skip,
        take: Number(limit),
      }),
      prisma.donor.count({ where }),
    ]);

    res.json({ donors, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Error listing donors:', err);
    res.status(500).json({ message: 'Failed to list donors' });
  }
});

// Get single donor with all related data
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const donor = await prisma.donor.findUnique({
      where: { id: req.params.id as string },
      include: {
        oneTimeDonations: { orderBy: { date: 'desc' } },
        zellePayments: { orderBy: { date: 'desc' } },
      },
    });
    if (!donor) {
      res.status(404).json({ message: 'Donor not found' });
      return;
    }
    res.json(donor);
  } catch (err) {
    console.error('Error getting donor:', err);
    res.status(500).json({ message: 'Failed to get donor' });
  }
});

// Create donor
router.post('/', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, street, city, state, zip, country, notes, wifeName } = req.body;
    if (!firstName || !lastName) {
      res.status(400).json({ message: 'First name and last name are required' });
      return;
    }
    const donor = await prisma.donor.create({
      data: {
        firstName, lastName,
        email: email || null,
        phone, street, city, state, zip, country, notes, wifeName,
      },
    });
    res.status(201).json(donor);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(400).json({ message: 'A donor with this email already exists' });
      return;
    }
    console.error('Error creating donor:', err);
    res.status(500).json({ message: 'Failed to create donor' });
  }
});

// Update donor
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, street, city, state, zip, country, notes, wifeName, status } = req.body;
    const donor = await prisma.donor.update({
      where: { id: req.params.id as string },
      data: {
        firstName, lastName,
        email: email || null,
        phone, street, city, state, zip, country, notes, wifeName,
        status,
      },
    });
    res.json(donor);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(400).json({ message: 'A donor with this email already exists' });
      return;
    }
    console.error('Error updating donor:', err);
    res.status(500).json({ message: 'Failed to update donor' });
  }
});

// Delete donor
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.donor.update({
      where: { id: req.params.id as string },
      data: { status: 'INACTIVE' },
    });
    res.json({ message: 'Donor deactivated' });
  } catch (err) {
    console.error('Error deactivating donor:', err);
    res.status(500).json({ message: 'Failed to deactivate donor' });
  }
});

export default router;
