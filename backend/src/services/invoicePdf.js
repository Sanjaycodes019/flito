const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { nepalDay } = require('./nepalTime');
const { adToBs, BS_MONTHS } = require('./bsCalendar');
const { amountInWords } = require('../utils/format');

// Draws an invoice (see services/invoice) as an A4 PDF and returns its bytes.
//
// Noto Sans Devanagari is used for all text: it has Latin letters as well as
// Devanagari, so a name or tole typed in Nepali prints properly, not as boxes.

const FONT_DIR = path.dirname(require.resolve('@expo-google-fonts/noto-sans-devanagari/package.json'));
const FONT_FILES = {
  regular: '400Regular/NotoSansDevanagari_400Regular.ttf',
  medium: '500Medium/NotoSansDevanagari_500Medium.ttf',
  semibold: '600SemiBold/NotoSansDevanagari_600SemiBold.ttf',
  bold: '700Bold/NotoSansDevanagari_700Bold.ttf',
};
const LOGO_FILE = path.join(__dirname, '../assets/invoice-logo.png');

// Read once, on the first invoice.
let assets;
const loadAssets = () => {
  if (!assets) {
    assets = {
      fonts: Object.fromEntries(Object.entries(FONT_FILES).map(([name, file]) => [name, fs.readFileSync(path.join(FONT_DIR, file))])),
      logo: fs.readFileSync(LOGO_FILE),
    };
  }
  return assets;
};

