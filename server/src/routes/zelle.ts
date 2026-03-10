import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../index';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload and parse Zelle email/text
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const content = req.file
      ? req.file.buffer.toString('utf-8')
      : req.body.text;

    if (!content) {
      res.status(400).json({ message: 'No file or text provided' });
      return;
    }

    // Parse Zelle data - try to extract payments from the text
    const payments = parseZelleText(content);

    if (payments.length === 0) {
      res.status(400).json({ message: 'No Zelle payments found in the provided content' });
      return;
    }

    // Try to match each payment to a member
    const results = [];
    for (const payment of payments) {
      // Try exact name match first
      const matchedMembers = await prisma.member.findMany({
        where: {
          OR: [
            {
              AND: [
                { firstName: { contains: payment.senderFirstName, mode: 'insensitive' } },
                { lastName: { contains: payment.senderLastName, mode: 'insensitive' } },
              ],
            },
            { wifeName: { contains: payment.senderName, mode: 'insensitive' } },
          ],
        },
      });

      const matched = matchedMembers.length === 1;
      const memberId = matched ? matchedMembers[0].id : null;

      // Check for duplicate transaction number
      if (payment.transactionNumber) {
        const existing = await prisma.zellePayment.findUnique({
          where: { transactionNumber: payment.transactionNumber },
        });
        if (existing) {
          results.push({ ...payment, status: 'duplicate', existingId: existing.id });
          continue;
        }
      }

      const created = await prisma.zellePayment.create({
        data: {
          memberId,
          amount: payment.amount,
          date: new Date(payment.date),
          senderName: payment.senderName,
          transactionNumber: payment.transactionNumber || null,
          matched,
          rawData: payment.rawText,
        },
      });

      results.push({
        ...payment,
        id: created.id,
        matched,
        memberId,
        memberName: matched ? `${matchedMembers[0].firstName} ${matchedMembers[0].lastName}` : null,
        candidates: !matched ? matchedMembers.map(m => ({ id: m.id, name: `${m.firstName} ${m.lastName}` })) : [],
      });
    }

    res.json({ payments: results });
  } catch (err) {
    console.error('Error processing Zelle upload:', err);
    res.status(500).json({ message: 'Failed to process Zelle data' });
  }
});

// Get unmatched Zelle payments
router.get('/pending', async (_req: Request, res: Response) => {
  try {
    const payments = await prisma.zellePayment.findMany({
      where: { matched: false },
      orderBy: { date: 'desc' },
    });
    res.json(payments);
  } catch (err) {
    console.error('Error listing pending Zelle:', err);
    res.status(500).json({ message: 'Failed to list pending payments' });
  }
});

// Manually match a Zelle payment to a member
router.put('/:id/match', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { memberId } = req.body;

    if (!memberId) {
      res.status(400).json({ message: 'memberId is required' });
      return;
    }

    const payment = await prisma.zellePayment.update({
      where: { id },
      data: { memberId, matched: true },
    });

    res.json(payment);
  } catch (err) {
    console.error('Error matching Zelle payment:', err);
    res.status(500).json({ message: 'Failed to match payment' });
  }
});

interface ParsedZellePayment {
  senderName: string;
  senderFirstName: string;
  senderLastName: string;
  amount: number;
  date: string;
  transactionNumber: string | null;
  rawText: string;
}

function parseZelleText(text: string): ParsedZellePayment[] {
  const payments: ParsedZellePayment[] = [];

  // Try to find patterns for Zelle payment confirmations
  // Pattern: amount, sender name, date, transaction number
  const amountRegex = /\$?([\d,]+\.?\d*)/g;
  const dateRegex = /(\w{3}\s*\/?\s*\d{1,2}\s*\/?\s*\d{2,4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/g;
  const txnRegex = /(?:transaction\s*(?:number|#|id)?[:\s]*)([\d]+)/gi;

  // Split by common delimiters for batch processing
  const sections = text.split(/(?:---+|={3,}|\n{3,})/);

  for (const section of sections) {
    if (!section.trim()) continue;

    const amounts = [...section.matchAll(amountRegex)].map(m => parseFloat(m[1].replace(',', '')));
    const dates = [...section.matchAll(dateRegex)].map(m => m[1]);
    const txns = [...section.matchAll(txnRegex)].map(m => m[1]);

    // Try to extract name - look for common patterns
    const namePatterns = [
      /(?:from|sender|billing\s*name)[:\s]*([A-Za-z]+\s+[A-Za-z]+)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+sent|\s+paid)/i,
    ];

    let senderName = '';
    for (const pattern of namePatterns) {
      const match = section.match(pattern);
      if (match) { senderName = match[1].trim(); break; }
    }

    if (amounts.length > 0 && (senderName || dates.length > 0)) {
      const amount = amounts.find(a => a > 0) || amounts[0];
      const nameParts = senderName.split(/\s+/);

      payments.push({
        senderName: senderName || 'Unknown',
        senderFirstName: nameParts[0] || '',
        senderLastName: nameParts.slice(1).join(' ') || '',
        amount,
        date: dates[0] || new Date().toISOString().split('T')[0],
        transactionNumber: txns[0] || null,
        rawText: section.trim(),
      });
    }
  }

  // If no structured data found, try line-by-line for simple formats
  if (payments.length === 0) {
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const amountMatch = line.match(/\$?([\d,]+\.?\d*)/);
      if (amountMatch && parseFloat(amountMatch[1].replace(',', '')) > 0) {
        const amount = parseFloat(amountMatch[1].replace(',', ''));
        const nameMatch = line.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
        const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/);

        if (nameMatch) {
          const nameParts = nameMatch[1].split(/\s+/);
          payments.push({
            senderName: nameMatch[1],
            senderFirstName: nameParts[0],
            senderLastName: nameParts.slice(1).join(' '),
            amount,
            date: dateMatch?.[1] || new Date().toISOString().split('T')[0],
            transactionNumber: null,
            rawText: line.trim(),
          });
        }
      }
    }
  }

  return payments;
}

export default router;
