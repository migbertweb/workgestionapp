import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const money = (n) => new Intl.NumberFormat('es-BR', { style: 'currency', currency: 'USD' }).format(n || 0);

function addHeader(doc) {
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('WorkApp', 14, 20);
}

function addFooter(doc, page) {
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Página ${page} · Generado el ${new Date().toLocaleDateString()}`, 14, 290);
}

// ─── Invoice PDF ────────────────────────────────────────────────
export function downloadInvoicePDF(invoice, project, lineItems = []) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let page = 1;

  addHeader(doc);
  doc.setTextColor(30, 41, 59);

  // Invoice info
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(`FACTURA ${invoice.number || `#${invoice.id}`}`, 14, 50);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Proyecto: ${project?.name || '—'}`, 14, 60);
  doc.text(`Cliente: ${project?.client || '—'}`, 14, 66);
  doc.text(`Fecha: ${new Date(invoice.created_at).toLocaleDateString()}`, 14, 72);
  doc.text(`Vence: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}`, 14, 78);
  doc.text(`Estado: ${invoice.status?.toUpperCase() || 'DRAFT'}`, 14, 84);

  // Items table
  if (lineItems.length > 0) {
    const rows = lineItems.map(i => [
      i.description || '—',
      i.category || '—',
      `${i.hours || 0}h`,
      money(i.rate),
      money(i.amount),
    ]);
    let y = 95;
    doc.autoTable({
      startY: y,
      head: [['Descripción', 'Cat', 'Horas', 'Tarifa', 'Monto']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      foot: [[{ content: 'TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: money(invoice.amount), styles: { fontStyle: 'bold' } }]],
    });
    y = doc.lastAutoTable.finalY + 10;

    // Notes
    if (invoice.notes) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('Notas:', 14, y);
      doc.text(invoice.notes, 14, y + 5);
    }
  } else {
    // Just total
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${money(invoice.amount)}`, 14, 100);
  }

  addFooter(doc, page);
  doc.save(`factura-${invoice.number || invoice.id}.pdf`);
}

// ─── Budget PDF ─────────────────────────────────────────────────
export function downloadBudgetPDF(project, lineItems, stages, bufferAmount) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  addHeader(doc);
  doc.setTextColor(30, 41, 59);

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(`PRESUPUESTO`, 14, 50);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Proyecto: ${project?.name || '—'}`, 14, 60);
  doc.text(`Cliente: ${project?.client || '—'}`, 14, 66);
  doc.text(`Moneda: ${project?.currency || 'USD'}`, 14, 72);

  let y = 82;

  // Stages summary
  if (stages && stages.length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Etapas', 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    stages.forEach(s => {
      doc.text(`• ${s.name} — ${s.status}`, 14, y);
      y += 6;
    });
    y += 4;
  }

  // Line items
  if (lineItems.length > 0) {
    const rows = lineItems.map(i => [
      i.description || '—',
      i.category || '—',
      `${i.hours || 0}h`,
      money(i.rate),
      money(i.amount),
    ]);
    doc.autoTable({
      startY: y,
      head: [['Descripción', 'Cat', 'Horas', 'Tarifa', 'Monto']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  const totalCost = lineItems.reduce((s, i) => s + (i.amount || 0), 0);
  const budget = project?.budget || 0;
  const total = budget + (bufferAmount || 0);
  const margin = total - totalCost;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen financiero', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Presupuesto base:          ${money(budget)}`, 14, y); y += 6;
  doc.text(`Buffer (${project?.buffer_percent || 20}%):        ${money(bufferAmount || 0)}`, 14, y); y += 6;
  doc.setTextColor(34, 197, 94);
  doc.text(`Total presupuesto:         ${money(total)}`, 14, y); y += 6;
  doc.setTextColor(239, 68, 68);
  doc.text(`Costo real:                ${money(totalCost)}`, 14, y); y += 6;
  doc.setTextColor(margin >= 0 ? 34 : 239, margin >= 0 ? 197 : 68, margin >= 0 ? 94 : 68);
  doc.setFont('helvetica', 'bold');
  doc.text(`Margen:                    ${money(margin)}`, 14, y);

  addFooter(doc, 1);
  doc.save(`presupuesto-${project?.name || 'proyecto'}.pdf`);
}
