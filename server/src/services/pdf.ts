import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

const SHUL_NAME = 'Khal Nachlas Yakov';
const SHUL_TAX_ID = '82-5289705';
const TAX_LANGUAGE = 'No goods or services were provided in return for the contribution.';
const TAX_INFO = `${SHUL_NAME} is a tax-exempt charity under the IRS code section 501c3, Tax ID# ${SHUL_TAX_ID}`;

function getLogoPath(): string | null {
  const logoPath = path.join(__dirname, '../../uploads/logo.png');
  return fs.existsSync(logoPath) ? logoPath : null;
}

function addHeader(doc: PDFKit.PDFDocument, title: string) {
  const logo = getLogoPath();
  if (logo) {
    doc.image(logo, 50, 30, { width: 60 });
    doc.moveDown(0.5);
  }

  doc.fontSize(18).font('Helvetica-Bold').text(SHUL_NAME, { align: 'center' });
  doc.fontSize(12).font('Helvetica').text(title, { align: 'center' });
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
  doc.moveDown(1);
}

export function generateInvoicePDF(data: {
  member: { firstName: string; lastName: string; email?: string | null; street?: string | null; city?: string | null; state?: string | null; zip?: string | null };
  bill: { date: string | Date; status: string; totalAmount: number | string; lineItems: { itemName: string; amount: number | string }[]; notes?: string | null };
}): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50 });

  addHeader(doc, 'INVOICE');

  // Member info
  doc.fontSize(10).font('Helvetica-Bold').text('Bill To:');
  doc.font('Helvetica').text(`${data.member.firstName} ${data.member.lastName}`);
  if (data.member.street) doc.text(data.member.street);
  if (data.member.city || data.member.state || data.member.zip) {
    doc.text([data.member.city, data.member.state, data.member.zip].filter(Boolean).join(', '));
  }
  if (data.member.email) doc.text(data.member.email);
  doc.moveDown(0.5);

  // Invoice details
  const billDate = new Date(data.bill.date);
  doc.font('Helvetica-Bold').text(`Date: `, { continued: true }).font('Helvetica').text(billDate.toLocaleDateString());
  doc.font('Helvetica-Bold').text(`Status: `, { continued: true }).font('Helvetica').text(data.bill.status);
  doc.moveDown(1);

  // Line items table
  const tableTop = doc.y;
  const col1 = 50, col2 = 400, col3 = 500;

  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Item', col1, tableTop);
  doc.text('Amount', col2, tableTop, { width: 95, align: 'right' });
  doc.moveDown(0.5);
  doc.moveTo(col1, doc.y).lineTo(545, doc.y).stroke('#cccccc');

  doc.font('Helvetica').fontSize(10);
  for (const item of data.bill.lineItems) {
    doc.moveDown(0.3);
    const y = doc.y;
    doc.text(item.itemName, col1, y);
    doc.text(`$${Number(item.amount).toFixed(2)}`, col2, y, { width: 95, align: 'right' });
  }

  doc.moveDown(0.5);
  doc.moveTo(col1, doc.y).lineTo(545, doc.y).stroke('#cccccc');
  doc.moveDown(0.3);

  // Total
  doc.font('Helvetica-Bold');
  const totalY = doc.y;
  doc.text('Total', col1, totalY);
  doc.text(`$${Number(data.bill.totalAmount).toFixed(2)}`, col2, totalY, { width: 95, align: 'right' });

  if (data.bill.notes) {
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(9).fillColor('#666666').text(`Notes: ${data.bill.notes}`).fillColor('#000000');
  }

  doc.end();
  return doc;
}

