# FLITO

**Freight & Load Interchange for Truck Operations** — a digital freight matching platform connecting trucks with cargo to eliminate empty return trips in Nepal.

Shippers post loads. Truck owners bid on them. A booking is created when a bid is accepted, a driver is assigned, and both sides track the delivery to completion.

---

## Architecture

```
┌──────────────────────┐      HTTPS / WSS      ┌──────────────────────┐
│  Vercel (Frontend)   │ ─────────────────────▶│   Render (Backend)   │
│  Expo web build      │◀───────────────────── │  Express + Socket.io │
│  Android via EAS     │      JSON / WS        └──────────┬───────────┘
└──────────────────────┘                                  │ mongodb+srv
                                                          ▼
                                               ┌──────────────────────┐
                                               │  MongoDB Atlas (M0)  │
                                               └──────────────────────┘
```

One backend serves both the web app and the Android build. The three services are connected only by environment variables (API URL, socket URL, DB connection string, CORS allow-list).

**Stack:** React Native (Expo, web + Android) · Redux Toolkit · React Navigation · Express · Mongoose/MongoDB · Socket.io · JWT

---

## Repo structure

```
flito/
├── backend/
│   └── src/
│       ├── config/       database.js, validateEnv.js
│       ├── models/       User, Load, Quote, Booking, Payment
│       ├── controllers/  auth, loads, quotes, bookings
│       ├── routes/       auth, loads, quotes, bookings, admin, users
│       ├── middleware/   auth (+requireRole), errorHandler, validators
│       ├── socket/       events.js, handlers.js
│       └── server.js
└── frontend/
    └── src/
        ├── components/common/   Button, Card, Spinner, StatusBadge
        ├── screens/             auth, loads, bookings + shipper/ owner/ driver/
        ├── navigation/          Root, Auth, Tab, HomeStack
        ├── redux/               store + auth/user/loads/booking slices
        ├── services/            api, auth, socket, storage
        └── utils/               colors, constants, helpers, alert
```

Backend and frontend are independent npm projects in one repo, so Render and Vercel each build only their own folder via a "Root Directory" setting.

---

## Quick start (local)

