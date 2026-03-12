import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { logAudit } from '../services/auditLog';

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

    // Compute status dynamically from recurring donations (unless manually overridden)
    const membersWithStatus = members.map(m => {
      if (m.statusManuallySet) return m;
      const donations = m.recurringDonations;
      const allInactive = donations.length > 0 && donations.every(d => d.status === 'inactive' || d.failures > 0);
      return { ...m, status: allInactive ? 'INACTIVE' : 'ACTIVE' };
    });

    res.json({ members: membersWithStatus, total, page: Number(page), limit: Number(limit) });
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
    const member = await prisma.member.findUnique({
      where: { id },
      include: { recurringDonations: { select: { banquestId: true } } },
    });
    if (!member) {
      res.status(404).json({ message: 'Member not found' });
      return;
    }

    // Log deletion so future imports skip this member
    const auditEntries: Array<{ entityType: string; entityId: string; action: string; field: string; oldValue: string }> = [];
    if (member.email) {
      auditEntries.push({
        entityType: 'member', entityId: id, action: 'delete',
        field: 'email', oldValue: member.email,
      });
    }
    // Also log name for name-based matching
    auditEntries.push({
      entityType: 'member', entityId: id, action: 'delete',
      field: 'name', oldValue: `${member.firstName}|${member.lastName}`,
    });
    for (const rd of member.recurringDonations) {
      if (rd.banquestId) {
        auditEntries.push({
          entityType: 'member', entityId: id, action: 'delete',
          field: 'banquestId', oldValue: rd.banquestId,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (auditEntries.length > 0) {
        await tx.auditLog.createMany({ data: auditEntries });
      }
      await tx.member.delete({ where: { id } });
    });

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
      prisma.member.findUnique({
        where: { id: secondaryId },
        include: { recurringDonations: { select: { banquestId: true } } },
      }),
    ]);

    if (!primary || !secondary) {
      res.status(404).json({ message: 'One or both members not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Log merge so future imports redirect secondary's data to primary
      const auditEntries: Array<{ entityType: string; entityId: string; action: string; field: string; oldValue: string; newValue: string }> = [];
      if (secondary.email) {
        auditEntries.push({
          entityType: 'member', entityId: secondaryId, action: 'merge',
          field: 'email', oldValue: secondary.email, newValue: primaryId,
        });
      }
      // Log name for name-based matching
      auditEntries.push({
        entityType: 'member', entityId: secondaryId, action: 'merge',
        field: 'name', oldValue: `${secondary.firstName}|${secondary.lastName}`, newValue: primaryId,
      });
      for (const rd of secondary.recurringDonations) {
        if (rd.banquestId) {
          auditEntries.push({
            entityType: 'member', entityId: secondaryId, action: 'merge',
            field: 'banquestId', oldValue: rd.banquestId, newValue: primaryId,
          });
        }
      }
      if (auditEntries.length > 0) {
        await tx.auditLog.createMany({ data: auditEntries });
      }

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
        if (!primary[field] && (secondary as any)[field]) {
          updateData[field] = (secondary as any)[field];
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

// Update a recurring donation (description)
router.patch('/recurring-donations/:donationId', async (req: Request, res: Response) => {
  try {
    const donationId = req.params.donationId as string;
    const { description } = req.body;
    const updated = await prisma.recurringDonation.update({
      where: { id: donationId },
      data: { description: description || null },
    });
    res.json(updated);
  } catch (err) {
    console.error('Error updating recurring donation:', err);
    res.status(500).json({ message: 'Failed to update recurring donation' });
  }
});

// Clear payment failures on a recurring donation (unmark needs-attention)
router.patch('/recurring-donations/:donationId/clear-failures', async (req: Request, res: Response) => {
  try {
    const donationId = req.params.donationId as string;
    const updated = await prisma.recurringDonation.update({
      where: { id: donationId },
      data: { failures: 0 },
    });
    res.json(updated);
  } catch (err) {
    console.error('Error clearing failures:', err);
    res.status(500).json({ message: 'Failed to clear failures' });
  }
});

// Toggle member status (Active/Inactive) - manual override
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      res.status(400).json({ message: 'Status must be ACTIVE or INACTIVE' });
      return;
    }

    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) {
      res.status(404).json({ message: 'Member not found' });
      return;
    }

    const oldStatus = member.status;
    const updated = await prisma.member.update({
      where: { id },
      data: { status, statusManuallySet: true, manuallyEdited: true },
    });

    await logAudit({
      entityType: 'member',
      entityId: id,
      action: 'status_change',
      field: 'status',
      oldValue: oldStatus,
      newValue: status,
      details: 'Manual status toggle',
    });

    res.json(updated);
  } catch (err) {
    console.error('Error toggling status:', err);
    res.status(500).json({ message: 'Failed to toggle status' });
  }
});

// Toggle membership status (Member/Non-member)
router.patch('/:id/membership', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { membershipStatus } = req.body;

    if (!['MEMBER', 'NON_MEMBER'].includes(membershipStatus)) {
      res.status(400).json({ message: 'Must be MEMBER or NON_MEMBER' });
      return;
    }

    const updated = await prisma.member.update({
      where: { id },
      data: { membershipStatus },
    });

    await logAudit({
      entityType: 'member',
      entityId: id,
      action: 'field_edit',
      field: 'membershipStatus',
      newValue: membershipStatus,
    });

    res.json(updated);
  } catch (err) {
    console.error('Error updating membership:', err);
    res.status(500).json({ message: 'Failed to update membership status' });
  }
});

// Get audit log for a member
router.get('/:id/audit-log', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const logs = await prisma.auditLog.findMany({
      where: { entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(logs);
  } catch (err) {
    console.error('Error fetching audit log:', err);
    res.status(500).json({ message: 'Failed to fetch audit log' });
  }
});

export default router;
