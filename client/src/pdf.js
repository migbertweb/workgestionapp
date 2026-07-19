import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const money = (n) => new Intl.NumberFormat('es-BR', { style: 'currency', currency: 'USD' }).format(n || 0);
const C = { ink: [30, 41, 59], muted: [148, 163, 184], accent: [99, 102, 241], green: [34, 197, 94], red: [239, 68, 68], white: [255, 255, 255], light: [248, 250, 252] };

function drawHeader(doc, title, subtitle) {
  // Thin accent bar at top
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, 210, 6, 'F');
  // Logo + company name
  doc.setFillColor(...C.accent);
  doc.roundedRect(14, 14, 36, 14, 3, 3, 'F');
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('WorkApp', 32, 23.5, { align: 'center' });
  doc.setTextColor(...C.ink);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.muted);
  doc.text('Freelance Project Manager', 14, 36);
  // Title right-aligned
  doc.setTextColor(...C.ink);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 196, 22, { align: 'right' });
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text(subtitle, 196, 28, { align: 'right' });
  }
  // Separator line
  doc.setDrawColor(...C.muted);
  doc.setLineWidth(0.3);
  doc.line(14, 44, 196, 44);
}

function drawFooter(doc, page) {
  const y = 285;
  doc.setDrawColor(...C.muted);
  doc.setLineWidth(0.2);
  doc.line(14, y, 196, y);
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.setFont('helvetica', 'normal');
  doc.text(`WorkApp · Página ${page}`, 14, y + 6);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 196, y + 6, { align: 'right' });
}

function drawInfoBox(doc, rows, startY) {
  let y = startY;
  doc.setDrawColor(...C.muted);
  doc.setFillColor(...C.light);
  doc.roundedRect(14, y, 182, rows.length * 7 + 10, 3, 3, 'FD');
  y += 6;
  doc.setFont('helvetica', 'normal');
  rows.forEach(([label, value]) => {
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(label, 22, y);
    doc.setFontSize(9);
    doc.setTextColor(...C.ink);
    doc.text(value || '—', 22, y + 4);
    y += 9;
  });
  return y + 6;
}

const tableStyles = {
  theme: 'striped',
  styles: { fontSize: 8, cellPadding: 4, lineColor: [220, 226, 233], lineWidth: 0.2 },
  headStyles: { fillColor: C.accent, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
  bodyStyles: { textColor: C.ink },
  alternateRowStyles: { fillColor: [245, 247, 250] },
};

// ─── Invoice PDF ────────────────────────────────────────────────
export function downloadInvoicePDF(invoice, project, lineItems = []) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const page = 1;
  const rows = [];

  drawHeader(doc, 'FACTURA', invoice.number || `#${invoice.id}`);

  const statusLabels = { draft: 'Borrador', sent: 'Enviada', paid: 'Pagada', overdue: 'Vencida' };
  let y = drawInfoBox(doc, [
    ['Proyecto', project?.name],
    ['Cliente', project?.client],
    ['Fecha emisión', invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('es-BR') : '—'],
    ['Vencimiento', invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('es-BR') : '—'],
  ], 52);

  // Status badge
  const status = statusLabels[invoice.status] || invoice.status?.toUpperCase() || 'DRAFT';
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.accent);
  doc.text(`Estado: ${status}`, 14, y);
  y += 10;

  // Items
  if (lineItems.length > 0) {
    const body = lineItems.map(i => [
      i.description || '—',
      i.category || '—',
      { content: `${i.hours || 0}h`, styles: { halign: 'right' } },
      { content: money(i.rate), styles: { halign: 'right' } },
      { content: money(i.amount), styles: { halign: 'right' } },
    ]);
    body.push([
      { content: 'TOTAL', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fontSize: 9 } },
      { content: money(invoice.amount), styles: { fontStyle: 'bold', fontSize: 9, halign: 'right' } },
    ]);
    doc.autoTable({
      startY: y,
      head: [['Descripción', 'Cat', 'Horas', 'Tarifa', 'Monto']],
      body,
      ...tableStyles,
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 24 }, 2: { cellWidth: 24 }, 3: { cellWidth: 32 }, 4: { cellWidth: 32 } },
    });
    y = doc.lastAutoTable.finalY + 12;
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.ink);
    doc.text(`Total: ${money(invoice.amount)}`, 14, y + 5);
    y += 20;
  }

  // Notes
  if (invoice.notes) {
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'italic');
    doc.text('Notas:', 14, y);
    doc.text(invoice.notes, 14, y + 5, { maxWidth: 182 });
  }

  drawFooter(doc, page);
  doc.save(`factura-${invoice.number || invoice.id}.pdf`);
}

// ─── Budget PDF ─────────────────────────────────────────────────
export function downloadBudgetPDF(project, lineItems, stages, bufferAmount) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const page = 1;

  drawHeader(doc, 'PRESUPUESTO', project?.name);

  let y = drawInfoBox(doc, [
    ['Proyecto', project?.name],
    ['Cliente', project?.client],
    ['Moneda', project?.currency || 'USD'],
    ['Deadline', project?.deadline || 'No definido'],
  ], 52);

  // Stages
  if (stages && stages.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.ink);
    doc.text('Etapas del proyecto', 14, y);
    y += 6;
    const stageBody = stages.map(s => [
      s.name,
      s.status === 'done' ? '✓ Completada' : s.status === 'progress' ? '◷ En progreso' : s.status === 'review' ? '○ Revisión' : '— Pendiente',
    ]);
    doc.autoTable({
      startY: y,
      head: [['Etapa', 'Estado']],
      body: stageBody,
      ...tableStyles,
      columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 72 } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Line items
  if (lineItems.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.ink);
    doc.text('Desglose de costos', 14, y);
    y += 6;
    const body = lineItems.map(i => [
      i.description || '—',
      i.category || '—',
      { content: `${i.hours || 0}h`, styles: { halign: 'right' } },
      { content: money(i.rate), styles: { halign: 'right' } },
      { content: money(i.amount), styles: { halign: 'right' } },
    ]);
    doc.autoTable({
      startY: y,
      head: [['Descripción', 'Cat', 'Horas', 'Tarifa', 'Monto']],
      body,
      ...tableStyles,
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 24 }, 2: { cellWidth: 24 }, 3: { cellWidth: 32 }, 4: { cellWidth: 32 } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Summary box
  const totalCost = lineItems.reduce((s, i) => s + (i.amount || 0), 0);
  const budget = project?.budget || 0;
  const total = budget + (bufferAmount || 0);
  const margin = total - totalCost;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.ink);
  doc.text('Resumen financiero', 14, y);
  y += 6;

  const summary = [
    ['Presupuesto base', money(budget), C.ink],
    [`Buffer (${project?.buffer_percent || 20}%)`, money(bufferAmount || 0), C.ink],
    ['Total presupuesto', money(total), C.green],
    ['Costo real', money(totalCost), C.red],
    ['Margen', money(margin), margin >= 0 ? C.green : C.red],
  ];

  const sBody = summary.map(([label, value, color]) => [
    { content: label, styles: { fontStyle: 'bold' } },
    { content: value, styles: { halign: 'right', textColor: color } },
  ]);

  doc.autoTable({
    startY: y,
    body: sBody,
    ...tableStyles,
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 52 } },
  });

  drawFooter(doc, page);
  doc.save(`presupuesto-${project?.name || 'proyecto'}.pdf`);
}
