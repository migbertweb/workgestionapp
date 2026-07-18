# WorkApp Agent

**Freelance Project Manager** — aplicación full-stack para control y seguimiento de proyectos freelance.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Express + sql.js (SQLite WASM) |
| Auth | bcryptjs + jsonwebtoken (JWT) + cookie-parser |
| Frontend | React 19 + Vite 6 + Tailwind v4 |
| Gráficos | Recharts |
| Kanban | @dnd-kit (drag & drop) |
| Iconos | Lucide React |

## Requisitos

- Node.js ≥ 18
- npm

## Instalación

```bash
cd /home/migbert/workapp-agent
npm install
cd client && npm install
```

## Arranque

```bash
# Terminal 1 — Backend (puerto 3001)
cd /home/migbert/workapp-agent && node server.js

# Terminal 2 — Frontend (puerto 5173)
cd /home/migbert/workapp-agent/client && npx vite --port 5173
```

Abrí `http://localhost:5173` en el navegador.

## Login

Credenciales por defecto: **admin** / **admin123**

Configurable con variables de entorno:
- `ADMIN_USER` — nombre de usuario (default: `admin`)
- `ADMIN_PASS` — contraseña (default: `admin123`)
- `JWT_SECRET` — secreto para tokens JWT (default: valor dev)

## Funcionalidades

### Dashboard
- KPIs: proyectos activos, presupuesto total, horas logueadas, ingresos
- Cards de proyectos recientes con progreso de etapas y tareas
- Acceso rápido a crear nuevo proyecto

### Proyectos
- CRUD completo de proyectos
- Cards clickeables que navegan al detalle
- Campo cliente con autocomplete (datalist desde DB)

### Detalle de Proyecto (5 tabs)
- **Resumen**: estado de etapas, asunciones
- **Kanban**: drag & drop de tareas entre columnas (Por Hacer / En Progreso / Revisión / Completado)
- **Tasklist**: tabla con prioridad, estado, horas, tarifa, total
- **Presupuesto**: líneas de costo con categorías, totales, breakdown por categoría
- **Tiempo**: timer en vivo + registro manual de horas

### Presupuestos
- Vista administrativa con tarifas editables por rol
- Asunciones del proyecto
- Márgenes (presupuesto + buffer vs costo real)
- **Exportar PDF**: botón Imprimir con CSS optimizado para papel

### Analytics
- 7 gráficos en tiempo real (auto-refresh 30s)
- Presupuesto por proyecto, horas por proyecto, estado de proyectos
- Estado de tareas, ingresos mensuales, costo por categoría
- **Market Rates**: tabla comparativa de 14 categorías freelance
- Comparación presupuesto vs mediana de mercado

### Clientes
- CRUD con métricas agregadas (proyectos y presupuesto total por cliente)

### Facturas
- CRUD con estados: borrador, enviada, pagada, vencida

### Extras
- **Dark/light toggle**: botón en sidebar, persiste en localStorage
- **Menú hamburger**: responsive ≤768px, sidebar se oculta, navegación vía overlay
- **Toast notifications**: feedback visual en acciones
- **Timer de trabajo**: cronómetro en vivo por proyecto
- **Favicon personalizado**: SVG con logo W

## Autenticación

Arquitectura DIY JWT con 3 dependencias puras JS (sin compilación nativa):

| Archivo | Rol |
|---|---|
| `auth.js` | `seedAdmin()`, middleware `requireAuth`, rutas login/register/logout/me |
| `client/src/AuthContext.jsx` | React context: `login()`, `logout()`, `user`, chequeo de sesión |
| `client/src/pages/Login.jsx` | Pantalla de login |
| `client/src/api.js` | Adjunta token JWT a cada request, maneja 401 auto-redirect |

Flujo:
1. Al iniciar el backend, se crea automáticamente el usuario admin si no existe
2. Login → JWT firmado (7 días) → guardado en httpOnly cookie + localStorage
3. Todas las rutas `/api/*` requieren autenticación (excepto `/api/auth/*` y `/api/market_rates`)
4. Si el token expira o es inválido → 401 → frontend muestra login automáticamente

## API Endpoints

### Auth (público)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/auth/me` | Usuario actual |

### Proyectos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/projects` | Listar proyectos |
| GET | `/api/projects/:id` | Detalle de proyecto |
| POST | `/api/projects` | Crear proyecto |
| PUT | `/api/projects/:id` | Actualizar proyecto |
| DELETE | `/api/projects/:id` | Eliminar proyecto |

### Stages, Tasks, Line Items, Time Entries, Assumptions, Rates
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/stages/:projectId` | Etapas del proyecto |
| GET | `/api/tasks/:projectId` | Tareas del proyecto |
| GET | `/api/line_items/:projectId` | Líneas de costo |
| GET | `/api/time/:projectId` | Entradas de tiempo |
| GET | `/api/assumptions/:projectId` | Asunciones |
| GET | `/api/rates/:projectId` | Tarifas por rol |
| POST/PUT/DELETE | `/api/[resource]` | CRUD para cada recurso |

### Analytics (público)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/analytics` | Dashboard analytics |
| GET | `/api/market_rates` | Precios de mercado freelance |

## Estructura del proyecto

```
workapp-agent/
├── server.js              # Express server + API routes + auth middleware
├── db.js                  # sql.js wrapper (SQLite WASM, prepared statements)
├── auth.js                # JWT auth: seed admin, middleware, login/register/logout/me
├── package.json           # Dependencies
├── README.md              # Este archivo
├── workapp.db             # Base de datos SQLite (auto-creada)
└── client/
    ├── index.html
    ├── vite.config.js     # Proxy /api → localhost:3001
    ├── package.json
    └── src/
        ├── main.jsx       # Entry point (BrowserRouter + AuthProvider)
        ├── App.jsx        # Layout: sidebar, routes, theme toggle, toast, mobile hamburger, auth gate
        ├── api.js         # Fetch wrapper con JWT token y 401 handling
        ├── AuthContext.jsx # React auth context
        ├── roles.js       # Mapa de nombres de roles (dev→Desarrollador, etc.)
        ├── index.css      # Tailwind + CSS vars (dark/light) + print + responsive
        ├── components/
        │   ├── Modal.jsx
        │   └── ProjectForm.jsx
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── Projects.jsx
            ├── ProjectDetail.jsx
            ├── Budget.jsx
            ├── Analytics.jsx
            ├── Clients.jsx
            ├── Invoices.jsx
            └── Settings.jsx
```

## Responsive

- **Desktop (>768px)**: sidebar fija 240px, layout de 2 columnas en presupuestos
- **Mobile (≤768px)**: sidebar colapsa → header con hamburger ☰, overlay de navegación, single column, roles abreviados

## Arranque en producción

```bash
cd client && npm run build   # Build de Vite → client/dist/
cd .. && node server.js      # Express sirve el build en /
```

## Notas técnicas

- **sql.js** usa SQLite compilado a WASM — funciona en cualquier plataforma sin compilar módulos nativos
- **bcryptjs** es JS puro, NO `bcrypt` que requiere node-gyp y falla en Arch/CachyOS
- La DB persiste en `workapp.db` (export binario después de cada write con debounce 50ms)
- Vite proxy en desarrollo: `/api` → `http://localhost:3001`
- Animaciones CSS: `slideIn` para toasts, `transition` en hover states
- Las etapas default (Discovery, Presupuesto, Contrato, Ejecución, QA, Entregado) se crean automáticamente al crear un proyecto
