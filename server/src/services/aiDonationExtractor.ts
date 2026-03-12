import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';

export interface ExtractedDonation {
  firstName: string;
  lastName: string;
  amount: number;
  date: string;
  description: string | null;
  source: string;
}

const SYSTEM_PROMPT = `You are a financial data extraction assistant. Extract all donation/payment transactions from the provided document.

For each transaction return a JSON object with:
- firstName: donor's first name (string)
- lastName: donor's last name (string)
- amount: the dollar amount as a number, no currency symbols (number)
- date: the date in YYYY-MM-DD format (string)
- description: any memo, note, or description (string or null)
- source: the payment method — one of: CREDIT_CARD, ZELLE, CASH, CHECK, OJC, DONORS_FUND, OTHER

OJC refers to Orthodox Jewish Chamber (ojcfund.org) or similar organization payments.
DONORS_FUND refers to Donors Fund / National Philanthropic Trust type payments.

Return ONLY a valid JSON array. No markdown, no explanation, just the raw JSON array. If no transactions found, return [].`;

export async function extractDonationsFromFile(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): Promise<ExtractedDonation[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let userContent: Anthropic.MessageParam['content'];
  const lowerName = originalname.toLowerCase();

  if (
    mimetype.includes('spreadsheet') ||
    mimetype.includes('excel') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls')
  ) {
    const workbook = XLSX.read(buffer);
    const parts: string[] = [];
    for (const name of workbook.SheetNames) {
      parts.push(`Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`);
    }
    userContent = `Extract all donation transactions from this spreadsheet:\n\n${parts.join('\n\n')}`;
  } else if (mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
    const base64 = buffer.toString('base64');
    userContent = [
      {
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
      },
      { type: 'text' as const, text: 'Extract all donation transactions. Return a JSON array.' },
    ];
  } else if (mimetype.startsWith('image/')) {
    const base64 = buffer.toString('base64');
    const mediaType = mimetype as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    userContent = [
      {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: mediaType, data: base64 },
      },
      { type: 'text' as const, text: 'Extract all donation transactions. Return a JSON array.' },
    ];
  } else {
    // Text / CSV / other
    const text = buffer.toString('utf-8');
    userContent = `Extract all donation transactions from this content:\n\n${text}`;
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const textBlock = response.content.find(c => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') return [];

  const raw = textBlock.text.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  const parsed = JSON.parse(raw) as any[];

  return parsed
    .map(item => ({
      firstName: String(item.firstName || '').trim(),
      lastName: String(item.lastName || '').trim(),
      amount: Number(item.amount) || 0,
      date: String(item.date || new Date().toISOString().split('T')[0]),
      description: item.description ? String(item.description).trim() : null,
      source: validateSource(String(item.source || 'OTHER')),
    }))
    .filter(d => d.amount > 0 && (d.firstName || d.lastName));
}

function validateSource(s: string): string {
  const valid = ['CREDIT_CARD', 'ZELLE', 'CASH', 'CHECK', 'OJC', 'DONORS_FUND', 'OTHER'];
  const upper = s.toUpperCase();
  return valid.includes(upper) ? upper : 'OTHER';
}