// The FLITO palette (frontend/src/utils/colors.js), with the darker text tones
// the app uses where amber or teal would be too faint to read on white.
const C = {
  night: '#12161A',
  ink: '#1E242B',
  body: '#3A444F',
  muted: '#5D6E6F',
  faint: '#8A97A3',
  line: '#E2E6EA',
  soft: '#F5F7F9',
  white: '#FFFFFF',
  amber: '#FF9F00',
  amberSoft: '#FFF3DC',
  amberText: '#995F00',
  teal: '#00D2A2',
  tealSoft: '#E1F8F2',
  tealText: '#007E61',
  red: '#C0392B',
  redSoft: '#FBE9E7',
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 44; // side margin
const CW = PAGE_W - M * 2; // content width

// ── Formatting ──────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

// "Rs. 12,34,567" or, with paisa, "Rs. 12,34,567.50".
const rs = (amount) => {
  const value = Number(amount || 0);
  const digits = Number.isInteger(value) ? 0 : 2;
  return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

// "6 Oct 2026" for a day key ("2026-10-06") or a moment, as Nepal sees it.
const adDay = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const keyOf = (value) => (typeof value === 'string' ? value : nepalDay(value));
const adDate = (value) => (value ? adDay(keyOf(value)) : '-');
// "20 Ashwin 2083 BS"
const bsDate = (value) => {
  const bs = value ? adToBs(keyOf(value)) : null;
  return bs ? `${bs.day} ${BS_MONTHS.en[bs.month - 1]} ${bs.year} BS` : null;
};
const nepalTime = (at) => new Date(new Date(at).getTime() + NEPAL_OFFSET_MS).toISOString().slice(11, 16);

const TRUCK_TYPES = {
  pickup: 'Pickup',
  'mini-truck': 'Mini truck',
  'light-truck': 'Light truck',
  '6-wheeler': '6-wheeler',
  '10-wheeler': '10-wheeler',
  '12-wheeler': '12-wheeler',
  trailer: 'Trailer',
  '6-ton': '6-ton truck',
  '10-ton': '10-ton truck',
  '14-ton': '14-ton truck',
  '18-wheeler': '18-wheeler',
};
const METHODS = { bank: 'Bank transfer', esewa: 'eSewa', khalti: 'Khalti', cash: 'Cash' };
const WALLETS = { esewa: 'eSewa', khalti: 'Khalti' };

const kg = (value) => (value ? `${Number(value).toLocaleString('en-IN')} kg` : null);
const km = (value, estimated) => (value ? `${Math.round(value).toLocaleString('en-IN')} km${estimated ? ' (approx.)' : ''}` : null);

const truckLine = (truck) => {
  if (!truck) return null;
  const type = TRUCK_TYPES[truck.truckType] || 'Truck';
  return truck.bodyType ? `${type}, ${truck.bodyType} body` : type;
};

const statusOf = ({ total, paid, due }) => {
  if (due <= 0) return { label: 'PAID', fg: C.tealText, bg: C.tealSoft };
  if (paid > 0 && paid < total) return { label: 'PART PAID', fg: C.amberText, bg: C.amberSoft };
  return { label: 'UNPAID', fg: C.red, bg: C.redSoft };
};

// ── Drawing ─────────────────────────────────────────────────────────────────

const renderInvoicePdf = (invoice, { generatedAt = new Date() } = {}) => new Promise((resolve, reject) => {
  const { fonts, logo } = loadAssets();
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: {
      Title: `Invoice ${invoice.number}`,
      Author: invoice.owner?.name || 'FLITO',
      Subject: 'Freight invoice',
      Creator: 'FLITO',
      Producer: 'FLITO',
    },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  Object.entries(fonts).forEach(([name, data]) => doc.registerFont(name, data));

  const style = ({ font = 'regular', size = 9, color = C.body } = {}) => doc.font(font).fontSize(size).fillColor(color);

  // Writes text at a point and returns the y below it. `lines` caps how many
  // lines it may take, ending the last with an ellipsis.
  const text = (value, x, y, {
    font, size = 9, color, width, align = 'left', lineGap = 1.2, spacing = 0, lines,
  } = {}) => {
    style({ font, size, color });
    const options = { width, align, lineGap, characterSpacing: spacing };
    if (lines) Object.assign(options, { height: lines * (doc.currentLineHeight(true) + lineGap), ellipsis: true });
    doc.text(String(value ?? ''), x, y, options);
    return doc.y;
  };

  const widthOf = (value, { font, size = 9, spacing = 0 } = {}) => {
    style({ font, size });
    return doc.widthOfString(String(value), { characterSpacing: spacing });
  };

  // A small uppercase label, like "BILLED TO".
  const caption = (value, x, y, options = {}) => text(String(value).toUpperCase(), x, y, {
    font: 'semibold', size: 6.8, color: C.faint, spacing: 0.9, ...options,
  });

  const pill = (label, rightX, y, { fg, bg, size = 7.5 }) => {
    const w = widthOf(label, { font: 'bold', size, spacing: 1 }) + 18;
    doc.roundedRect(rightX - w, y, w, size + 10, (size + 10) / 2).fill(bg);
    text(label, rightX - w, y + 4.2, { font: 'bold', size, color: fg, width: w, align: 'center', spacing: 1 });
    return w;
  };

  const hline = (x, y, w, color = C.line, width = 0.75) => {
    doc.moveTo(x, y).lineTo(x + w, y).lineWidth(width).strokeColor(color).stroke();
  };

  const status = statusOf(invoice.amounts);
  const { trip, amounts, delivery } = invoice;
  const distance = km(trip.distanceKm, trip.distanceEstimated);

  // Every block has a fixed place and long text is clipped, so the invoice is
  // always exactly one A4 page.

  const sectionTitle = (title, x, top, width) => {
    text(title, x, top, { font: 'semibold', size: 9.5, color: C.ink });
    const w = widthOf(title, { font: 'semibold', size: 9.5 });
    hline(x + w + 8, top + 7.5, width - w - 8);
  };

  // ── Header ────────────────────────────────────────────────────────────────
  const HEADER_H = 96;
  doc.rect(0, 0, PAGE_W, HEADER_H).fill(C.night);
  // Two faint diagonal stripes, echoing the motion in the logo.
  doc.save().fillOpacity(0.08).fillColor(C.amber)
    .polygon([PAGE_W - 250, 0], [PAGE_W - 160, 0], [PAGE_W - 220, HEADER_H], [PAGE_W - 310, HEADER_H]).fill()
    .restore();
  doc.save().fillOpacity(0.06).fillColor(C.teal)
    .polygon([PAGE_W - 140, 0], [PAGE_W - 108, 0], [PAGE_W - 168, HEADER_H], [PAGE_W - 200, HEADER_H]).fill()
    .restore();

  doc.image(logo, M - 3, 22, { width: 52 });
  text('FLITO', M + 56, 25, { font: 'bold', size: 21, color: C.amber, spacing: 3 });
  text('Truck booking across Nepal', M + 57, 53, { size: 8, color: '#AEB6BF' });

  text('INVOICE', M, 20, { font: 'bold', size: 23, color: C.white, width: CW, align: 'right', spacing: 4 });
  text(`No. ${invoice.number}`, M, 52, { font: 'medium', size: 9.5, color: C.amber, width: CW, align: 'right' });
  pill(status.label, M + CW, 69, { fg: status.fg, bg: status.bg, size: 7 });

  doc.rect(0, HEADER_H, PAGE_W, 3.5).fill(C.amber);
  doc.rect(0, HEADER_H, 96, 3.5).fill(C.teal);

  // ── Key facts ─────────────────────────────────────────────────────────────
  let y = 114;
  const META_H = 46;
  doc.roundedRect(M, y, CW, META_H, 7).fill(C.soft);
  const meta = [
    ['Issue date', adDate(invoice.issuedAt), bsDate(invoice.issuedAt)],
    ['Trip completed', adDate(invoice.completedAt), bsDate(invoice.completedAt)],
    ['Booking reference', `#${invoice.reference}`, `Booked ${adDate(invoice.bookedAt)}`],
    ['Balance due', rs(amounts.due), amounts.due > 0 ? 'Payable to the truck owner' : 'Settled in full'],
  ];
  const metaW = CW / meta.length;
  meta.forEach(([label, value, sub], i) => {
    const x = M + metaW * i + 14;
    if (i > 0) doc.moveTo(M + metaW * i, y + 10).lineTo(M + metaW * i, y + META_H - 10).lineWidth(0.75).strokeColor(C.line).stroke();
    caption(label, x, y + 8);
    const isDue = i === meta.length - 1;
    text(value, x, y + 17, {
      font: isDue ? 'bold' : 'semibold',
      size: 10,
      color: isDue ? (amounts.due > 0 ? C.red : C.tealText) : C.ink,
      width: metaW - 22,
      lines: 1,
    });
    if (sub) text(sub, x, y + 31, { size: 6.8, color: C.muted, width: metaW - 22, lines: 1 });
  });

  // ── Parties ───────────────────────────────────────────────────────────────
  y = 174;
  const PARTY_H = 94;
  const PARTY_GAP = 14;
  const partyW = (CW - PARTY_GAP) / 2;
  const partyInner = partyW - 32;
  [
    { heading: 'Billed by', role: 'Truck owner', party: invoice.owner, accent: C.amber },
    { heading: 'Billed to', role: 'Shipper', party: invoice.shipper, accent: C.teal },
  ].forEach(({ heading, role, party, accent }, i) => {
    const x = M + i * (partyW + PARTY_GAP);
    const tx = x + 16;
    doc.roundedRect(x, y, partyW, PARTY_H, 7).lineWidth(0.75).strokeColor(C.line).stroke();
    doc.save().roundedRect(x, y, partyW, PARTY_H, 7).clip().rect(x, y, 3.5, PARTY_H).fill(accent).restore();
    caption(heading, tx, y + 11);
    text(role, tx, y + 10.5, { font: 'medium', size: 7, color: C.faint, width: partyInner, align: 'right' });
    text(party?.name || '-', tx, y + 23, { font: 'semibold', size: 11, color: C.ink, width: partyInner, lines: 1 });
    const reach = [party?.contact, party?.phone, party?.email].filter(Boolean).join('  ·  ');
    let py = y + 41;
    if (reach) py = text(reach, tx, py, { size: 8, color: C.body, width: partyInner, lines: 2 }) + 1;
    if (party?.address) text(party.address, tx, py, { size: 7.8, color: C.muted, width: partyInner, lines: 2 });
  });

  // ── Trip ──────────────────────────────────────────────────────────────────
  y = 284;
  sectionTitle('Trip details', M, y, CW);
  y += 19;
  const ROUTE_H = 66;
  doc.roundedRect(M, y, CW, ROUTE_H, 7).fill(C.soft);
  const colW = CW / 2 - 40;
  const stops = [
    { key: 'Pickup', stop: trip.pickup, color: C.teal, x: M + 16 },
    { key: 'Drop-off', stop: trip.dropoff, color: C.amber, x: M + CW / 2 + 22 },
  ];
  const dotY = y + 15;
  // The road between the stops, dashed, with the distance on it.
  const lineFrom = M + 86;
  const lineTo = stops[1].x - 12;
  doc.save().moveTo(lineFrom, dotY).lineTo(lineTo, dotY).lineWidth(1.1).dash(3, { space: 3 }).strokeColor('#C3CBD3').stroke().restore();
  if (distance) {
    const w = widthOf(distance, { font: 'semibold', size: 7.3 }) + 16;
    const cx = (lineFrom + lineTo) / 2;
    doc.roundedRect(cx - w / 2, dotY - 7.5, w, 15, 7.5).fill(C.white);
    doc.roundedRect(cx - w / 2, dotY - 7.5, w, 15, 7.5).lineWidth(0.75).strokeColor(C.line).stroke();
    text(distance, cx - w / 2, dotY - 4.8, { font: 'semibold', size: 7.3, color: C.ink, width: w, align: 'center' });
  }
  stops.forEach(({ key, stop, color, x }) => {
    doc.circle(x + 4, dotY, 5.5).fill(C.white);
    doc.circle(x + 4, dotY, 3.6).fill(color);
    caption(key, x + 15, dotY - 4.3);
    text(stop?.label || '-', x, dotY + 10, { font: 'semibold', size: 10, color: C.ink, width: colW, lines: 1 });
    const detail = [stop?.address !== stop?.label ? stop?.address : null, stop?.contact ? `Contact: ${stop.contact}` : null]
      .filter(Boolean).join('  ·  ');
    if (detail) text(detail, x, dotY + 25, { size: 7.3, color: C.muted, width: colW, lines: 2 });
  });
  y += ROUTE_H + 10;

  const goods = [trip.goodsType, trip.quantity ? `qty ${trip.quantity}` : null].filter(Boolean).join(', ');
  const facts = [
    ['Goods', goods || '-'],
    ['Weight', [kg(trip.weight), trip.volume ? `${trip.volume} m³` : null].filter(Boolean).join(' · ') || '-'],
    ['Truck', truckLine(trip.truck) || '-'],
    ['Truck number', [trip.truck?.registrationNumber, trip.truck?.makeModel].filter(Boolean).join(' · ') || '-'],
    ['Pickup date', trip.pickupDay ? adDate(trip.pickupDay) : '-'],
    ['Delivered', adDate(invoice.completedAt)],
    ['Distance', distance || '-'],
    ['Driver', trip.driver || '-'],
  ];
  const factW = CW / 4;
  facts.forEach(([label, value], i) => {
    const x = M + factW * (i % 4) + (i % 4 === 0 ? 0 : 8);
    const fy = y + Math.floor(i / 4) * 27;
    caption(label, x, fy);
    text(value, x, fy + 9.5, { font: 'medium', size: 8.5, color: C.ink, width: factW - 14, lines: 1 });
  });

  // ── Charges ───────────────────────────────────────────────────────────────
  y = 446;
  sectionTitle('Charges', M, y, CW);
  y += 19;
  const PAD = 12;
  const cols = [
    { title: '#', w: 26, align: 'left' },
    { title: 'Description', w: CW - 26 - 60 - 92 - 100, align: 'left' },
    { title: 'Qty', w: 60, align: 'right' },
    { title: 'Rate', w: 92, align: 'right' },
    { title: 'Amount', w: 100, align: 'right' },
  ];
  const colX = cols.reduce((xs, col, i) => [...xs, i === 0 ? M : xs[i - 1] + cols[i - 1].w], []);
  doc.roundedRect(M, y, CW, 22, 5).fill(C.ink);
  cols.forEach((col, i) => {
    const first = i === 0;
    const last = i === cols.length - 1;
    text(col.title.toUpperCase(), colX[i] + (first ? PAD : 0), y + 7.5, {
      font: 'semibold', size: 6.8, color: C.white, spacing: 0.9, width: col.w - (last ? PAD : 0) - (first ? PAD : 0), align: col.align,
    });
  });
  y += 22;

  const descW = cols[1].w - 10;
  const routeText = [trip.pickup?.label, trip.dropoff?.label].filter(Boolean).join(' to ');
  const detailText = [
    [trip.goodsType, kg(trip.weight)].filter(Boolean).join(', '),
    trip.truck ? [TRUCK_TYPES[trip.truck.truckType] || 'Truck', trip.truck.registrationNumber].filter(Boolean).join(' ') : null,
    km(trip.distanceKm),
  ].filter(Boolean).join('  ·  ');
  text('1', colX[0] + PAD, y + 10, { font: 'medium', size: 9, color: C.muted });
  text('Freight charges', colX[1], y + 9, { font: 'semibold', size: 9.5, color: C.ink, width: descW, lines: 1 });
  if (routeText) text(routeText, colX[1], y + 23, { size: 8, color: C.body, width: descW, lines: 1 });
  if (detailText) text(detailText, colX[1], y + 35, { size: 7.3, color: C.muted, width: descW, lines: 1 });
  text('1 trip', colX[2], y + 10, { size: 8.8, color: C.body, width: cols[2].w, align: 'right' });
  text(rs(amounts.total), colX[3], y + 10, { size: 8.8, color: C.body, width: cols[3].w, align: 'right' });
  text(rs(amounts.total), colX[4], y + 10, {
    font: 'semibold', size: 9.3, color: C.ink, width: cols[4].w - PAD, align: 'right',
  });
  y += 50;
  hline(M, y, CW);

  // Totals on the right; on the left the amount in words, then either where
  // to pay the rest or a stamp once it is all paid.
  y = 552;
  const TOTALS_W = 226;
  const totalsX = M + CW - TOTALS_W;
  const totalRow = (label, value, top, { font = 'regular', color = C.body, valueColor = C.ink, size = 8.8 } = {}) => {
    text(label, totalsX + PAD, top, { font, size, color });
    text(value, totalsX, top, {
      font: font === 'regular' ? 'medium' : font, size, color: valueColor, width: TOTALS_W - PAD, align: 'right',
    });
  };
  totalRow('Subtotal (1 item)', rs(amounts.total), y);
  doc.roundedRect(totalsX, y + 18, TOTALS_W, 28, 6).fill(C.amber);
  text('Total (NPR)', totalsX + PAD, y + 25.5, { font: 'bold', size: 10, color: C.ink });
  text(rs(amounts.total), totalsX, y + 24, { font: 'bold', size: 12, color: C.ink, width: TOTALS_W - PAD, align: 'right' });
  totalRow('Paid', amounts.paid ? `- ${rs(amounts.paid)}` : rs(0), y + 55, { valueColor: C.tealText });
  hline(totalsX, y + 73, TOTALS_W);
  totalRow('Balance due', rs(amounts.due), y + 80, {
    font: 'bold', size: 10, color: C.ink, valueColor: amounts.due > 0 ? C.red : C.tealText,
  });

  const leftW = CW - TOTALS_W - 24;
  caption('Amount in words', M, y);
  text(amountInWords(amounts.total), M, y + 10, { font: 'medium', size: 8.8, color: C.ink, width: leftW, lines: 2 });
  const boxTop = y + 42;
  if (amounts.due > 0) {
    // The owner's preferred account for the balance.
    const method = invoice.payTo[0];
    doc.roundedRect(M, boxTop, leftW, 56, 6).fill(C.soft);
    caption('Pay the balance to', M + 12, boxTop + 9);
    if (method) {
      const name = method.kind === 'bank' ? method.bankName || 'Bank account' : WALLETS[method.kind];
      const account = method.kind === 'bank' ? [method.accountNumber, method.branch].filter(Boolean).join(', ') : method.walletId;
      text(`${name}  ·  ${method.accountName}`, M + 12, boxTop + 20, { font: 'semibold', size: 8.8, color: C.ink, width: leftW - 24, lines: 1 });
      text(account || '-', M + 12, boxTop + 33, { font: 'medium', size: 8.5, color: C.body, width: leftW - 24, lines: 1 });
      text(`Note invoice ${invoice.number} with the payment.`, M + 12, boxTop + 45, { size: 6.8, color: C.muted, width: leftW - 24, lines: 1 });
    } else {
      text('Ask the truck owner how they would like to be paid.', M + 12, boxTop + 22, { size: 8.3, color: C.body, width: leftW - 24, lines: 2 });
    }
  } else if (amounts.total > 0) {
    // A rubber stamp, slightly turned.
    const sw = 146;
    const sh = 46;
    const sx = M + 8;
    const sy = boxTop + 4;
    doc.save().rotate(-6, { origin: [sx + sw / 2, sy + sh / 2] }).opacity(0.9);
    doc.roundedRect(sx, sy, sw, sh, 6).lineWidth(1.7).strokeColor(C.tealText).stroke();
    doc.roundedRect(sx + 3.5, sy + 3.5, sw - 7, sh - 7, 4).lineWidth(0.6).strokeColor(C.tealText).stroke();
    text('PAID IN FULL', sx, sy + 9, { font: 'bold', size: 13, color: C.tealText, width: sw, align: 'center', spacing: 2 });
    const lastPaid = invoice.payments[invoice.payments.length - 1]?.date;
    if (lastPaid) text(adDate(lastPaid), sx, sy + 28, { font: 'semibold', size: 7, color: C.tealText, width: sw, align: 'center', spacing: 1 });
    doc.restore();
  }

  // ── Payments and proof of delivery, side by side ──────────────────────────
  y = 662;
  const PROOF_W = 176;
  const payW = CW - PROOF_W - 20;
  const proofX = M + payW + 20;
  sectionTitle('Payments received', M, y, payW);
  sectionTitle('Proof of delivery', proofX, y, PROOF_W);
  y += 19;

  // Three rows fit; more are summed into one line so the page never overflows.
  const MAX_ROWS = 3;
  if (!invoice.payments.length) {
    text('No payments have been confirmed by the truck owner yet.', M, y + 2, { size: 8, color: C.muted, width: payW });
  } else {
    const payCols = [
      { title: 'Date', w: 64 },
      { title: 'Method', w: 62 },
      { title: 'Reference / paid to', w: payW - 64 - 62 - 76 },
      { title: 'Amount', w: 76, align: 'right' },
    ];
    const payX = payCols.reduce((xs, col, i) => [...xs, i === 0 ? M : xs[i - 1] + payCols[i - 1].w], []);
    payCols.forEach((col, i) => caption(col.title, payX[i] + (i === 0 ? 8 : 0), y, { width: col.w - 8, align: col.align || 'left' }));
    hline(M, y + 11, payW, C.ink, 0.8);
    let ry = y + 11;
    const shown = invoice.payments.length > MAX_ROWS ? invoice.payments.slice(-(MAX_ROWS - 1)) : invoice.payments;
    const hidden = invoice.payments.slice(0, invoice.payments.length - shown.length);
    if (hidden.length) {
      text(`${hidden.length} earlier payments`, M + 8, ry + 4.5, { size: 7.6, color: C.muted, width: payW - 100 });
      text(rs(hidden.reduce((sum, p) => sum + p.amount, 0)), M, ry + 4.5, {
        font: 'semibold', size: 7.6, color: C.ink, width: payW - 8, align: 'right',
      });
      ry += 17;
    }
    shown.forEach((payment, index) => {
      if ((index + (hidden.length ? 1 : 0)) % 2 === 1) doc.rect(M, ry, payW, 17).fill(C.soft);
      const where = [payment.reference, payment.paidTo || (payment.method === 'cash' ? 'Cash in hand' : null)].filter(Boolean).join(' · ');
      [adDate(payment.date), METHODS[payment.method] || payment.method, where || '-', rs(payment.amount)]
        .forEach((value, i) => text(value, payX[i] + (i === 0 ? 8 : 0), ry + 4.5, {
          font: i === 3 ? 'semibold' : 'regular',
          size: 7.6,
          color: i === 3 ? C.ink : C.body,
          width: payCols[i].w - 8,
          align: payCols[i].align || 'left',
          lines: 1,
        }));
      ry += 17;
    });
    hline(M, ry, payW);
    text(`Total received  ${rs(amounts.paid)}`, M, ry + 5, { font: 'semibold', size: 8, color: C.tealText, width: payW - 8, align: 'right' });
  }

  const PROOF_H = 80;
  doc.roundedRect(proofX, y, PROOF_W, PROOF_H, 6).lineWidth(0.75).strokeColor(C.line).stroke();
  if (delivery.signature) {
    try {
      doc.image(delivery.signature, proofX + 10, y + 5, { fit: [PROOF_W - 20, 38], align: 'center', valign: 'center' });
    } catch {
      text('Signature on file in FLITO', proofX, y + 20, { size: 7.5, color: C.faint, width: PROOF_W, align: 'center' });
    }
  } else {
    text('No signature captured', proofX, y + 20, { size: 7.5, color: C.faint, width: PROOF_W, align: 'center' });
  }
  hline(proofX + 16, y + 45, PROOF_W - 32, '#C3CBD3', 0.6);
  caption("Receiver's signature", proofX, y + 49, { width: PROOF_W, align: 'center' });
  const proofNote = [
    delivery.signedAt ? `Signed ${adDate(delivery.signedAt)}, ${nepalTime(delivery.signedAt)} NPT` : `Delivered ${adDate(invoice.completedAt)}`,
    delivery.photos ? `${delivery.photos} photo${delivery.photos === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join('  ·  ');
  text(proofNote, proofX + 6, y + 62, { size: 6.8, color: C.muted, width: PROOF_W - 12, align: 'center', lines: 1 });

  // ── Notes and footer ──────────────────────────────────────────────────────
  text(
    `Issued by ${invoice.owner?.name || 'the truck owner'} for a trip booked on FLITO. Payments go straight to the truck owner; `
      + 'FLITO does not collect or hold trip payments, and only payments the owner confirmed are listed. All amounts in NPR.',
    M, PAGE_H - 72, { size: 6.8, color: C.muted, width: CW, lines: 2 },
  );
  hline(M, PAGE_H - 44, CW);
  text('Thank you for shipping with FLITO.', M, PAGE_H - 36, { font: 'semibold', size: 7.5, color: C.amberText, width: CW / 3, lines: 1 });
  text(`Generated ${adDate(generatedAt)}, ${nepalTime(generatedAt)} NPT`, M + CW / 3, PAGE_H - 36, {
    size: 7, color: C.faint, width: CW / 3, align: 'center',
  });
  text(`Invoice ${invoice.number}`, M + (CW * 2) / 3, PAGE_H - 36, { size: 7, color: C.faint, width: CW / 3, align: 'right' });

  doc.end();
});

// "FLITO-Invoice-FL-2083-84-00042.pdf"
const invoiceFileName = (number) => `FLITO-Invoice-${String(number || 'draft').replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`;

module.exports = { renderInvoicePdf, invoiceFileName };
