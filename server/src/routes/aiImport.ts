import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../index';
import { extractDonationsFromFile } from '../services/aiDonationExtractor';
import { DonationSource } from '@prisma/client';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export interface AIPreviewDonation {
  firstName: string;
  lastName: string;
  amount: number;
  date: string;
  description: string | null;
  source: string;
  matchedMemberId: string | null;
  matchedMemberName: string | null;
  matchType: 'name' | 'none';
}

// POST /api/ai-import/upload — extract donations from any file via AI
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const extracted = await extractDonationsFromFile(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );

    const members = await prisma.member.findMany({
      select: { id: true, firstName: true, lastName: true },
    });

    const nameMap = new Map<string, typeof members[0]>();
    for (const m of members) {
      nameMap.set(`${m.firstName.toLowerCase()} ${m.lastName.toLowerCase()}`, m);
    }

    const donations: AIPreviewDonation[] = extracted.map(e => {
      const key = `${e.firstName.toLowerCase()} ${e.lastName.toLowerCase()}`.trim();
      const match = key ? nameMap.get(key) : undefined;
      return {
        firstName: e.firstName,
        lastName: e.lastName,
        amount: e.amount,
        date: e.date,
        description: e.description,
        source: e.source,
        matchedMemberId: match?.id || null,
        matchedMemberName: match ? `${match.firstName} ${match.lastName}` : null,
        matchType: match ? 'name' : 'none',
      };
    });

    res.json({
      donations,
      summary: {
        total: donations.length,
        matched: donations.filter(d => d.matchedMemberId).length,
        unmatched: donations.filter(d => !d.matchedMemberId).length,
        totalAmount: donations.reduce((s, d) => s + d.amount, 0),
      },
    });
  } catch (err: any) {
    console.error('AI import upload error:', err);
    res.status(500).json({ message: err.message || 'Failed to process file' });
  }
});

// POST /api/ai-import/confirm — create OneTimeDonation records
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { donations } = req.body as { donations: AIPreviewDonation[] };

    let imported = 0;
    let unmatched = 0;

    await prisma.$transaction(async tx => {
      for (const d of donations) {
        await tx.oneTimeDonation.create({
          data: {
            memberId: d.matchedMemberId || null,
            amount: d.amount,
            date: new Date(d.date),
            source: d.source as DonationSource,
            description: d.description || null,
            donorName: !d.matchedMemberId ? `${d.firstName} ${d.lastName}`.trim() || null : null,
          },
        });
        if (d.matchedMemberId) imported++; else unmatched++;
      }
    });

    res.json({ imported, unmatched, total: donations.length });
  } catch (err: any) {
    console.error('AI import confirm error:', err);
    res.status(500).json({ message: 'Failed to import donations' });
  }
});

export default router;
