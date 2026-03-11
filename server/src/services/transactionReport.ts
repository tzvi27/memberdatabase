import { prisma } from '../index';

interface TransactionRow {
  date: Date;
  description: string;
  amount: number;
  cardHolder: string;
  cardLast4: string;
  firstName: string;
  lastName: string;
  email: string | null;
  transactionId: string | null;
}

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  cardHolder: string;
  cardLast4: string;
  firstName: string;
  lastName: string;
  email: string | null;
  transactionId: string | null;
  matchedMemberId: string | null;
  matchedMemberName: string | null;
  matchType: 'email' | 'name' | 'none';
  isDuplicate: boolean;
}

export interface TransactionImportPreview {
  transactions: ParsedTransaction[];
  summary: {
    total: number;
    matched: number;
    unmatched: number;
    duplicates: number;
    totalAmount: number;
  };
}

function parseCSV(content: string): TransactionRow[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  function splitCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else if (ch !== '\r') {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const rows: TransactionRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = splitCSVLine(lines[i]);
    if (fields.length < 13) continue;

    const [_txType, _status, _result, dateStr, _merchant, description, amountStr,
      _currency, cardHolder, cardNumber, billingFirst, billingLast, email, transactionId] = fields;

    // Parse date: "MM/DD/YY HH:MM:SS"
    const dateParts = dateStr?.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!dateParts) continue;

    const [, month, day, year, hour, min, sec] = dateParts;
    const fullYear = 2000 + parseInt(year);
    const date = new Date(fullYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec));

    const amount = parseFloat(amountStr) || 0;
    if (amount <= 0) continue;

    const cardLast4 = cardNumber?.replace(/x/gi, '').trim() || '';

    rows.push({
      date,
      description: description || '',
      amount,
      cardHolder: cardHolder?.trim() || '',
      cardLast4,
      firstName: billingFirst?.trim() || '',
      lastName: billingLast?.trim() || '',
      email: email?.trim() || null,
      transactionId: transactionId?.trim() || null,
    });
  }

  return rows;
}

function titleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function cleanTransactionName(firstName: string, lastName: string): { first: string; last: string } {
  let first = firstName.trim();
  let last = lastName.trim();

  if (first.includes(' ') && last) {
    const parts = first.split(' ');
    const lastLower = last.toLowerCase();
    if (parts.some(p => p.toLowerCase() === lastLower)) {
      first = parts.filter(p => p.toLowerCase() !== lastLower).join(' ');
    }
  }

  if (last.includes(' ') && first) {
    const parts = last.split(' ');
    const firstLower = first.toLowerCase();
    if (parts.some(p => p.toLowerCase() === firstLower)) {
      last = parts.filter(p => p.toLowerCase() !== firstLower).join(' ');
    }
  }

  if (first === first.toUpperCase() && last === last.toUpperCase() && first.length > 1 && last.length > 1) {
    const temp = first;
    first = last;
    last = temp;
  }

  return {
    first: titleCase(first || 'Unknown'),
    last: titleCase(last || 'Unknown'),
  };
}

export async function parseTransactionReport(content: string): Promise<TransactionImportPreview> {
  const rows = parseCSV(content);

  const allMembers = await prisma.member.findMany({
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const emailMap = new Map<string, typeof allMembers[0]>();
  const nameMap = new Map<string, typeof allMembers[0]>();
  for (const m of allMembers) {
    if (m.email) emailMap.set(m.email.toLowerCase(), m);
    nameMap.set(`${m.firstName.toLowerCase()} ${m.lastName.toLowerCase()}`, m);
  }

  // Check which externalIds already exist
  const externalIds = rows.map(r => r.transactionId).filter(Boolean) as string[];
  const existingDonations = externalIds.length > 0
    ? await prisma.oneTimeDonation.findMany({
        where: { externalId: { in: externalIds } },
        select: { externalId: true },
      })
    : [];
  const existingIdSet = new Set(existingDonations.map(d => d.externalId));

  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const { first, last } = cleanTransactionName(row.firstName, row.lastName);
    let matchedMemberId: string | null = null;
    let matchedMemberName: string | null = null;
    let matchType: 'email' | 'name' | 'none' = 'none';

    // Check if already imported
    const isDuplicate = row.transactionId ? existingIdSet.has(row.transactionId) : false;

    if (row.email) {
      const emailMatch = emailMap.get(row.email.toLowerCase());
      if (emailMatch) {
        matchedMemberId = emailMatch.id;
        matchedMemberName = `${emailMatch.firstName} ${emailMatch.lastName}`;
        matchType = 'email';
      }
    }

    if (!matchedMemberId) {
      const nameKey = `${first.toLowerCase()} ${last.toLowerCase()}`;
      const nameMatch = nameMap.get(nameKey);
      if (nameMatch) {
        matchedMemberId = nameMatch.id;
        matchedMemberName = `${nameMatch.firstName} ${nameMatch.lastName}`;
        matchType = 'name';
      }
    }

    transactions.push({
      date: row.date.toISOString(),
      description: row.description,
      amount: row.amount,
      cardHolder: row.cardHolder,
      cardLast4: row.cardLast4,
      firstName: first,
      lastName: last,
      email: row.email,
      transactionId: row.transactionId,
      matchedMemberId,
      matchedMemberName,
      matchType,
      isDuplicate,
    });
  }

  return {
    transactions,
    summary: {
      total: transactions.length,
      matched: transactions.filter(t => t.matchedMemberId && !t.isDuplicate).length,
      unmatched: transactions.filter(t => !t.matchedMemberId && !t.isDuplicate).length,
      duplicates: transactions.filter(t => t.isDuplicate).length,
      totalAmount: transactions.filter(t => !t.isDuplicate).reduce((s, t) => s + t.amount, 0),
    },
  };
}

export async function confirmTransactionImport(
  transactions: ParsedTransaction[]
): Promise<{ imported: number; unmatched: number; skippedDuplicates: number; totalAmount: number }> {
  let imported = 0;
  let unmatched = 0;
  let skippedDuplicates = 0;
  let totalAmount = 0;

  for (const tx of transactions) {
    if (tx.isDuplicate) {
      skippedDuplicates++;
      continue;
    }

    await prisma.oneTimeDonation.create({
      data: {
        memberId: tx.matchedMemberId || null,
        amount: tx.amount,
        date: new Date(tx.date),
        source: 'CREDIT_CARD',
        description: tx.description || null,
        notes: tx.cardLast4 ? `Card ending ${tx.cardLast4}` : null,
        donorName: !tx.matchedMemberId ? `${tx.firstName} ${tx.lastName}`.trim() : null,
        externalId: tx.transactionId || null,
      },
    });

    if (tx.matchedMemberId) {
      imported++;
    } else {
      unmatched++;
    }
    totalAmount += tx.amount;
  }

  return { imported, unmatched, skippedDuplicates, totalAmount };
}
