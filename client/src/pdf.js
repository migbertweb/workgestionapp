import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const money = (n) => new Intl.NumberFormat('es-BR', { style: 'currency', currency: 'USD' }).format(n || 0);

// Palette: teal corporate
const T = { teal: [0, 168, 150], ink: [51, 51, 51], gray: [102, 102, 102], light: [224, 224, 224], white: [255, 255, 255], red: [220, 53, 69], green: [0, 168, 150] };
const M = 20; // page margin

let _logoDataUrl = null;

async function loadLogo() {
  if (_logoDataUrl) return _logoDataUrl;
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = '/logo.png';
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    _logoDataUrl = canvas.toDataURL('image/png');
    return _logoDataUrl;
  } catch {
    return null; // fallback: draw text logo below
  }
}

async function drawHeader(doc) {
  const logoUrl = await loadLogo();
  const lx = M, ly = 14, ls = 16;

  if (logoUrl) {
    doc.addImage(logoUrl, 'PNG', lx, ly, ls, ls);
  } else {
    // Fallback: "M" in teal square
    doc.setFillColor(...T.teal);
    doc.roundedRect(lx, ly, ls, ls, 3, 3, 'F');
    doc.setTextColor(...T.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('M', lx + ls / 2, ly + ls / 2 + 5, { align: 'center' });
  }
  // Company name
  doc.setTextColor(...T.ink);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Migbert Yanez', lx + 22, ly + 8);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...T.gray);
  doc.text('Desarrollo Freelance', lx + 22, ly + 13);
  // Contact info (right)
  doc.setFontSize(8);
  const rx = 190;
  doc.text('Brasil', rx, 16, { align: 'right' });
  doc.text('+55 47 99747-0887', rx, 21, { align: 'right' });
  doc.text('migbertyanez@email.com', rx, 26, { align: 'right' });
  // Separator
  doc.setDrawColor(...T.light);
  doc.setLineWidth(0.3);
  doc.line(M, 36, 210 - M, 36);
}

function drawFooter(doc, page) {
  // Signature line (left)
  const fy = 270;
  doc.setDrawColor(...T.gray);
  doc.setLineWidth(0.3);
  doc.line(M, fy, M + 70, fy);
  doc.setFontSize(7);
  doc.setTextColor(...T.gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Firma', M, fy + 5);

  // Decorative shapes (right)
  const fx = 168;
  doc.setFillColor(...T.teal);
  doc.triangle(fx + 10, fy + 16, fx + 30, fy, fx + 30, fy + 16, 'F');
  doc.setFillColor(30, 30, 30);
  doc.triangle(fx + 18, fy + 12, fx + 30, fy + 2, fx + 30, fy + 12, 'F');
  // Thank you
  doc.setTextColor(...T.teal);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('¡Gracias por tu confianza!', M, 284);
  // Page + date
  doc.setFontSize(7);
  doc.setTextColor(...T.gray);
  doc.setFont('helvetica', 'normal');
  const date = new Date().toLocaleDateString('es-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.text(`Migbert Yanez · Generado: ${date}`, 190, 284, { align: 'right' });
}

function clientSection(doc, title, rows, startY) {
  let y = startY;
  doc.setTextColor(...T.gray);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(title, M, y);
  y += 6;
  rows.forEach(([label, value]) => {
    if (label) {
      doc.setTextColor(...T.gray);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(label, M, y);
      y += 4;
    }
    doc.setTextColor(...T.ink);
    doc.setFontSize(9);
    doc.setFont('helvetica', value === rows[0][1] ? 'bold' : 'normal');
    doc.text(value || '—', M, y);
    y += 7;
  });
  return y;
}

// ─── Invoice PDF ────────────────────────────────────────────────
export async function downloadInvoicePDF(invoice, project, lineItems = []) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const page = 1;

  await drawHeader(doc);

  // Right side: INVOICE title + number
  const rx = 190;
  doc.setTextColor(...T.teal);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', rx, 50, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...T.gray);
  doc.text(`${invoice.number || `#${invoice.id}`}`, rx, 57, { align: 'right' });
  doc.text(`Emitida: ${invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('es-BR') : '—'}`, rx, 62, { align: 'right' });
  doc.text(`Vence: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('es-BR') : '—'}`, rx, 67, { align: 'right' });

  // Left: Invoice To
  let y = clientSection(doc, 'FACTURAR A', [
    [null, project?.client || 'Sin cliente'],
    ['Proyecto', project?.name],
  ], 46);

  // Status badge
  const statusLabels = { draft: 'Borrador', sent: 'Enviada', paid: 'Pagada', overdue: 'Vencida' };
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...T.teal);
  doc.text(`Estado: ${statusLabels[invoice.status] || invoice.status}`, M, y + 4);
  y += 14;

  // Items table
  if (lineItems.length > 0) {
    const body = lineItems.map((i, idx) => [
      String(idx + 1),
      i.description || '—',
      { content: money(i.rate), styles: { halign: 'right' } },
      { content: `${i.hours || 0}`, styles: { halign: 'center' } },
      { content: money(i.amount), styles: { halign: 'right' } },
    ]);
    autoTable(doc, {
      startY: y,
      head: [['No', 'Descripción', 'Precio', 'Cant (h)', 'Total']],
      body,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 5, textColor: T.ink },
      headStyles: { textColor: T.teal, fontStyle: 'bold', fontSize: 8, fillColor: T.white },
      bodyStyles: { lineColor: T.light, lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 84 }, 2: { cellWidth: 28, halign: 'right' }, 3: { cellWidth: 22, halign: 'center' }, 4: { cellWidth: 32, halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 8;
    // Summary (right-aligned)
    const sx = 120;
    const summary = [['Subtotal', money(invoice.amount)], ['Total', money(invoice.amount)]];
    summary.forEach(([label, val], i) => {
      const isLast = i === summary.length - 1;
      doc.setTextColor(isLast ? T.ink : T.gray);
      doc.setFontSize(isLast ? 12 : 9);
      doc.setFont('helvetica', isLast ? 'bold' : 'normal');
      doc.text(label, sx, y);
      doc.text(val, rx, y, { align: 'right' });
      y += isLast ? 10 : 6;
    });
  } else {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...T.ink);
    doc.text(`Total: ${money(invoice.amount)}`, M, y + 4);
    y += 20;
  }

  // Payment + notes (compact, two-column)
  y = Math.max(y + 6, 200);
  const colW = 82;
  // Left: Payment method
  doc.setTextColor(...T.ink);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Método de pago', M, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...T.gray);
  doc.text('Transferencia bancaria · Pago móvil · Revolut', M, y + 6);
  doc.setFontSize(7);
  doc.text('Banco: Mercado Pago / Nubank · Revolut: @migbertyanez', M, y + 11);
  doc.text('Plazo: 15 días desde la emisión. Consultar por transferencia internacional.', M, y + 16);
  // Right: Notes (compact)
  if (invoice.notes) {
    doc.setTextColor(...T.ink);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notas', M + colW + 8, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...T.gray);
    const noteLines = doc.splitTextToSize(invoice.notes, colW);
    doc.text(noteLines, M + colW + 8, y + 6);
  }

  drawFooter(doc, page);
  doc.save(`factura-${invoice.number || invoice.id}.pdf`);
}

// ─── Budget PDF ─────────────────────────────────────────────────
export async function downloadBudgetPDF(project, lineItems, stages, bufferAmount) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const page = 1;

  await drawHeader(doc);

  const rx = 190;
  doc.setTextColor(...T.teal);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESUPUESTO', rx, 48, { align: 'right' });
  doc.setFontSize(12);
  doc.setTextColor(...T.ink);
  doc.text(project?.name || '—', rx, 56, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...T.gray);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-BR')}`, rx, 63, { align: 'right' });

  // Client info
  let y = clientSection(doc, 'PREPARADO PARA', [
    [null, project?.client || 'Sin cliente'],
    ['Moneda', project?.currency || 'USD'],
    ['Deadline', project?.deadline || 'No definido'],
  ], 46);
  y += 4;

  // Stages
  if (stages && stages.length > 0) {
    doc.setTextColor(...T.teal);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Etapas', M, y);
    y += 7;
    const stageBody = stages.map((s, i) => [
      String(i + 1),
      s.name,
      s.status === 'done' ? 'Completada' : s.status === 'progress' ? 'En progreso' : s.status === 'review' ? 'Revisión' : 'Pendiente',
    ]);
    autoTable(doc, {
      startY: y,
      head: [['No', 'Etapa', 'Estado']],
      body: stageBody,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 4, textColor: T.ink },
      headStyles: { textColor: T.teal, fontStyle: 'bold', fontSize: 8, fillColor: T.white },
      bodyStyles: { lineColor: T.light, lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 110 }, 2: { cellWidth: 44 } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Line items
  if (lineItems.length > 0) {
    doc.setTextColor(...T.teal);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Desglose de costos', M, y);
    y += 7;
    const body = lineItems.map((i, idx) => [
      String(idx + 1),
      i.description || '—',
      { content: money(i.rate), styles: { halign: 'right' } },
      { content: `${i.hours || 0}`, styles: { halign: 'center' } },
      { content: money(i.amount), styles: { halign: 'right' } },
    ]);
    autoTable(doc, {
      startY: y,
      head: [['No', 'Descripción', 'Precio', 'Cant (h)', 'Total']],
      body,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 4, textColor: T.ink },
      headStyles: { textColor: T.teal, fontStyle: 'bold', fontSize: 8, fillColor: T.white },
      bodyStyles: { lineColor: T.light, lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 84 }, 2: { cellWidth: 28, halign: 'right' }, 3: { cellWidth: 22, halign: 'center' }, 4: { cellWidth: 32, halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Summary
  const totalCost = lineItems.reduce((s, i) => s + (i.amount || 0), 0);
  const budget = project?.budget || 0;
  const total = budget + (bufferAmount || 0);
  const margin = total - totalCost;
  const sx = 120;

  const summary = [
    ['Presupuesto base', money(budget), T.gray],
    [`Buffer (${project?.buffer_percent || 20}%)`, money(bufferAmount || 0), T.gray],
    ['Subtotal', money(total), T.ink],
    ['Costo real', money(totalCost), T.red],
    ['Margen', money(margin), margin >= 0 ? T.green : T.red],
  ];
  summary.forEach(([label, val, color]) => {
    doc.setTextColor(...color);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(label, sx, y);
    doc.text(val, rx, y, { align: 'right' });
    y += 6;
  });
  y += 2;
  doc.setDrawColor(...T.teal);
  doc.setLineWidth(0.5);
  doc.line(sx, y, rx, y);
  y += 7;
  doc.setTextColor(...T.ink);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total presupuesto', sx, y);
  doc.text(money(total), rx, y, { align: 'right' });

  // Validity note (single line, compact)
  y = Math.max(y + 10, 220);
  doc.setFontSize(7);
  doc.setTextColor(...T.gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Válido por 30 días. Precios en USD. Sujeto a cambios por ajustes en el alcance.', M, y);

  drawFooter(doc, page);
  doc.save(`presupuesto-${project?.name || 'proyecto'}.pdf`);
}
