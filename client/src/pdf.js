import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const money = (n) => new Intl.NumberFormat('es-BR', { style: 'currency', currency: 'USD' }).format(n || 0);

// Palette: teal corporate
const T = { teal: [0, 168, 150], ink: [51, 51, 51], gray: [102, 102, 102], light: [224, 224, 224], white: [255, 255, 255], red: [220, 53, 69], green: [0, 168, 150] };

const M = 20; // page margin

function drawHeader(doc) {
  // Logo: stylized W hexagon
  const logoX = M, logoY = 16;
  doc.setFillColor(...T.teal);
  // Hexagon approximation with polygon
  doc.setDrawColor(...T.teal);
  doc.setLineWidth(1);
  // Simple rounded square for logo
  doc.setFillColor(...T.teal);
  doc.roundedRect(logoX, logoY, 14, 14, 2, 2, 'F');
  doc.setTextColor(...T.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('W', logoX + 7, logoY + 10, { align: 'center' });
  // Company name
  doc.setTextColor(...T.teal);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('WorkApp', logoX + 20, logoY + 9);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...T.gray);
  doc.text('Freelance Project Manager', logoX + 20, logoY + 14);
  // Contact info (right)
  doc.setFontSize(8);
  const rx = 190;
  doc.text('workapp.local', rx, 18, { align: 'right' });
  doc.text('Maracaibo, Venezuela', rx, 23, { align: 'right' });
  doc.text('+58 412-0000000', rx, 28, { align: 'right' });
  // Separator
  doc.setDrawColor(...T.light);
  doc.setLineWidth(0.3);
  doc.line(M, 38, 210 - M, 38);
}

function drawFooter(doc) {
  // Decorative shapes bottom-right
  const fx = 160, fy = 254;
  doc.setFillColor(...T.teal);
  doc.setDrawColor(...T.teal);
  doc.triangle(fx + 20, fy + 43, fx + 50, fy + 20, fx + 50, fy + 43, 'F');
  doc.setFillColor(30, 30, 30);
  doc.triangle(fx + 30, fy + 35, fx + 50, fy + 15, fx + 50, fy + 35, 'F');
  doc.setFillColor(...T.teal);
  doc.triangle(fx + 10, fy + 43, fx + 40, fy + 28, fx + 40, fy + 43, 'F');
  // Thank you
  doc.setTextColor(...T.teal);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('¡Gracias por tu confianza!', M, 268);
  // Page + date
  doc.setFontSize(7);
  doc.setTextColor(...T.gray);
  doc.setFont('helvetica', 'normal');
  const date = new Date().toLocaleDateString('es-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.text(`WorkApp · Generado: ${date}`, M, 275);
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
export function downloadInvoicePDF(invoice, project, lineItems = []) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawHeader(doc);

  // Right side: INVOICE title + number
  const rx = 190;
  doc.setTextColor(...T.teal);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', rx, 52, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...T.gray);
  doc.text(`${invoice.number || `#${invoice.id}`}`, rx, 59, { align: 'right' });
  doc.text(`Emitida: ${invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('es-BR') : '—'}`, rx, 64, { align: 'right' });
  doc.text(`Vence: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('es-BR') : '—'}`, rx, 69, { align: 'right' });

  // Left: Invoice To
  let y = clientSection(doc, 'FACTURAR A', [
    [null, project?.client || 'Sin cliente'],
    ['Proyecto', project?.name],
  ], 50);

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
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 84 },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 32, halign: 'right' },
      },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Summary (right-aligned)
    const sx = 120;
    const summary = [
      ['Subtotal', money(invoice.amount)],
      ['Total', money(invoice.amount)],
    ];
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

  // Payment info + notes
  if (y < 210) y = 210;
  doc.setTextColor(...T.ink);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Método de pago', M, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...T.gray);
  doc.text('Transferencia bancaria · Pago móvil · Zelle', M, y + 6);
  doc.text('Los datos de pago se coordinan directamente con el cliente.', M, y + 11);

  if (invoice.notes) {
    doc.setTextColor(...T.ink);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notas', M, y + 22);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...T.gray);
    doc.text(invoice.notes, M, y + 28, { maxWidth: 170 });
  }

  drawFooter(doc);
  doc.save(`factura-${invoice.number || invoice.id}.pdf`);
}

// ─── Budget PDF ─────────────────────────────────────────────────
export function downloadBudgetPDF(project, lineItems, stages, bufferAmount) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawHeader(doc);

  const rx = 190;
  doc.setTextColor(...T.teal);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESUPUESTO', rx, 52, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...T.gray);
  doc.text(`Proyecto: ${project?.name || '—'}`, rx, 59, { align: 'right' });
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-BR')}`, rx, 64, { align: 'right' });

  // Client info
  let y = clientSection(doc, 'PREPARADO PARA', [
    [null, project?.client || 'Sin cliente'],
    ['Moneda', project?.currency || 'USD'],
    ['Deadline', project?.deadline || 'No definido'],
  ], 50);

  y += 6;

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
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 84 },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 32, halign: 'right' },
      },
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
  // Final total
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

  // Notes
  y += 16;
  if (y < 220) y = 220;
  doc.setTextColor(...T.ink);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Notas', M, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...T.gray);
  doc.text('Este presupuesto es válido por 30 días desde la fecha de emisión.', M, y + 6);
  doc.text('Los precios no incluyen impuestos aplicables. Las condiciones de pago se acuerdan por contrato.', M, y + 12);
  doc.text('Cualquier cambio en el alcance del proyecto puede requerir un ajuste en el presupuesto.', M, y + 18);

  drawFooter(doc);
  doc.save(`presupuesto-${project?.name || 'proyecto'}.pdf`);
}
