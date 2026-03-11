import { prisma } from '../index';
import Anthropic from '@anthropic-ai/sdk';

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

async function aiFixNames(members: Array<{ firstName: string; lastName: string; email: string | null }>): Promise<Array<{ firstName: string; lastName: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('No ANTHROPIC_API_KEY set, skipping AI name fixing');
    return members.map(m => ({ firstName: m.firstName, lastName: m.lastName }));
  }

  const client = new Anthropic({ apiKey });

  const nameList = members.map((m, i) =>
    `${i}: first="${m.firstName}" last="${m.lastName}" email="${m.email || ''}"`
  ).join('\n');

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are fixing names imported from a payment system. The names often have issues:
- First and last names swapped
- Names in ALL CAPS that need proper casing
- Hebrew/transliterated names with odd casing
- Company names in person name fields
- Duplicate name parts (first name repeated in last name field)
- Names extracted from company field in "LASTNAME FIRSTNAME" format

For each entry, return the corrected firstName and lastName. Keep the same order.
Return ONLY a JSON array like: [{"firstName":"John","lastName":"Smith"},...]

Here are the names to fix:
${nameList}`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('AI name fix: could not parse response, using original names');
      return members.map(m => ({ firstName: m.firstName, lastName: m.lastName }));
    }

    const fixed = JSON.parse(jsonMatch[0]) as Array<{ firstName: string; lastName: string }>;
    if (fixed.length !== members.length) {
      console.warn('AI name fix: response length mismatch, using original names');
      return members.map(m => ({ firstName: m.firstName, lastName: m.lastName }));
    }

    return fixed;
  } catch (err) {
    console.error('AI name fix failed, using original names:', err);
    return members.map(m => ({ firstName: m.firstName, lastName: m.lastName }));
  }
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

  // AI-powered name fixing
  const nameInputs = members.map(m => ({
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email,
  }));
  const fixedNames = await aiFixNames(nameInputs);
  for (let i = 0; i < members.length; i++) {
    const original = `${members[i].firstName} ${members[i].lastName}`;
    const fixed = `${fixedNames[i].firstName} ${fixedNames[i].lastName}`;
    if (original !== fixed) {
      members[i].issues.push(`AI fixed name: "${original}" → "${fixed}"`);
    }
    members[i].firstName = fixedNames[i].firstName;
    members[i].lastName = fixedNames[i].lastName;
  }

  return members;
}

export async function confirmImport(members: ParsedMember[]): Promise<{ created: number; updated: number; subscriptions: number }> {
  let created = 0;
  let updated = 0;
  let subsCount = 0;

  for (const m of members) {
    let memberId: string;

    // Determine member status: INACTIVE if all subscriptions are disabled or all have payment failures
    const allInactive = m.subscriptions.length > 0 && m.subscriptions.every(s => s.status === 'inactive' || s.failures > 0);
    const memberStatus = allInactive ? 'INACTIVE' : 'ACTIVE';

    if (m.existingMemberId) {
      // Update existing member - respect manually edited fields
      const existing = await prisma.member.findUnique({ where: { id: m.existingMemberId } });
      const updateData: Record<string, any> = {
        firstName: m.firstName,
        lastName: m.lastName,
        phone: m.phone,
        street: m.street,
        city: m.city,
        state: m.state,
        zip: m.zip,
        country: m.country,
        status: memberStatus,
      };

      if (existing?.manuallyEdited) {
        // Check which fields were manually edited and skip them
        const editedFields = await prisma.auditLog.findMany({
          where: { entityType: 'member', entityId: m.existingMemberId, action: 'field_edit' },
          select: { field: true },
        });
        const editedSet = new Set(editedFields.map(e => e.field).filter(Boolean));
        for (const field of editedSet) {
          if (field && field in updateData) delete updateData[field];
        }
      }

      // Respect manually set status
      if (existing?.statusManuallySet) {
        delete updateData.status;
      }

      await prisma.member.update({
        where: { id: m.existingMemberId },
        data: updateData,
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
          status: memberStatus,
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