**Prerequisites:** Node 18+, and a MongoDB connection string (see [MongoDB Atlas](#1-mongodb-atlas) below).

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env     # then edit .env — set MONGODB_URI and JWT_SECRET
npm run dev              # http://localhost:5000
```

```bash
# 2. Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env     # defaults already point at localhost:5000
npm run web              # http://localhost:8081
```

Check the backend is healthy: `curl http://localhost:5000/api/health` → `{"status":"ok"}`

### Tests

```bash
cd backend
npm test
```

46 API tests run against a real in-memory MongoDB (no external services, nothing to configure), covering auth and OTP handling, booking permissions, quote negotiation turn-taking, and fleet ownership scoping.

### Signing in during development

Auth is phone + OTP. In development (`NODE_ENV !== production`) the OTP is always **`123456`** and is also returned in the `/api/auth/send-otp` response for convenience. In production a random 6-digit code is generated and never returned in the response — wiring it to an SMS gateway (e.g. Sparrow SMS) is a prerequisite for launch. See [Known gaps](#known-gaps).

Phone numbers must match `+977XXXXXXXXXX`.

---

## Environment variables

| Variable | Where | Example |
|---|---|---|
| `MONGODB_URI` | backend `.env`, Render | `mongodb+srv://user:pass@cluster0.mongodb.net/flito` |
| `JWT_SECRET` | backend `.env`, Render | 32+ random chars (required in production) |
| `JWT_EXPIRE` | backend `.env`, Render | `7d` |
| `NODE_ENV` | backend `.env`, Render | `development` / `production` |
| `PORT` | backend `.env` | `5000` (Render injects its own — don't hardcode) |
| `FRONTEND_URL` | backend `.env`, Render | `https://flito.vercel.app` (required in production) |
| `SPARROW_SMS_TOKEN` | backend `.env`, Render | Sparrow SMS API token (required in production) |
| `SPARROW_SMS_FROM` | backend `.env`, Render | Approved sender identity (required in production) |
| `REDIS_URL` | backend `.env`, Render | Optional — switches the OTP store to Redis |
| `EXPO_PUBLIC_API_URL` | frontend `.env`, Vercel | `https://flito-api.onrender.com/api` |
| `EXPO_PUBLIC_SOCKET_URL` | frontend `.env`, Vercel | `https://flito-api.onrender.com` |

Only `EXPO_PUBLIC_`-prefixed vars are exposed to Expo client code. Never commit real values — only `.env.example` is tracked.

The backend validates its config at boot and exits with a clear message if something required is missing, rather than failing later with opaque 500s.

---

## Roles and flows

| Role | Can do |
|---|---|
| **shipper** | Post loads, review quotes, accept/reject, track bookings, rate the owner |
| **owner** | Browse open loads, submit quotes, assign drivers, track jobs won |
| **driver** | View assigned jobs, update pickup/delivery status, push GPS pings, view earnings |
| **admin** | Platform stats, KYC approve/reject, suspend users |

**Happy path:** shipper posts a load → owner submits a quote → shipper accepts → **booking created** → owner assigns a driver by phone → driver marks picked up → delivered → booking completes → both parties rate each other.

Admins cannot be created through public signup (the signup validator only accepts shipper/owner/driver) — promote a user directly in the database.

---

## API reference

All routes except `/api/health` require `Authorization: Bearer <jwt>`.

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | Health check (used by Render) |
| POST | `/api/auth/send-otp` | — | Send login/signup OTP |
| POST | `/api/auth/signup` | — | Verify OTP, create account |
| POST | `/api/auth/login` | — | Verify OTP, return JWT |
| GET | `/api/auth/me` | any | Current user |
| POST | `/api/loads` | shipper | Post a load |
| GET | `/api/loads` | any | Open loads, or `?mine=true` for own |
| GET | `/api/loads/:id` | any | Load detail |
| GET | `/api/loads/:id/quotes` | shipper | Quotes on own load |
| PATCH | `/api/loads/:id/cancel` | shipper | Cancel own load |
| POST | `/api/quotes` | owner | Submit a quote |
| GET | `/api/quotes/mine` | owner | Own submitted quotes |
| PATCH | `/api/quotes/:id/accept` | party without the standing offer | Accept → creates booking |
| PATCH | `/api/quotes/:id/reject` | either party | Reject |
| PATCH | `/api/quotes/:id/counter` | either party | Counter-offer |
| GET | `/api/bookings` | any | Bookings for your role |
| GET | `/api/bookings/:id` | party | Booking detail |
| PATCH | `/api/bookings/:id/assign-driver` | owner | Assign driver |
| PATCH | `/api/bookings/:id/status` | party | Update status |
| PATCH | `/api/bookings/:id/location` | driver | GPS ping |
| POST | `/api/bookings/:id/rate` | party | Rate after completion |
| GET | `/api/users/lookup?phone=` | owner/admin | Find a driver by phone |
| POST | `/api/trucks` | owner | Add a truck to your fleet |
| GET | `/api/trucks` | owner | Your fleet |
| PATCH | `/api/trucks/:id` | owner | Update truck details/status |
| PATCH | `/api/trucks/:id/driver` | owner | Assign/unassign the truck's driver |
| DELETE | `/api/trucks/:id` | owner | Remove a truck |
| GET | `/api/admin/stats` | admin | Platform metrics |
| GET | `/api/admin/kyc/pending` | admin | KYC queue |
| PATCH | `/api/admin/kyc/:userId` | admin | Approve/reject KYC |
| PATCH | `/api/admin/users/:userId/status` | admin | Suspend/ban/reactivate |

### Real-time (Socket.io)

Clients emit `join-room` with their JWT to join a private `user-<id>` room; the server verifies the token before joining. Server pushes: `new-quote`, `quote-updated`, `quote-accepted`, `booking-assigned`, `booking-status-changed`, `location-update`.

---

## Deployment

### 1. MongoDB Atlas

1. Create a free **M0** cluster (pick a region near your users — Mumbai/Singapore for Nepal).
2. **Database Access** → add a DB user with a strong password (not your Atlas login password). Use alphanumerics only, or URL-encode special characters in the connection string.
3. **Network Access** → allow `0.0.0.0/0`. Render's free tier uses dynamic outbound IPs, so a fixed allow-list isn't possible. This is safe as long as the DB user password is strong and the connection string is never exposed client-side.
4. **Connect → Drivers** → copy the `mongodb+srv://...` string, replace `<password>`, and add `/flito` before the `?` as the database name.

### 2. Backend → Render

1. New → Web Service → connect this repo. (A `render.yaml` blueprint is included.)
2. **Root Directory** `backend` · **Build** `npm install` · **Start** `npm start` · **Health check path** `/api/health`
3. Environment tab: set `MONGODB_URI`, `JWT_SECRET` (a *different* one from local), `JWT_EXPIRE=7d`, `NODE_ENV=production`. Leave `FRONTEND_URL` for step 4.
4. Deploy, then verify `https://<your-service>.onrender.com/api/health` returns `{"status":"ok"}`.

> **Free-tier caveat:** Render free services sleep after ~15 min idle and take 30–60s to wake. Acceptable for an MVP; ping `/api/health` every 10 min with a free cron service to keep it warm, or upgrade.

### 3. Frontend → Vercel

1. Add New Project → import this repo. **Root Directory** `frontend`.
2. Vercel picks up `frontend/vercel.json` (build `npm run build:web`, output `dist`, SPA rewrites).
3. Environment variables: `EXPO_PUBLIC_API_URL=https://<render-url>/api` and `EXPO_PUBLIC_SOCKET_URL=https://<render-url>`.
4. Deploy.

### 4. Close the loop — CORS

Back in Render, set `FRONTEND_URL` to your exact Vercel domain (https, no trailing slash) and save. **Skipping this blocks every API call with a CORS error even though both services are up.**

### 5. Android → EAS

```bash
npm install -g eas-cli
cd frontend
eas login
eas build:configure
eas build --platform android --profile preview
```

Set the production `EXPO_PUBLIC_*` values per-profile in `eas.json` — EAS builds run on Expo's servers and won't see your local `.env`.

### Deployment checklist

```
☐ /api/health returns 200 on the Render URL
☐ Vercel frontend loads with no CORS errors in the console
☐ Signup/login round-trips Vercel → Render → Atlas
☐ A new record appears in Atlas (Collections view)
☐ Socket.io shows "connected" in the browser console
☐ A real-time event reaches a second browser tab without refresh
☐ Android build hits the same backend and behaves identically
```

---

## Known gaps

These are deliberate MVP scope cuts, not oversights:

- **SMS needs an account.** The gateway integration is built (`src/services/sms.js`, Sparrow SMS), but until `SPARROW_SMS_TOKEN`/`SPARROW_SMS_FROM` are set, OTPs are only logged to the server console. Production refuses to boot without them, since undelivered codes mean nobody can log in. **This is the remaining hard blocker for a public launch.**
- **No file uploads.** KYC documents and load photos are modelled as URL strings, but there's no upload endpoint yet (needs Multer + object storage such as Cloudinary or S3, with size and type limits).
- **No payment integration.** `Payment` model and `khalti`/`esewa` enums exist; no gateway is wired up. Needs a merchant account.
- **Redis is optional, not required.** OTPs default to an in-memory `Map`, which is fine on a single instance but resets on redeploy. Set `REDIS_URL` to switch to the Redis backend (`src/services/otpStore.js`) before running more than one instance — you'll need to `npm install redis`.
- **Frontend has no automated tests.** The backend suite covers auth, permissions and negotiation; UI verification is still manual.
- **Trucks aren't linked to bookings.** A truck carries a default driver, but per-booking driver assignment happens on the booking itself; the specific truck used isn't recorded.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| CORS error in browser console | `FRONTEND_URL` on Render doesn't exactly match the Vercel domain (http vs https, trailing slash, or a preview URL) |
| 502/504 on first request | Render free instance waking from sleep — retry |
| MongoDB "Authentication failed" | Special characters in the DB password need URL-encoding in `MONGODB_URI` |
| Backend exits immediately at boot | Missing `MONGODB_URI`/`JWT_SECRET` — the error message names the variable |
| Socket connects then drops | socket.io client/server major versions mismatched, or `transports: ['websocket']` not forced |
| 404 refreshing a non-root route on Vercel | Missing `rewrites` in `frontend/vercel.json` |
| EAS build can't see env vars | `EXPO_PUBLIC_*` must be set in `eas.json` profiles, not just local `.env` |

---

## License

MIT
