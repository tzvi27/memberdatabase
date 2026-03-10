import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parseAndPreview, confirmImport, ParsedMember } from '../services/banquest';
import { parseTransactionReport, confirmTransactionImport, ParsedTransaction } from '../services/transactionReport';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Store preview data in memory between preview and confirm
let pendingImport: ParsedMember[] | null = null;

// Upload and preview
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const content = req.file.buffer.toString('utf-8');
    const members = await parseAndPreview(content);
    pendingImport = members;

    res.json({
      members,
      summary: {
        total: members.length,
        new: members.filter(m => m.isNew).length,
        existing: members.filter(m => !m.isNew).length,
        withIssues: members.filter(m => m.issues.length > 0).length,
        totalSubscriptions: members.reduce((s, m) => s + m.subscriptions.length, 0),
      },
    });
  } catch (err) {
    console.error('Error parsing Banquest file:', err);
    res.status(500).json({ message: 'Failed to parse file' });
  }
});

// Confirm import
router.post('/confirm', async (_req: Request, res: Response) => {
  try {
    if (!pendingImport) {
      res.status(400).json({ message: 'No pending import. Upload a file first.' });
      return;
    }

    const result = await confirmImport(pendingImport);
    pendingImport = null;

    res.json(result);
  } catch (err) {
    console.error('Error confirming import:', err);
    res.status(500).json({ message: 'Failed to import data' });
  }
});

// --- Transaction Report Import ---

let pendingTransactions: ParsedTransaction[] | null = null;

// Upload and preview transaction report CSV
router.post('/transactions/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const content = req.file.buffer.toString('utf-8');
    const preview = await parseTransactionReport(content);
    pendingTransactions = preview.transactions;

    res.json(preview);
  } catch (err) {
    console.error('Error parsing transaction report:', err);
    res.status(500).json({ message: 'Failed to parse transaction report' });
  }
});

// Confirm transaction report import (only matched transactions are imported)
router.post('/transactions/confirm', async (_req: Request, res: Response) => {
  try {
    if (!pendingTransactions) {
      res.status(400).json({ message: 'No pending transaction import. Upload a file first.' });
      return;
    }

    const result = await confirmTransactionImport(pendingTransactions);
    pendingTransactions = null;

    res.json(result);
  } catch (err) {
    console.error('Error confirming transaction import:', err);
    res.status(500).json({ message: 'Failed to import transactions' });
  }
});

export default router;
