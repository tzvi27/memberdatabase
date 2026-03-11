import { Router, Request, Response } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { parseAndPreview, confirmImport, ParsedMember } from '../services/banquest';
import { parseTransactionReport, confirmTransactionImport, ParsedTransaction } from '../services/transactionReport';
import { parseDonationDetailsXlsx, confirmDonationDetailsImport, ParsedDonationDetail } from '../services/donationDetails';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

type ImportType = 'banquest-members' | 'banquest-transactions' | 'donation-details' | 'unknown';

// Store preview data in memory between preview and confirm
let pendingData: {
  type: ImportType;
  members?: ParsedMember[];
  transactions?: ParsedTransaction[];
  donations?: ParsedDonationDetail[];
} | null = null;

function detectFileType(fileName: string, content: Buffer): ImportType {
  const name = fileName.toLowerCase();

  // XLSX files -> donation details
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return 'donation-details';
  }

  const text = content.toString('utf-8', 0, Math.min(content.length, 2000));
  const firstLine = text.split('\n')[0] || '';

  // CSV with Transaction Type,Status,Result -> fullreport (transaction report)
  if (firstLine.includes('Transaction Type') && firstLine.includes('Result') && firstLine.includes('Merchant Name')) {
    return 'banquest-transactions';
  }

  // TSV with Banquest member fields -> member import
  if (firstLine.includes('CustNum') || firstLine.includes('Enabled') || firstLine.includes('Schedule')) {
    return 'banquest-members';
  }

  // Check if tab-separated (Banquest export)
  if (firstLine.includes('\t') && (firstLine.includes('First Name') || firstLine.includes('Last Name'))) {
    return 'banquest-members';
  }

  return 'unknown';
}

async function detectFileTypeWithAI(fileName: string, content: Buffer): Promise<ImportType> {
  // Try rule-based detection first
  const detected = detectFileType(fileName, content);
  if (detected !== 'unknown') return detected;

  // Fall back to AI
  try {
    const anthropic = new Anthropic();
    const text = content.toString('utf-8', 0, Math.min(content.length, 3000));

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Classify this file. Reply with ONLY one of: banquest-members, banquest-transactions, donation-details, unknown.

File name: ${fileName}
First 2000 chars:
${text.slice(0, 2000)}`
      }],
    });

    const result = (response.content[0] as any).text?.trim().toLowerCase();
    if (['banquest-members', 'banquest-transactions', 'donation-details'].includes(result)) {
      return result as ImportType;
    }
  } catch (err) {
    console.error('AI detection failed, using unknown:', err);
  }

  return 'unknown';
}

// Unified upload and preview
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const fileType = await detectFileTypeWithAI(req.file.originalname, req.file.buffer);

    if (fileType === 'unknown') {
      res.status(400).json({
        message: 'Could not determine file type. Please upload a Banquest export (.txt/.tsv), transaction report (.csv), or donation details (.xlsx).',
      });
      return;
    }

    if (fileType === 'banquest-members') {
      const content = req.file.buffer.toString('utf-8');
      const members = await parseAndPreview(content);
      pendingData = { type: fileType, members };

      res.json({
        type: fileType,
        members,
        summary: {
          total: members.length,
          new: members.filter(m => m.isNew).length,
          existing: members.filter(m => !m.isNew).length,
          withIssues: members.filter(m => m.issues.length > 0).length,
          totalSubscriptions: members.reduce((s, m) => s + m.subscriptions.length, 0),
        },
      });
    } else if (fileType === 'banquest-transactions') {
      const content = req.file.buffer.toString('utf-8');
      const preview = await parseTransactionReport(content);
      pendingData = { type: fileType, transactions: preview.transactions };

      res.json({ type: fileType, ...preview });
    } else if (fileType === 'donation-details') {
      const preview = await parseDonationDetailsXlsx(req.file.buffer);
      pendingData = { type: fileType, donations: preview.donations };

      res.json({ type: fileType, ...preview });
    }
  } catch (err) {
    console.error('Error processing import file:', err);
    res.status(500).json({ message: 'Failed to process file' });
  }
});

// Unified confirm
router.post('/confirm', async (_req: Request, res: Response) => {
  try {
    if (!pendingData) {
      res.status(400).json({ message: 'No pending import. Upload a file first.' });
      return;
    }

    const { type } = pendingData;

    if (type === 'banquest-members' && pendingData.members) {
      const result = await confirmImport(pendingData.members);
      pendingData = null;
      res.json({ type, ...result });
    } else if (type === 'banquest-transactions' && pendingData.transactions) {
      const result = await confirmTransactionImport(pendingData.transactions);
      pendingData = null;
      res.json({ type, ...result });
    } else if (type === 'donation-details' && pendingData.donations) {
      const result = await confirmDonationDetailsImport(pendingData.donations);
      pendingData = null;
      res.json({ type, ...result });
    } else {
      res.status(400).json({ message: 'Invalid pending import state' });
    }
  } catch (err) {
    console.error('Error confirming import:', err);
    res.status(500).json({ message: 'Failed to import data' });
  }
});

export default router;
