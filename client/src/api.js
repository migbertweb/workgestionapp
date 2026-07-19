const BASE = '/api';

async function request(path, opts = {}) {
  const token = localStorage.getItem('workapp_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    headers,
    credentials: 'include',
    ...opts,
    headers: { ...headers, ...(opts.headers || {}) }
  });

  if (res.status === 401) {
    localStorage.removeItem('workapp_token');
    window.location.reload();
    throw new Error('Sesión expirada');
  }

  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Projects
  getProjects: () => request('/projects'),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  cloneProject: (id, include_line_items) => request(`/projects/${id}/clone`, { method: 'POST', body: JSON.stringify({ include_line_items }) }),

  // Stages
  getStages: (projectId) => request(`/stages/${projectId}`),
  createStage: (data) => request('/stages', { method: 'POST', body: JSON.stringify(data) }),
  updateStage: (id, data) => request(`/stages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStage: (id) => request(`/stages/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: (projectId) => request(`/tasks/${projectId}`),
  createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  // Line items
  getLineItems: (projectId) => request(`/line_items/${projectId}`),
  createLineItem: (data) => request('/line_items', { method: 'POST', body: JSON.stringify(data) }),
  updateLineItem: (id, data) => request(`/line_items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLineItem: (id) => request(`/line_items/${id}`, { method: 'DELETE' }),

  // Time entries
  getTimeEntries: (projectId) => request(`/time/${projectId}`),
  createTimeEntry: (data) => request('/time', { method: 'POST', body: JSON.stringify(data) }),
  deleteTimeEntry: (id) => request(`/time/${id}`, { method: 'DELETE' }),

  // Assumptions
  getAssumptions: (projectId) => request(`/assumptions/${projectId}`),
  createAssumption: (data) => request('/assumptions', { method: 'POST', body: JSON.stringify(data) }),
  deleteAssumption: (id) => request(`/assumptions/${id}`, { method: 'DELETE' }),

  // Rates
  getRates: (projectId) => request(`/rates/${projectId}`),
  updateRate: (id, data) => request(`/rates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Clients
  getClients: () => request('/clients'),
  createClient: (data) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

  // Invoices
  getInvoices: () => request('/invoices'),
  createInvoice: (data) => request('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id, data) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteInvoice: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),

  // Analytics
  getAnalytics: () => request('/analytics'),
  getMarketRates: () => request('/market_rates'),

  // Activity
  getActivity: (limit) => request(`/activity?limit=${limit || 30}`),
  getProjectActivity: (projectId) => request(`/projects/${projectId}/activity`),
};