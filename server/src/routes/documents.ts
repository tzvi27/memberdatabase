import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../index';
import { generateInvoicePDF, generateDonationReceiptPDF, generateAnnualReceiptPDF } from '../services/pdf';

const router = Router();
const logoUpload = multer({ dest: path.join(__dirname, '../../uploads') });

// Generate invoice PDF from a bill
router.get('/:memberId/invoice/:billId', async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;
    const billId = req.params.billId as string;

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { lineItems: true },
    });

    if (!member || !bill || bill.memberId !== memberId) {
      res.status(404).json({ message: 'Member or bill not found' });
      return;
    }

    const doc = generateInvoicePDF({
      member,
      bill: {
        ...bill,
        totalAmount: Number(bill.totalAmount),
        lineItems: bill.lineItems.map(li => ({ ...li, amount: Number(li.amount) })),
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${billId.slice(0, 8)}.pdf"`);
    doc.pipe(res);
  } catch (err) {
    console.error('Error generating invoice:', err);
    res.status(500).json({ message: 'Failed to generate invoice' });
  }
});

// Generate donation receipt PDF
router.get('/:memberId/receipt/:donationId', async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;
    const donationId = req.params.donationId as string;

    const member = await prisma.member.findUnique({ where: { id: memberId } });

    // Try one-time donation first, then Zelle payment
    let donation = await prisma.oneTimeDonation.findUnique({ where: { id: donationId } });
    let source: string | undefined;
    let transactionNumber: string | null = null;

    if (donation && donation.memberId === memberId) {
      source = donation.source;
    } else {
      const zelle = await prisma.zellePayment.findUnique({ where: { id: donationId } });
      if (zelle && zelle.memberId === memberId) {
        donation = { ...zelle, source: 'ZELLE', description: null, notes: null } as any;
        source = 'Zelle';
        transactionNumber = zelle.transactionNumber;
      }
    }

    if (!member || !donation) {
      res.status(404).json({ message: 'Member or donation not found' });
      return;
    }

    const doc = generateDonationReceiptPDF({
      member,
      donation: {
        amount: Number(donation.amount),
        date: donation.date,
        source,
        transactionNumber,
        description: (donation as any).description,
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${donationId.slice(0, 8)}.pdf"`);
    doc.pipe(res);
  } catch (err) {
    console.error('Error generating receipt:', err);
    res.status(500).json({ message: 'Failed to generate receipt' });
  }
});

// Generate annual summary receipt PDF
router.get('/:memberId/annual-receipt', async (req: Request, res: Response) => {
  try {
    const memberId = req.params.memberId as string;
    const startDate = new Date(req.query.start as string);
    const endDate = new Date(req.query.end as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({ message: 'Valid start and end dates are required' });
      return;
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
      res.status(404).json({ message: 'Member not found' });
      return;
    }

    // Gather all donations in range
    const [oneTime, zelle, recurring] = await Promise.all([
      prisma.oneTimeDonation.findMany({
        where: { memberId, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
      }),
      prisma.zellePayment.findMany({
        where: { memberId, matched: true, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
      }),
      prisma.recurringDonation.findMany({
        where: { memberId, status: 'active' },
      }),
    ]);

    const donations = [
      ...oneTime.map(d => ({ date: d.date, amount: Number(d.amount), source: d.source as string, description: d.description })),
      ...zelle.map(z => ({ date: z.date, amount: Number(z.amount), source: 'Zelle' as string, description: `Zelle from ${z.senderName}` })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const grandTotal = donations.reduce((s, d) => s + Number(d.amount), 0);

    const doc = generateAnnualReceiptPDF({
      member,
      startDate,
      endDate,
      donations,
      grandTotal,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="annual-receipt-${member.lastName}-${startDate.getFullYear()}.pdf"`);
    doc.pipe(res);
  } catch (err) {
    console.error('Error generating annual receipt:', err);
    res.status(500).json({ message: 'Failed to generate annual receipt' });
  }
});

// Upload logo
router.post('/settings/logo', logoUpload.single('logo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    // Rename to logo.png
    const fs = await import('fs');
    const destPath = path.join(__dirname, '../../uploads/logo.png');
    fs.renameSync(req.file.path, destPath);

    await prisma.settings.upsert({
      where: { id: 'singleton' },
      create: { logoPath: destPath },
      update: { logoPath: destPath },
    });

    res.json({ message: 'Logo uploaded', path: destPath });
  } catch (err) {
    console.error('Error uploading logo:', err);
    res.status(500).json({ message: 'Failed to upload logo' });
  }
});

export default router;
