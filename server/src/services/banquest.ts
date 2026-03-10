import { prisma } from '../index';

interface BanquestRow {
  custNum: string;
  company: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
  notes: string;
  enabled: boolean;
  schedule: string;
  numLeft: string;
  startDate: string;
  nextDueDate: string;
  failures: number;
  amount: number;
  description: string;
  cardLast4: string;
}

export interface ParsedMember {
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  notes: string | null;
  subscriptions: ParsedSubscription[];
  existingMemberId?: string;
  isNew: boolean;
  issues: string[];
}

export interface ParsedSubscription {
  banquestId: string;
  amount: number;
  frequency: 'MONTHLY' | 'ANNUAL';
  status: string;
  startDate: string;
  nextDueDate: string | null;
  description: string | null;
  numLeft: string | null;
  failures: number;
  cardLast4: string | null;
}

function titleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function cleanName(firstName: string, lastName: string, company: string): { first: string; last: string } {
  let first = firstName.trim();
  let last = lastName.trim();

  // If firstName contains a space and lastName is part of firstName, split properly
  if (first.includes(' ') && last) {
    const firstLower = first.toLowerCase();
    const lastLower = last.toLowerCase();
    if (firstLower.includes(lastLower) || lastLower.includes(firstLower)) {
      const parts = first.split(' ');
      first = parts[0];
      last = parts.slice(1).join(' ');
    }
  }

  // If lastName contains full name (e.g., "Meir Koval" in last name field)
  if (last.includes(' ') && first) {
    const parts = last.split(' ');
    const firstLower = first.toLowerCase();
    if (parts.some(p => p.toLowerCase() === firstLower)) {
      // First name is repeated in last name
      last = parts.filter(p => p.toLowerCase() !== firstLower).join(' ');
    }
  }

  // Fallback to company field if names are empty
  if (!first && !last && company) {
    const parts = company.trim().split(/\s+/);
    if (parts.length >= 2) {
      // Company is typically "LASTNAME FIRSTNAME"
      last = parts[0];
      first = parts.slice(1).join(' ');
    } else {
      last = parts[0];
    }
  }

  return {
    first: titleCase(first || 'Unknown'),
    last: titleCase(last || 'Unknown'),
  };
}

function parseTSV(content: string): BanquestRow[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map(h => h.trim());
  const col = (name: string) => headers.indexOf(name);

  return lines.slice(1).map(line => {
    const fields = line.split('\t');
    const get = (name: string) => fields[col(name)]?.trim() || '';

    const cardNumber = get('CardNumber');
    const cardLast4 = cardNumber && !cardNumber.startsWith('xxx')
      ? cardNumber.slice(-4)
      : cardNumber.replace(/x/g, '').trim();

    return {
      custNum: get('CustNum'),
      company: get('Company'),
      firstName: get('First Name'),
      lastName: get('Last Name'),
      address: get('Address'),
      city: get('City'),
      state: get('State'),
      zip: get('Zip'),
      country: get('Country'),
      phone: get('Phone'),
      email: get('Email'),
      notes: get('Notes'),
      enabled: get('Enabled') === '1',
      schedule: get('Schedule'),
      numLeft: get('Numleft'),
      startDate: get('Start'),
      nextDueDate: get('Due Next'),
      failures: parseInt(get('Failures')) || 0,
      amount: parseFloat(get('Amount')) || 0,
      description: get('Description'),
      cardLast4,
    };
  });
}

export async function parseAndPreview(fileContent: string): Promise<ParsedMember[]> {
  const rows = parseTSV(fileContent);

  // Group by email (or by custNum if no email)
  const grouped = new Map<string, BanquestRow[]>();
  for (const row of rows) {
    const key = row.email || `no-email-${row.custNum}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const members: ParsedMember[] = [];

  for (const [key, rowGroup] of grouped) {
    const first = rowGroup[0];
    const { first: firstName, last: lastName } = cleanName(first.firstName, first.lastName, first.company);
    const email = first.email || null;
    const issues: string[] = [];

    // Check if member already exists
    let existingMemberId: string | undefined;
    if (email) {
      const existing = await prisma.member.findUnique({ where: { email } });
      if (existing) {
        existingMemberId = existing.id;
      }
    }

    if (!email) {
      issues.push('No email address - cannot match to existing member');
    }

    if (first.firstName.includes(' ') || first.lastName.includes(' ')) {
      issues.push(`Name may need review: "${first.firstName}" "${first.lastName}"`);
    }

    const subscriptions: ParsedSubscription[] = rowGroup.map(row => ({
      banquestId: row.custNum,
      amount: row.amount,
      frequency: row.schedule.toLowerCase() === 'annually' ? 'ANNUAL' as const : 'MONTHLY' as const,
      status: row.enabled ? 'active' : 'inactive',
      startDate: row.startDate,
      nextDueDate: row.nextDueDate || null,
      description: titleCase(row.description) || null,
      numLeft: row.numLeft !== '*' ? row.numLeft : null,
      failures: row.failures,
      cardLast4: row.cardLast4 || null,
    }));

    if (subscriptions.some(s => s.failures > 0)) {
      issues.push('Has payment failures');
    }

    members.push({
      email,
      firstName,
      lastName,
      phone: first.phone || null,
      street: first.address || null,
      city: first.city || null,
      state: first.state || null,
      zip: first.zip || null,
      country: first.country || null,
      notes: first.notes || null,
      subscriptions,
      existingMemberId,
      isNew: !existingMemberId,
      issues,
    });
  }

  return members;
}

export async function confirmImport(members: ParsedMember[]): Promise<{ created: number; updated: number; subscriptions: number }> {
  let created = 0;
  let updated = 0;
  let subsCount = 0;

  for (const m of members) {
    let memberId: string;

    if (m.existingMemberId) {
      // Update existing member
      await prisma.member.update({
        where: { id: m.existingMemberId },
        data: {
          firstName: m.firstName,
          lastName: m.lastName,
          phone: m.phone,
          street: m.street,
          city: m.city,
          state: m.state,
          zip: m.zip,
          country: m.country,
        },
      });
      memberId = m.existingMemberId;
      updated++;
    } else {
      // Create new member
      const member = await prisma.member.create({
        data: {
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          phone: m.phone,
          street: m.street,
          city: m.city,
          state: m.state,
          zip: m.zip,
          country: m.country,
          notes: m.notes,
        },
      });
      memberId = member.id;
      created++;
    }

    // Upsert subscriptions by banquestId
    for (const sub of m.subscriptions) {
      await prisma.recurringDonation.upsert({
        where: { banquestId: sub.banquestId },
        create: {
          memberId,
          banquestId: sub.banquestId,
          amount: sub.amount,
          frequency: sub.frequency,
          status: sub.status,
          startDate: new Date(sub.startDate),
          nextDueDate: sub.nextDueDate ? new Date(sub.nextDueDate) : null,
          description: sub.description,
          numLeft: sub.numLeft,
          failures: sub.failures,
          cardLast4: sub.cardLast4,
        },
        update: {
          amount: sub.amount,
          frequency: sub.frequency,
          status: sub.status,
          nextDueDate: sub.nextDueDate ? new Date(sub.nextDueDate) : null,
          description: sub.description,
          numLeft: sub.numLeft,
          failures: sub.failures,
          cardLast4: sub.cardLast4,
        },
      });
      subsCount++;
    }
  }

  return { created, updated, subscriptions: subsCount };
}
