import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { logAudit } from '../services/auditLog';

const router = Router();

// List all unmatched donations (OneTimeDonation with no memberId/donorId + unmatched ZellePayments)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [unmatchedDonations, unmatchedZelle] = await Promise.all([
      prisma.oneTimeDonation.findMany({
        where: { memberId: null, donorId: null },
        orderBy: { date: 'desc' },
      }),
      prisma.zellePayment.findMany({
        where: { matched: false },
        orderBy: { date: 'desc' },
      }),
    ]);

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

// Attach an unmatched donation to a member or donor
router.put('/:id/match', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { memberId, donorId, type, saveRule } = req.body;

    if (!memberId && !donorId) {
      res.status(400).json({ message: 'memberId or donorId is required' });
      return;
    }

    let donorName = '';

    if (type === 'zelle') {
      const zelle = await prisma.zellePayment.findUnique({ where: { id } });
      donorName = zelle?.senderName || '';
      await prisma.zellePayment.update({
        where: { id },
        data: {
          memberId: memberId || null,
          donorId: donorId || null,
          matched: true,
          manuallyMatched: true,
        },
      });
    } else {
      const donation = await prisma.oneTimeDonation.findUnique({ where: { id } });
      donorName = donation?.donorName || '';
      await prisma.oneTimeDonation.update({
        where: { id },
        data: {
          memberId: memberId || null,
          donorId: donorId || null,
          manuallyMatched: true,
        },
      });
    }

    // Log the manual match
    await logAudit({
      entityType: type === 'zelle' ? 'zelle' : 'donation',
      entityId: id,
      action: 'manual_match',
      field: 'memberId',
      newValue: memberId || donorId,
      details: `Manually matched "${donorName}" to ${memberId ? 'member' : 'donor'} ${memberId || donorId}`,
    });

    // Save as permanent match rule if requested (or by default)
    if (saveRule !== false && donorName) {
      await prisma.matchRule.upsert({
        where: { donorName },
        create: {
          donorName,
          memberId: memberId || null,
          donorId: donorId || null,
        },
        update: {
          memberId: memberId || null,
          donorId: donorId || null,
        },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error matching donation:', err);
    res.status(500).json({ message: 'Failed to match donation' });
  }
});

// Check for other records with same donor name (for bulk match suggestion)
router.get('/:id/similar', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const type = req.query.type as string;

    let donorName = '';
    if (type === 'zelle') {
      const zelle = await prisma.zellePayment.findUnique({ where: { id } });
      donorName = zelle?.senderName || '';
    } else {
      const donation = await prisma.oneTimeDonation.findUnique({ where: { id } });
      donorName = donation?.donorName || '';
    }

    if (!donorName) {
      res.json({ similar: [], count: 0 });
      return;
    }

    // Find other unmatched records with the same name
    const [similarDonations, similarZelle] = await Promise.all([
      prisma.oneTimeDonation.findMany({
        where: {
          memberId: null, donorId: null,
          donorName: { equals: donorName, mode: 'insensitive' },
          id: { not: type === 'donation' ? id : undefined },
        },
      }),
      prisma.zellePayment.findMany({
        where: {
          matched: false,
          senderName: { equals: donorName, mode: 'insensitive' },
          id: { not: type === 'zelle' ? id : undefined },
        },
      }),
    ]);

    const similar = [
      ...similarDonations.map(d => ({ id: d.id, type: 'donation' as const, amount: Number(d.amount), date: d.date.toISOString() })),
      ...similarZelle.map(z => ({ id: z.id, type: 'zelle' as const, amount: Number(z.amount), date: z.date.toISOString() })),
    ];

    res.json({ similar, count: similar.length, donorName });
  } catch (err) {
    console.error('Error finding similar:', err);
    res.status(500).json({ message: 'Failed to find similar records' });
  }
});

