# TMA Task Tracker — Architecture & Setup Guide

## Project Structure

```
tma-task-tracker/
├── shared/                     # Types + constants shared by both packages
│   ├── types/index.ts          # All domain types (Task, Project, User…)
│   └── constants/index.ts      # Validation rules, status labels, API paths
│
├── bot/                        # Telegram Bot (Grammy + Express)
│   └── src/
│       ├── index.ts            # Entry: bot init, Express server, webhook setup
│       ├── commands/index.ts   # /start /help /mytasks /projects /pending
│       ├── services/
│       │   ├── strapi.ts       # Typed Axios wrapper → all Strapi API calls
│       │   ├── notifications.ts# Group announcements + DMs (Thai text)
│       │   └── cron.ts         # Morning summary, deadline & overdue alerts
│       ├── webhooks/
│       │   └── strapi.ts       # POST /strapi-webhook ← Strapi lifecycle events
│       └── utils/
│           └── messages.ts     # All MarkdownV2 Thai message templates
│
└── mini-app/                   # Telegram Mini App (React + Vite)
    └── src/
        ├── App.tsx             # Auth gate + role-based router
        ├── lib/
        │   ├── api.ts          # All Strapi API calls (Axios, typed)
        │   └── validation.ts   # Client-side validation (mirrors Strapi rules)
        ├── stores/
        │   └── auth.ts         # Zustand: JWT + user, persisted
        ├── hooks/
        │   └── queries.ts      # TanStack Query hooks for all data + mutations
        └── pages/
            ├── staff/
            │   ├── SubmitTask.tsx   # 📷 Photo capture → preview → submit
            │   ├── Handover.tsx     # Send task to marketplace
            │   ├── Marketplace.tsx  # Browse & request pending tasks
            │   ├── CreateTask.tsx   # (to generate)
            │   ├── Dashboard.tsx    # (to generate)
            │   ├── Projects.tsx     # (to generate)
            │   ├── ProjectDetail.tsx# (to generate)
            │   └── TaskDetail.tsx   # (to generate)
            └── manager/
                ├── ReviewTask.tsx   # 🔒 Signed URL photo + approve/reject
                ├── Dashboard.tsx    # (to generate)
                ├── Approvals.tsx    # (to generate)
                └── CreateProject.tsx# (to generate)
```

---

## Data Flow

```
Mini App / Bot
      │
      │  JWT (Staff/Manager)
      ▼
Strapi v5 (API Gateway)
  ├── Validates input (Regex + minLength 5)
  ├── Enforces RBAC (Manager vs Staff)
  ├── Custom route controllers (submit, approve, reject, handover…)
  ├── Fires lifecycle webhooks → Bot
  └── Reads/writes to Supabase PostgreSQL
            │
            ├── task-proofs bucket (Supabase Storage, private RLS)
            │     └── Signed URLs generated only for Manager role
            └── Edge Function "bright-worker"
                  └── Cron every 1 min: cancel expired handover requests (30 min)
```

---

## Strapi Custom Routes Required

These must be created in `src/api/task/routes/custom.ts`:

| Method | Path | Controller | Who |
|--------|------|------------|-----|
| POST | `/api/tasks/:id/submit` | `submit` | Staff (owner) |
| POST | `/api/tasks/:id/approve` | `approve` | Manager |
| POST | `/api/tasks/:id/reject` | `reject` | Manager |
| POST | `/api/tasks/:id/handover` | `handover` | Staff (owner) |
| POST | `/api/tasks/:id/request-pickup` | `requestPickup` | Staff (member) |
| POST | `/api/tasks/:id/cancel-pickup` | `cancelPickup` | Staff (requester) |
| POST | `/api/tasks/:id/approve-pickup` | `approvePickup` | Manager |
| GET  | `/api/tasks/:id/signed-url` | `signedUrl` | Manager only |
| POST | `/api/auth/telegram` | `telegramAuth` | Public |
| POST | `/api/auth/telegram/register` | `telegramRegister` | Public |

---

## Bot Setup

```bash
cd bot
cp .env.example .env
# Fill in BOT_TOKEN, TELEGRAM_GROUP_CHAT_ID, STRAPI_URL, STRAPI_API_TOKEN

npm install
npm run dev           # Long polling (dev)
npm run build && npm start  # Webhook (prod)
```

**Strapi Webhook Config** (Admin → Settings → Webhooks → Add):
- URL: `https://your-bot.railway.app/strapi-webhook`
- Headers: `x-strapi-webhook-secret: <BOT_WEBHOOK_SECRET>`
- Events: `entry.create` + `entry.update` on `task` and `plugin::users-permissions.user`

---

## Mini App Setup

```bash
cd mini-app
cp .env.example .env
# VITE_STRAPI_URL=https://your-strapi.railway.app

npm install
npm run dev
npm run build   # → dist/ → deploy to Vercel/Netlify/Cloudflare Pages
```

Set Mini App URL in BotFather → Bot Settings → Menu Button → URL.

---

## Notification Matrix

| Event | Where | Who sees |
|-------|-------|----------|
| New task created | Group chat | Everyone |
| Task submitted for review | DM → Manager(s) | Manager only |
| Task approved (done) | Group chat | Everyone (text only, no photo) |
| Task rejected | DM → Staff | That staff member only |
| Handover available | Group chat | Everyone |
| Handover requested | DM → Manager(s) | Manager only |
| Handover cancelled/timeout | Group chat | Everyone |
| Account approved | DM → Staff | That staff member only |
| Morning summary (08:00) | Group chat | Everyone |
| Deadline warning (24h/2h) | Group chat | Everyone |
| Overdue alert | Group chat | Everyone |

**🔒 Proof photos are NEVER sent to the group — only via Signed URL to Manager dashboard.**
