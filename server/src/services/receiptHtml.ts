import fs from 'fs';
import path from 'path';

const SHUL_NAME = 'Khal Nachlas Yakov';
const SHUL_TAX_ID = '82-5289705';

function getLogoBase64(): string | null {
  const logoPath = path.join(__dirname, '../../uploads/logo.png');
  if (!fs.existsSync(logoPath)) return null;
  const data = fs.readFileSync(logoPath);
  if (data.length === 0) return null;
  const ext = path.extname(logoPath).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${data.toString('base64')}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPaymentMethod(source: string): string {
  switch (source) {
    case 'ZELLE': return 'Zelle';
    case 'CREDIT_CARD': return 'Credit Card';
    case 'CASH': return 'Cash';
    case 'CHECK': return 'Check';
    case 'DONORS_FUND': return 'Donors Fund';
    default: return source || 'Other';
  }
}

const STYLES = `
    :root {
      --page-width: 8.5in;
      --page-height: 11in;
      --margin-x: 0.6in;
      --margin-top: 0.5in;
      --margin-bottom: 0.75in;
      --border: #222;
      --soft: #e9e9e9;
      --text: #111;
      --muted: #555;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: #f4f4f4;
      font-family: Arial, Helvetica, sans-serif;
      color: var(--text);
    }
    .receipt-page {
      width: var(--page-width);
      min-height: var(--page-height);
      margin: 0 auto 24px auto;
      background: #fff;
      position: relative;
      box-shadow: 0 2px 16px rgba(0,0,0,.08);
      page-break-after: always;
      overflow: hidden;
    }
    .page-inner {
      padding: var(--margin-top) var(--margin-x) var(--margin-bottom) var(--margin-x);
    }
    .header {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 18px;
      align-items: center;
      border-bottom: 2px solid var(--border);
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header.no-logo {
      grid-template-columns: 1fr;
    }
    .logo-box {
      width: 300px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      overflow: hidden;
    }
    .logo-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: left center;
    }
    .org-block h1 {
      margin: 0 0 6px 0;
      font-size: 30px;
      letter-spacing: 0.3px;
    }
    .org-block .subtitle {
      font-size: 14px;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .org-block .meta {
      font-size: 13px;
      line-height: 1.45;
    }
    .title-bar {
      border: 2px solid var(--border);
      text-align: center;
      font-weight: 700;
      font-size: 22px;
      padding: 10px 12px;
      margin-bottom: 16px;
      letter-spacing: 0.4px;
    }
    .summary-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      table-layout: fixed;
    }
    .summary-grid td,
    .summary-grid th {
      border: 1.5px solid var(--border);
      padding: 10px 12px;
      vertical-align: middle;
    }
    .summary-grid th {
      background: var(--soft);
      font-size: 13px;
      width: 22%;
      text-align: left;
    }
    .summary-grid td.value {
      font-size: 16px;
      font-weight: 700;
    }
    .section-label {
      display: inline-block;
      background: var(--soft);
      border: 1.5px solid var(--border);
      border-bottom: none;
      padding: 8px 12px;
      font-weight: 700;
      font-size: 13px;
      min-width: 180px;
    }
    .section-box {
      border: 1.5px solid var(--border);
      margin-bottom: 16px;
    }
    .section-box.single-value {
      padding: 16px 14px;
      min-height: 56px;
      font-size: 17px;
    }
    .payment-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .payment-table td,
    .payment-table th {
      border: 1.5px solid var(--border);
      padding: 12px 12px;
      vertical-align: top;
    }
    .payment-table th {
      width: 26%;
      background: var(--soft);
      text-align: left;
      font-size: 13px;
    }
    .payment-method {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .details-list {
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 14px;
      line-height: 1.5;
    }
    .details-list li {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 10px;
      padding: 2px 0;
    }
    .details-list .label { font-weight: 700; }
    .acknowledgment {
      border: 1.5px solid var(--border);
      padding: 14px;
      font-size: 13px;
      line-height: 1.55;
      margin-bottom: 22px;
    }
    .donations-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .donations-table th, .donations-table td {
      border: 1.5px solid var(--border);
      padding: 10px 12px;
      text-align: left;
      font-size: 13px;
    }
    .donations-table th {
      background: var(--soft);
      font-weight: 700;
    }
    .donations-table td.amount {
      text-align: right;
      font-weight: 600;
    }
    .donations-table .total-row td {
      font-weight: 700;
      font-size: 15px;
      border-top: 2.5px solid var(--border);
    }
    .footer {
      position: absolute;
      left: var(--margin-x);
      right: var(--margin-x);
      bottom: 0.35in;
      border-top: 2px solid var(--border);
      padding-top: 10px;
      font-size: 12px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }
    .footer strong { color: var(--text); }
    .right { text-align: right; }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt-page { box-shadow: none; margin: 0; width: 100%; min-height: 100vh; }
      .no-print { display: none !important; }
    }
`;

function headerHtml(logo: string | null): string {
  if (logo) {
    return `
      <header class="header">
        <div class="logo-box">
          <img src="${logo}" alt="${escapeHtml(SHUL_NAME)} logo" />
        </div>
        <div class="org-block">
          <h1>${escapeHtml(SHUL_NAME)}</h1>
          <div class="subtitle">Official Tax-Deductible Donation Receipt</div>
          <div class="meta">
            <div>${escapeHtml(SHUL_NAME)} is a tax-exempt charity under IRS Code Section 501(c)(3)</div>
            <div>Tax ID# ${SHUL_TAX_ID}</div>
          </div>
        </div>
      </header>`;
  }
  return `
      <header class="header no-logo">
        <div class="org-block">
          <h1>${escapeHtml(SHUL_NAME)}</h1>
          <div class="subtitle">Official Tax-Deductible Donation Receipt</div>
          <div class="meta">
            <div>${escapeHtml(SHUL_NAME)} is a tax-exempt charity under IRS Code Section 501(c)(3)</div>
            <div>Tax ID# ${SHUL_TAX_ID}</div>
          </div>
        </div>
      </header>`;
}

function footerHtml(): string {
  return `
    <footer class="footer">
      <div>
        <strong>${escapeHtml(SHUL_NAME)}</strong><br />
        No goods or services were provided in return for the contribution.
      </div>
      <div class="right">
        Official tax receipt<br />Thank you for your donation
      </div>
    </footer>`;
}

function wrapPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="no-print" style="text-align:center;padding:12px;background:#333;color:#fff;font-size:14px;">
    Press <strong>Ctrl+P</strong> (or <strong>Cmd+P</strong> on Mac) to print or save as PDF.
  </div>
  ${body}
  <script>window.addEventListener('afterprint', function() { window.close(); }); window.print();</script>
</body>
</html>`;
}

// --- Per-donation receipt ---

export interface DonationReceiptData {
  receiptNumber: number;
  memberName: string;
  donation: {
    amount: number;
    date: Date;
    source: string;
    transactionNumber?: string | null;
    cardLast4?: string | null;
    description?: string | null;
    memo?: string | null;
  };
}

export function generateDonationReceiptHtml(data: DonationReceiptData): string {
  const logo = getLogoBase64();
  const paymentMethod = formatPaymentMethod(data.donation.source);
  const receiptNo = `KNY-${String(data.receiptNumber).padStart(5, '0')}`;

  const detailRows: string[] = [];
  if (data.donation.transactionNumber) {
    detailRows.push(`<li><span class="label">Transaction Number</span><span>${escapeHtml(data.donation.transactionNumber)}</span></li>`);
  }
  if (data.donation.cardLast4) {
    detailRows.push(`<li><span class="label">Card Ending In</span><span>${escapeHtml(data.donation.cardLast4)}</span></li>`);
  }
  if (data.donation.memo) {
    detailRows.push(`<li><span class="label">Reference / Note</span><span>${escapeHtml(data.donation.memo)}</span></li>`);
  }
  if (data.donation.description) {
    detailRows.push(`<li><span class="label">Description</span><span>${escapeHtml(data.donation.description)}</span></li>`);
  }

  const body = `
  <section class="receipt-page">
    <div class="page-inner">
      ${headerHtml(logo)}
      <div class="title-bar">CONTRIBUTION RECEIPT</div>
      <table class="summary-grid" aria-label="Receipt Summary">
        <tr>
          <th>Receipt No.</th>
          <td class="value">${escapeHtml(receiptNo)}</td>
          <th>Amount</th>
          <td class="value">${formatCurrency(data.donation.amount)}</td>
        </tr>
        <tr>
          <th>Date</th>
          <td>${formatDate(new Date(data.donation.date))}</td>
          <th>Campaign / Fund</th>
          <td>General Fund</td>
        </tr>
      </table>

      <div class="section-label">Name</div>
      <div class="section-box single-value">${escapeHtml(data.memberName)}</div>

      <table class="payment-table" aria-label="Payment Information">
        <tr>
          <th>Payment Information</th>
          <td>
            <div class="payment-method">${escapeHtml(paymentMethod)}</div>
            ${detailRows.length > 0 ? `<ul class="details-list">${detailRows.join('\n')}</ul>` : ''}
          </td>
        </tr>
      </table>

      <div class="acknowledgment">
        Thank you for your contribution. This receipt is provided as confirmation of the payment listed above.
        Please retain this document for your records. No goods or services were provided in exchange for this
        contribution unless otherwise noted.
      </div>
    </div>
    ${footerHtml()}
  </section>`;

  return wrapPage(`Receipt ${receiptNo}`, body);
}

// --- Annual summary receipt ---

export interface AnnualReceiptData {
  receiptNumber: number;
  memberName: string;
  startDate: Date;
  endDate: Date;
  donations: {
    date: Date;
    amount: number;
    source: string;
    description?: string | null;
  }[];
  grandTotal: number;
}

export function generateAnnualReceiptHtml(data: AnnualReceiptData): string {
  const logo = getLogoBase64();
  const receiptNo = `KNY-${String(data.receiptNumber).padStart(5, '0')}`;
  const period = `${formatDate(data.startDate)} — ${formatDate(data.endDate)}`;

  const donationRows = data.donations.map(d => `
        <tr>
          <td>${formatDate(new Date(d.date))}</td>
          <td>${escapeHtml(d.description || '-')}</td>
          <td>${escapeHtml(formatPaymentMethod(d.source))}</td>
          <td class="amount">${formatCurrency(d.amount)}</td>
        </tr>`).join('');

  const body = `
  <section class="receipt-page">
    <div class="page-inner">
      ${headerHtml(logo)}
      <div class="title-bar">ANNUAL DONATION SUMMARY</div>
      <table class="summary-grid" aria-label="Receipt Summary">
        <tr>
          <th>Receipt No.</th>
          <td class="value">${escapeHtml(receiptNo)}</td>
          <th>Total Amount</th>
          <td class="value">${formatCurrency(data.grandTotal)}</td>
        </tr>
        <tr>
          <th>Donor</th>
          <td>${escapeHtml(data.memberName)}</td>
          <th>Period</th>
          <td>${period}</td>
        </tr>
      </table>

      <div class="section-label">Donation Details</div>
      <table class="donations-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Source</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${donationRows}
          <tr class="total-row">
            <td colspan="3">Grand Total</td>
            <td class="amount">${formatCurrency(data.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div class="acknowledgment">
        Thank you for your generous contributions during this period.
        This receipt is provided as a summary of all donations received.
        Please retain this document for your tax records. No goods or services were provided in exchange for these
        contributions unless otherwise noted.
      </div>
    </div>
    ${footerHtml()}
  </section>`;

  return wrapPage(`Annual Receipt ${receiptNo}`, body);
}
