# BUYUR Growth & Sales Panel

Internal Growth + Sales OS for BUYUR: Marketing → Campaign → Lead → Pipeline → Demo → Deal → Customer.
Next.js 15 (App Router, server actions) · TypeScript · Tailwind v4 · shadcn-style UI · Prisma + SQLite · Zod · dnd-kit.

## Local development

```bash
npm install
npm run dev        # creates .env, applies migrations, seeds demo data on first run
```
Open http://localhost:3000.

### Demo credentials (password for all: `Buyur2026!`)
| Role | Email |
|---|---|
| Admin / Growth Lead | admin@buyur.in |
| Sales | ahmet@buyur.in, selin@buyur.in |
| Marketing | ece@buyur.in |

### Scripts
- `npm run build` – production build · `npm run typecheck`
- `npm run db:migrate` – create a new migration (dev) · `npm run db:deploy` – apply migrations
- `npm run db:seed` – **wipes** and reloads demo data · `npm run db:reset`

## Environment variables (`.env.example`)
| Var | Purpose |
|---|---|
| `DATABASE_URL` | `file:./dev.db` locally, `file:/data/buyur.db` in production |
| `TZ` | `Europe/Istanbul` – "today/overdue" logic uses server time |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | first admin created on boot when the DB has no users |
| `SEED_ON_EMPTY` | `true` loads demo data on first boot instead |

Never commit `.env`; set production secrets with `fly secrets set`.

## Deploying to Fly.io
```bash
fly apps create buyur-growth-panel            # or: fly launch --no-deploy (keep fly.toml)
fly volumes create buyur_data --size 1 --region otp
fly secrets set ADMIN_EMAIL=you@buyur.in ADMIN_PASSWORD='a-strong-password'
fly deploy
```
- SQLite lives on the volume at `/data/buyur.db`. `scripts/start.sh` **refuses to start** if `/data` isn't a mounted volume (override only for throwaway machines with `ALLOW_EPHEMERAL_DB=true`).
- Each start runs `prisma migrate deploy`, then `scripts/boot.mjs` (WAL mode, first-admin bootstrap, persistence markers).
- **Persistence check:** `GET /api/health` returns `firstBootAt` and `bootCount`. After `fly machine restart` or a redeploy, `firstBootAt` must stay the same and `bootCount` must increase.
- Single instance only (`max_machines_running = 1`) — SQLite is one writer.

### Migration procedure
1. Locally: change `prisma/schema.prisma` → `npm run db:migrate -- --name <change>` → commit `prisma/migrations`.
2. `fly deploy` — migrations apply automatically at startup. Take a backup first for destructive changes.

### Backups
- Enable Fly volume snapshots (daily by default; `fly volumes snapshots list`).
- Ad-hoc copy: `fly ssh console -C "sqlite3 /data/buyur.db '.backup /data/backup.db'"` then `fly ssh sftp get /data/backup.db` (or install `sqlite3`; copying the file while idle also works with WAL checkpointed).
- Consider Litestream to S3 for continuous replication.

## Architecture notes
- **Authorization** is server-side: `requireModulePage()` in every page, `requireModule()` in every server action / route (`src/lib/permissions.ts`). Sales reps can edit only their own or unassigned leads.
- **Sessions:** random 256-bit token in an httpOnly cookie; only its SHA-256 is stored. Passwords use bcrypt (12 rounds). Login is rate-limited.
- **Activity log** (`Activity` model) powers dashboards, lead/business timelines and the activities page.
- **Lead score:** rules live only in `src/lib/lead-score.ts`.
- **Metrics** (KPIs, funnel, CPL/CAC/ROAS, weighted pipeline) are derived from raw rows in `src/lib/metrics.ts`; nothing is stored. Funnel is cohort-based using stage milestone timestamps (reaching a later stage counts earlier ones as passed).
- Denormalised lead fields (`score`, `nextFollowUpAt`, `searchKey`) are maintained only by `src/lib/lead-sync.ts`. Search is Turkish-character-insensitive.

## Projects mode (project management)
One click in the top bar (**Growth & Sales | Projects**) switches the whole panel to project management: own sidebar
(dark green), green accent, cooler canvas. Same data, same auth.

- **Overview** `/projects` – project cards by status with derived progress, team filter, recent activity
- **Project** `/projects/[id]` – drag & drop task board (To do / In progress / Done), status, owner, dates
- **My work** `/projects/my-work` – your open project tasks grouped by project
- **Timeline** `/projects/timeline` – start → due bars for the next weeks with progress fill

Visibility is enforced server-side (`canSeeProject` in `src/lib/permissions.ts`): every project has a team
(Everyone / Marketing / Sales). Admins see all; others see their team's projects, "Everyone" projects and ones they own.
Project tasks are normal tasks (they also appear under Tasks).
