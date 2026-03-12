import * as XLSX from 'xlsx';
import { prisma } from '../index';

export interface ParsedDonationDetail {
  source: 'ZELLE' | 'DONORS_FUND';
  date: string;
  donorName: string;
  amount: number;
  memo: string | null;
  externalId: string;
  matchedMemberId: string | null;
  matchedMemberName: string | null;
  matchType: 'email' | 'name' | 'none';
  isDuplicate: boolean;
}

export interface DonationDetailsPreview {
  donations: ParsedDonationDetail[];
  summary: {
    total: number;
    matched: number;
    unmatched: number;
    duplicates: number;
    totalAmount: number;
    bySource: { zelle: number; donorsFund: number };
  };
}

function titleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function cleanDonorName(name: string): string {
  if (!name) return '';
  // If ALL CAPS, title case it
  if (name === name.toUpperCase() && name.length > 2) {
    return titleCase(name);
  }
  return name.trim();
}

function splitName(fullName: string): { first: string; last: string } {
  const cleaned = cleanDonorName(fullName);
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: 'Unknown', last: 'Unknown' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  // Handle middle initials: "Aaron David Greisman" -> first="Aaron David", last="Greisman"
  // Handle "Yoni & Hindy Schecter" -> first="Yoni", last="Schecter"
  const ampIdx = parts.indexOf('&');
  if (ampIdx >= 0) {
    // Use part before & as first name, last part as last name
    return { first: parts[0], last: parts[parts.length - 1] };
  }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

export async function parseDonationDetailsXlsx(buffer: Buffer): Promise<DonationDetailsPreview> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Use All_Transactions tab if available, otherwise combine individual tabs
  const allTxSheet = workbook.Sheets['All_Transactions'];

  let rows: any[];
  if (allTxSheet) {
    rows = XLSX.utils.sheet_to_json(allTxSheet);
  } else {
    rows = [];
    // Parse Chase_Zelle tab
    const zelleSheet = workbook.Sheets['Chase_Zelle'];
    if (zelleSheet) {
      const zelleRows = XLSX.utils.sheet_to_json(zelleSheet) as any[];
      for (const r of zelleRows) {
        rows.push({
          Source: 'Chase',
          Type: 'Zelle (incoming)',
          'Transaction Date': r['Transaction Date'],
          Name: r['Sender Name'],
          Amount: r['Amount'],
          'Transaction/Confirmation #': r['Transaction Number'],
          'Purpose/Memo': r['Memo'],
        });
      }
    }
    // Parse DonorsFund_Grants tab
    const dfSheet = workbook.Sheets['DonorsFund_Grants'];
    if (dfSheet) {
      const dfRows = XLSX.utils.sheet_to_json(dfSheet) as any[];
      for (const r of dfRows) {
        rows.push({
          Source: 'The Donors Fund',
          Type: 'Grant received',
          'Transaction Date': r['Grant Received Date'],
          Name: r['Donor Name'],
          Amount: r['Donation Amount'],
          'Transaction/Confirmation #': r['Confirmation Number'],
          'Purpose/Memo': r['Purpose'],
        });
      }
    }
  }

  // Load members for matching
  const allMembers = await prisma.member.findMany({
    select: { id: true, firstName: true, lastName: true, email: true, wifeName: true },
  });
  const nameMap = new Map<string, typeof allMembers[0]>();
  const wifeNameMap = new Map<string, typeof allMembers[0]>();
  for (const m of allMembers) {
    nameMap.set(`${m.firstName.toLowerCase()} ${m.lastName.toLowerCase()}`, m);
    if (m.wifeName) {
      wifeNameMap.set(m.wifeName.toLowerCase(), m);
    }
  }

  // Check existing externalIds
  const externalIds = rows
    .map(r => String(r['Transaction/Confirmation #'] || '').trim())
    .filter(Boolean);
  const existingDonations = externalIds.length > 0
    ? await prisma.oneTimeDonation.findMany({
        where: { externalId: { in: externalIds } },
        select: { externalId: true },
      })
    : [];
  // Also check ZellePayment transaction numbers
  const existingZelle = externalIds.length > 0
    ? await prisma.zellePayment.findMany({
        where: { transactionNumber: { in: externalIds } },
        select: { transactionNumber: true },
      })
    : [];
  const existingIdSet = new Set([
    ...existingDonations.map(d => d.externalId),
    ...existingZelle.map(z => z.transactionNumber),
  ]);

  const donations: ParsedDonationDetail[] = [];

  for (const row of rows) {
    const sourceRaw = String(row['Source'] || '').toLowerCase();
    const isZelle = sourceRaw.includes('chase') || String(row['Type'] || '').toLowerCase().includes('zelle');
    const source: 'ZELLE' | 'DONORS_FUND' = isZelle ? 'ZELLE' : 'DONORS_FUND';

    const donorName = cleanDonorName(String(row['Name'] || ''));
    const amount = Number(row['Amount']) || 0;
    if (amount <= 0) continue;

    const externalId = String(row['Transaction/Confirmation #'] || '').trim();
    if (!externalId) continue;

    // Parse date - could be Excel serial or date string
    let date: Date;
    const rawDate = row['Transaction Date'];
    if (rawDate instanceof Date) {
      date = rawDate;
    } else if (typeof rawDate === 'number') {
      // Excel serial date
      date = new Date((rawDate - 25569) * 86400 * 1000);
    } else {
      date = new Date(rawDate);
    }
    if (isNaN(date.getTime())) {
      console.warn(`Skipping row with unparseable date: "${rawDate}" for donor "${donorName}"`);
      continue;
    }

    const memo = String(row['Purpose/Memo'] || '').trim() || null;
    const isDuplicate = existingIdSet.has(externalId);

    // Try to match to member
    const { first, last } = splitName(donorName);
    let matchedMemberId: string | null = null;
    let matchedMemberName: string | null = null;
    let matchType: 'email' | 'name' | 'none' = 'none';

    // Try exact first+last match
    const nameKey = `${first.toLowerCase()} ${last.toLowerCase()}`;
    const nameMatch = nameMap.get(nameKey);
    if (nameMatch) {
      matchedMemberId = nameMatch.id;
      matchedMemberName = `${nameMatch.firstName} ${nameMatch.lastName}`;
      matchType = 'name';
    }

    // Try wife name match
    if (!matchedMemberId) {
      const wifeMatch = wifeNameMap.get(donorName.toLowerCase().trim());
      if (wifeMatch) {
        matchedMemberId = wifeMatch.id;
        matchedMemberName = `${wifeMatch.firstName} ${wifeMatch.lastName}`;
        matchType = 'name';
      }
    }

    donations.push({
      source,
      date: date.toISOString(),
      donorName,
      amount,
      memo,
      externalId,
      matchedMemberId,
      matchedMemberName,
      matchType,
      isDuplicate,
    });
  }

  return {
    donations,
    summary: {
      total: donations.length,
      matched: donations.filter(d => d.matchedMemberId && !d.isDuplicate).length,
      unmatched: donations.filter(d => !d.matchedMemberId && !d.isDuplicate).length,
      duplicates: donations.filter(d => d.isDuplicate).length,
      totalAmount: donations.filter(d => !d.isDuplicate).reduce((s, d) => s + d.amount, 0),
      bySource: {
        zelle: donations.filter(d => d.source === 'ZELLE' && !d.isDuplicate).length,
        donorsFund: donations.filter(d => d.source === 'DONORS_FUND' && !d.isDuplicate).length,
      },
    },
  };
}

export async function confirmDonationDetailsImport(
  donations: ParsedDonationDetail[]
): Promise<{ imported: number; unmatched: number; skippedDuplicates: number; totalAmount: number }> {
  let imported = 0;
  let unmatched = 0;
  let skippedDuplicates = 0;
  let totalAmount = 0;

  for (const d of donations) {
    if (d.isDuplicate) {
      skippedDuplicates++;
      continue;
    }

    await prisma.oneTimeDonation.create({
      data: {
        memberId: d.matchedMemberId || null,
        amount: d.amount,
        date: new Date(d.date),
        source: d.source,
        description: d.memo,
        donorName: !d.matchedMemberId ? d.donorName : null,
        externalId: d.externalId,
      },
    });

    if (d.matchedMemberId) {
      imported++;
    } else {
      unmatched++;
    }
    totalAmount += d.amount;
  }

  return { imported, unmatched, skippedDuplicates, totalAmount };
}
