// Telegram notification helper for WorkApp
// Uses native fetch (Node 18+)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function enabled() {
  return !!(BOT_TOKEN && CHAT_ID);
}

async function send(msg) {
  if (!enabled()) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: msg,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) console.error('[notify] Telegram error:', await res.text());
  } catch (e) {
    console.error('[notify] Failed:', e.message);
  }
}

// ─── Event templates ────────────────────────────────────────────

function projectCreated(project) {
  return send(
    `🆕 <b>Nuevo proyecto</b>\n` +
    `<b>${escape(project.name)}</b>\n` +
    `${project.client ? `👤 Cliente: ${escape(project.client)}\n` : ''}` +
    `${project.budget ? `💰 Presupuesto: $${Number(project.budget).toLocaleString()}\n` : ''}` +
    `${project.deadline ? `📅 Deadline: ${project.deadline}\n` : ''}`
  );
}

function taskCompleted(task, projectName) {
  return send(
    `✅ <b>Tarea completada</b>\n` +
    `<b>${escape(task.title)}</b>\n` +
    `📁 Proyecto: ${escape(projectName)}\n` +
    `${task.estimated_hours ? `⏱ ${task.estimated_hours}h · ` : ''}` +
    `${task.category ? `${task.category}` : ''}`
  );
}

function invoiceOverdue(invoice, projectName) {
  return send(
    `🚨 <b>Factura vencida</b>\n` +
    `<b>#${escape(invoice.number || invoice.id.toString())}</b>\n` +
    `📁 Proyecto: ${escape(projectName)}\n` +
    `💵 Monto: $${Number(invoice.amount).toLocaleString()}\n` +
    `📅 Vencimiento: ${invoice.due_date}\n\n` +
    `<i>Revisar en Facturas →</i>`
  );
}

function deadlineNear(project) {
  return send(
    `⏰ <b>Deadline se acerca</b>\n` +
    `<b>${escape(project.name)}</b> — vence en 24h\n` +
    `${project.client ? `👤 ${escape(project.client)}\n` : ''}` +
    `<i>Revisar el progreso →</i>`
  );
}

// ─── Utils ──────────────────────────────────────────────────────

function escape(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const notify = {
  enabled,
  send,
  projectCreated,
  taskCompleted,
  invoiceOverdue,
  deadlineNear,
};