export function generateDonationReceiptPDF(data: {
  member: { firstName: string; lastName: string };
  donation: { amount: number | string; date: string | Date; source?: string; transactionNumber?: string | null; description?: string | null };
}): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50 });

  addHeader(doc, 'OFFICIAL TAX-DEDUCTIBLE DONATION RECEIPT');

  doc.fontSize(11).font('Helvetica');
  doc.text(`Please accept this as an official receipt for your donation to ${SHUL_NAME}.`);
  doc.moveDown(1.5);

  // Contribution table
  const boxX = 100, boxW = 395;
  let y = doc.y;

  doc.rect(boxX, y, boxW, 25).fill('#f0f4f8');
  doc.fill('#000000').font('Helvetica-Bold').fontSize(11).text('Contribution Information', boxX + 10, y + 7);
  y += 30;

  const rows = [
    ['Amount', `$${Number(data.donation.amount).toFixed(2)} USD`],
    ['Date', new Date(data.donation.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
    ['Billing Name', `${data.member.firstName} ${data.member.lastName}`],
    ['Payment Information', [data.donation.source || '', data.donation.transactionNumber ? `Transaction number: ${data.donation.transactionNumber}` : ''].filter(Boolean).join('\n') || 'N/A'],
  ];

  if (data.donation.description) {
    rows.push(['Description', data.donation.description]);
  }

  for (const [label, value] of rows) {
    doc.rect(boxX, y, boxW, 30).stroke('#e5e5e5');
    doc.font('Helvetica-Bold').fontSize(9).text(label, boxX + 10, y + 5);
    doc.font('Helvetica').fontSize(10).text(value, boxX + 150, y + 5, { width: 230 });
    y += 30;
  }

  doc.moveDown(3);
  doc.fontSize(9).font('Helvetica').fillColor('#555555');
  doc.text(TAX_LANGUAGE, { align: 'center' });
  doc.moveDown(0.5);
  doc.text(TAX_INFO, { align: 'center' });
  doc.moveDown(2);
  doc.text('Please print this confirmation for your records.', { align: 'center' });
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fillColor('#000000').text('Thank you for your donation', { align: 'center' });

  doc.end();
  return doc;
}

export function generateAnnualReceiptPDF(data: {
  member: { firstName: string; lastName: string };
  startDate: Date;
  endDate: Date;
  donations: { date: string | Date; amount: number | string; source?: string; description?: string | null }[];
  grandTotal: number;
}): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50 });

  addHeader(doc, 'ANNUAL DONATION SUMMARY RECEIPT');

  doc.fontSize(11).font('Helvetica');
  doc.text(`Donor: `, { continued: true });
  doc.font('Helvetica-Bold').text(`${data.member.firstName} ${data.member.lastName}`);
  doc.font('Helvetica').text(`Period: ${data.startDate.toLocaleDateString()} — ${data.endDate.toLocaleDateString()}`);
  doc.moveDown(1);

  // Donations table header
  const col1 = 50, col2 = 180, col3 = 340, col4 = 460;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Date', col1, doc.y);
  doc.text('Description', col2, doc.y);
  doc.text('Source', col3, doc.y);
  doc.text('Amount', col4, doc.y, { width: 85, align: 'right' });
  doc.moveDown(0.5);
  doc.moveTo(col1, doc.y).lineTo(545, doc.y).stroke('#cccccc');

  doc.font('Helvetica').fontSize(9);
  for (const d of data.donations) {
    doc.moveDown(0.3);
    const y = doc.y;
    doc.text(new Date(d.date).toLocaleDateString(), col1, y);
    doc.text(d.description || '-', col2, y, { width: 150 });
    doc.text(d.source || '-', col3, y);
    doc.text(`$${Number(d.amount).toFixed(2)}`, col4, y, { width: 85, align: 'right' });
  }

  doc.moveDown(0.5);
  doc.moveTo(col1, doc.y).lineTo(545, doc.y).stroke('#cccccc');
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(11);
  const totalY = doc.y;
  doc.text('Grand Total', col1, totalY);
  doc.text(`$${data.grandTotal.toFixed(2)}`, col4, totalY, { width: 85, align: 'right' });

  doc.moveDown(3);
  doc.fontSize(9).font('Helvetica').fillColor('#555555');
  doc.text(TAX_LANGUAGE, { align: 'center' });
  doc.moveDown(0.5);
  doc.text(TAX_INFO, { align: 'center' });
  doc.moveDown(2);
  doc.font('Helvetica-Bold').fillColor('#000000').text('Thank you for your generous support', { align: 'center' });

  doc.end();
  return doc;
}