// Bulk match: apply same match to multiple records
router.post('/bulk-match', async (req: Request, res: Response) => {
  try {
    const { items, memberId, donorId } = req.body;
    // items: [{ id, type }]

    if (!items?.length || (!memberId && !donorId)) {
      res.status(400).json({ message: 'items and memberId/donorId are required' });
      return;
    }

    let matched = 0;
    for (const item of items) {
      if (item.type === 'zelle') {
        await prisma.zellePayment.update({
          where: { id: item.id },
          data: { memberId: memberId || null, donorId: donorId || null, matched: true, manuallyMatched: true },
        });
      } else {
        await prisma.oneTimeDonation.update({
          where: { id: item.id },
          data: { memberId: memberId || null, donorId: donorId || null, manuallyMatched: true },
        });
      }
      matched++;
    }

    res.json({ matched });
  } catch (err) {
    console.error('Error bulk matching:', err);
    res.status(500).json({ message: 'Failed to bulk match' });
  }
});

// Rerun matching: attempt to match all unmatched records against current members/donors
router.post('/rerun-matching', async (_req: Request, res: Response) => {
  try {
    // Load all match rules
    const rules = await prisma.matchRule.findMany();
    const ruleMap = new Map(rules.map(r => [r.donorName.toLowerCase(), r]));

    // Load all members and donors for name matching
    const allMembers = await prisma.member.findMany({
      select: { id: true, firstName: true, lastName: true, wifeName: true },
    });
    const allDonors = await prisma.donor.findMany({
      select: { id: true, firstName: true, lastName: true, wifeName: true },
    });

    const memberNameMap = new Map<string, string>();
    const memberWifeMap = new Map<string, string>();
    for (const m of allMembers) {
      memberNameMap.set(`${m.firstName.toLowerCase()} ${m.lastName.toLowerCase()}`, m.id);
      if (m.wifeName) memberWifeMap.set(m.wifeName.toLowerCase(), m.id);
    }
    const donorNameMap = new Map<string, string>();
    const donorWifeMap = new Map<string, string>();
    for (const d of allDonors) {
      donorNameMap.set(`${d.firstName.toLowerCase()} ${d.lastName.toLowerCase()}`, d.id);
      if (d.wifeName) donorWifeMap.set(d.wifeName.toLowerCase(), d.id);
    }

    function findMatch(name: string): { memberId?: string; donorId?: string } | null {
      const lower = name.toLowerCase().trim();

      // 1. Check saved match rules first
      const rule = ruleMap.get(lower);
      if (rule) return { memberId: rule.memberId || undefined, donorId: rule.donorId || undefined };

      // 2. Check exact member name
      const parts = lower.split(/\s+/);
      if (parts.length >= 2) {
        const first = parts[0];
        const last = parts[parts.length - 1];
        const key = `${first} ${last}`;
        const memberId = memberNameMap.get(key);
        if (memberId) return { memberId };
        const donorId = donorNameMap.get(key);
        if (donorId) return { donorId };
      }

      // 3. Check wife names
      const mWife = memberWifeMap.get(lower);
      if (mWife) return { memberId: mWife };
      const dWife = donorWifeMap.get(lower);
      if (dWife) return { donorId: dWife };

      return null;
    }

    // Process unmatched donations
    const unmatchedDonations = await prisma.oneTimeDonation.findMany({
      where: { memberId: null, donorId: null, manuallyMatched: false },
    });
    const unmatchedZelle = await prisma.zellePayment.findMany({
      where: { matched: false, manuallyMatched: false },
    });

    let newMatches = 0;

    for (const d of unmatchedDonations) {
      if (!d.donorName) continue;
      const match = findMatch(d.donorName);
      if (match) {
        await prisma.oneTimeDonation.update({
          where: { id: d.id },
          data: { memberId: match.memberId || null, donorId: match.donorId || null },
        });
        newMatches++;
      }
    }

    for (const z of unmatchedZelle) {
      const match = findMatch(z.senderName);
      if (match) {
        await prisma.zellePayment.update({
          where: { id: z.id },
          data: { memberId: match.memberId || null, donorId: match.donorId || null, matched: true },
        });
        newMatches++;
      }
    }

    res.json({
      processed: unmatchedDonations.length + unmatchedZelle.length,
      newMatches,
    });
  } catch (err) {
    console.error('Error rerunning matching:', err);
    res.status(500).json({ message: 'Failed to rerun matching' });
  }
});

export default router;
