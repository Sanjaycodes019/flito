# FLITO

[![CI](https://github.com/Sanjaycodes019/flito/actions/workflows/ci.yml/badge.svg)](https://github.com/Sanjaycodes019/flito/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Freight & Load Interchange for Truck Operations**: a truck booking platform for Nepal that connects people who need goods moved with verified truck owners and drivers, so trucks earn on the trip home instead of driving back empty.

Shippers post a load and say how many trucks it needs. Verified owners offer a price for each truck they can send, or the shipper asks a matched truck at their own price. Every accepted truck becomes its own booking: the owner assigns a driver, the driver works the trip from a one-button job screen, everyone follows the truck on a map, and the delivery ends with photos and the receiver's signature.

| | |
|---|---|
| **Web app** | [sanjay019.com.np](https://sanjay019.com.np) (also [flito.vercel.app](https://flito.vercel.app)) |
| **API** | `https://api.sanjay019.com.np/api` ([health](https://api.sanjay019.com.np/api/health)) |
| **Android** | APK and Play Store bundle built with EAS (see [Android](#5-android--eas)) |
| **Support** | guptagroups09@gmail.com · +977 9766382090 |

---

## Contents

- [Architecture](#architecture)
- [Repo structure](#repo-structure)
- [Quick start (local)](#quick-start-local)
- [Environment variables](#environment-variables)
- [The public site](#the-public-site)
- [Roles and flows](#roles-and-flows)
- [API reference](#api-reference)
- [Push notifications](#push-notifications)
- [Live tracking](#live-tracking)
- [Bilingual support](#bilingual-support)
- [Deployment](#deployment)
- [Known gaps](#known-gaps)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌────────────────────────────┐     HTTPS / WSS     ┌────────────────────────────┐
│  Vercel (web)              │ ──────────────────▶ │  Render (API)              │
│  sanjay019.com.np          │ ◀────────────────── │  api.sanjay019.com.np      │
│  Expo web build            │     JSON / WS       │  (flito.onrender.com)      │
├────────────────────────────┤                     │  Express + Socket.io       │
│  Android (EAS build)       │ ──────────────────▶ └─────────────┬──────────────┘
└────────────────────────────┘                                   │ mongodb+srv
                                                                 ▼
          Cloudinary (photos, documents) ◀── API ──▶   ┌────────────────────────┐
          Brevo (emails) · Expo (push)                 │  MongoDB Atlas         │
          OSRM (road distances)                        └────────────────────────┘
```

One backend serves the web app and the Android build. The services are joined only by environment variables (API and socket URLs, the database string, the CORS allow-list). Android builds made before the custom domain still call `flito.onrender.com`, which stays up.

**Stack:** React Native (Expo SDK 51, web + Android) · React Navigation · Redux Toolkit · i18next · Express · Mongoose / MongoDB · Socket.io · JWT · Cloudinary · Brevo · Expo push · Leaflet + OpenStreetMap · OSRM

---

## Repo structure

```
flito/
├── backend/
│   ├── src/
│   │   ├── config/       database, validateEnv, allowedOrigins, sentry, truckTypes
│   │   ├── models/       User, Truck, Load, Quote, Booking, Payment, Notification, AuditLog
│   │   ├── controllers/  auth, loads, quotes, bookings, deliveryProof, trucks, users, fleetDrivers
│   │   ├── routes/       auth, loads, quotes, bookings, trucks, users, locations, admin/*
│   │   ├── middleware/   auth (+requireRole), kyc (requireVerification), upload, validators, errorHandler
│   │   ├── services/     truckMatching, negotiation, loadSlots, bookingRelease, tripSchedule, routing,
│   │   │                 expiry, kycPolicy, pin, audit, push, email, storage, nepal* (address data) ...
│   │   ├── data/nepal/   provinces, districts, local levels, ward boundaries, place names (+ SOURCES.md)
│   │   ├── socket/       events, handlers
│   │   └── server.js / app.js
│   ├── scripts/          seedDemo, createAdmin, migrations, Nepal data builders
│   └── tests/            23 suites against an in-memory MongoDB
└── frontend/
    ├── src/
    │   ├── public/       landing page and the information pages (about, help, legal), their layout,
    │   │                 navbar, footer and page list (pages.js)
    │   ├── screens/      auth, home, loads, bookings, profile, settings + shipper/ owner/ driver/
    │   ├── admin/        the admin console: sections, list screens, record pages
    │   ├── components/   common (Button, Card, Modal, QuickToggles ...), loads, bookings, map, kyc ...
    │   ├── navigation/   Root (web addresses), Auth, Tab, Home and Profile stacks, role menus
    │   ├── i18n/         English and Nepali, one file per area (en/, ne/)
    │   ├── theme/        design tokens (brand palette, light + dark), icons
    │   ├── redux/        store + auth/user/loads/booking slices
    │   ├── services/     api, auth, socket, storage, push, uploads, theme and calendar preferences
    │   └── utils/        colors, constants, helpers, AD/BS calendar, load slots
    └── tests/            20 suites (Jest + React Native Testing Library)
```

Backend and frontend are independent npm projects in one repo, so Render and Vercel each build only their own folder through a "Root Directory" setting.

---

## Quick start (local)

**Prerequisites:** Node 18+ (CI uses Node 20), and a MongoDB connection string (see [MongoDB Atlas](#1-mongodb-atlas)).

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env     # then set MONGODB_URI and JWT_SECRET
npm run dev              # http://localhost:5000
```

```bash
# 2. Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env     # defaults already point at localhost:5000
npm run web              # http://localhost:8081
```

Check the backend: `curl http://localhost:5000/api/health` returns `{"status":"ok","db":"up","uptime":12}` (503 while the database is down).

### Tests

```bash
cd backend && npm test
```

**340 API tests in 23 suites** run against a real in-memory MongoDB (nothing to configure, no external service called). They cover email and password, phone and PIN, Google and admin sign-in; email verification, password reset and the language of emailed codes; PIN lockout; booking permissions and status changes; road distances and multi-day truck availability; ward and tole detection; offers, acceptance races and double-booking protection; loads that need several trucks; fleet drivers; ratings; expiry; file uploads; identity and truck verification; the admin lists, record pages, audit history and account suspension; the notification feed; CORS origins; security headers and query-operator stripping; and push notifications (Expo's API is mocked, no real push is sent).

```bash
cd frontend && npm test
```

**181 component tests in 20 suites** cover the sign-in screens (email, phone + PIN, language choice), posting a load, choosing trucks, offers on a load, booking status changes per role, KYC, the fleet page, profile and settings, the AD/BS calendar and date picker, the admin dashboard and record pages, and the public site (landing page, navbar, help search, legal pages, web addresses). Native modules and `services/api` are mocked; see `jest.setup.js`.

### Code quality

```bash
npm run lint            # in backend/ or frontend/ (ESLint)
npm run test:coverage   # coverage report
```

CI (`.github/workflows/ci.yml`) runs lint, `npm audit --audit-level=high` and the full test suite for both projects on every push and pull request. A pre-commit hook (Husky + lint-staged, installed by `npm install` at the repo root) lints staged files. See [CONTRIBUTING.md](CONTRIBUTING.md).

### Docker

```bash
docker compose up --build   # API on :5000 with a local MongoDB
```

### Demo data

With `MONGODB_URI` pointing at a real database:

```bash
cd backend
npm run seed
```

This creates an account for every role and a few loads with offers. Each logs in with password `Demo1234`: `admin@flito.demo`, `shipper@flito.demo`, `owner1@flito.demo`, `owner2@flito.demo`, `driver@flito.demo`. Each also has a phone number (`+9779800000000` to `+9779800000004`). Re-running is safe; nothing is duplicated.

### Signing in

There are four ways in, all issuing a JWT:

- **Phone + 4-digit PIN.** For the many users without email. Anyone can sign up with a phone number and PIN, a user can add a PIN in Settings, and an owner can add drivers to their fleet by name and phone (FLITO makes the driver's PIN). Obvious PINs (`1111`, `1234`) are refused. Every 5 wrong PINs lock PIN login, each lock twice as long as the last (15 minutes, 30, 60... up to a day). A forgotten PIN is reset by the driver's owner or by an admin after FLITO support checks who is calling. Without SMS the number itself isn't confirmed; identity verification is what ties an account to a real person.
- **Email + password.** Passwords need 8+ characters with a letter and a digit (the Sign Up page shows a live strength meter).
  - Email verification and password reset use a 6-digit code sent by Brevo and typed into the app. Codes are only ever emailed, never returned by the API, and only a hash is stored. A code expires after 15 minutes, works once, and stops after 5 wrong tries; a new one can be requested every 45 seconds.
  - Without `BREVO_API_KEY`/`BREVO_SENDER_EMAIL`, the email (code included) is printed to the backend console instead. The test suite never sends email.
- **Google.** Needs a Google OAuth client ID (see below). "Continue with Google" on Log In logs an existing account straight in, or carries the verified Google sign-in over to Sign Up so only a role is asked. "Sign up with Google" on Sign Up logs in with "Welcome back" if the account already exists. A Google account whose email already has a FLITO account is linked, not duplicated.
- **Admin portal** (`/admin-access`). Separate from the public log in: it needs the server's `ADMIN_ACCESS_KEY` on top of the email and password, answers every failure with the same message, and allows 5 attempts per 15 minutes. With no key set the portal is closed. Admins can also be created from the command line:

```bash
cd backend
npm run create-admin -- admin@example.com SomePassword123 Sita Sharma
```

Public sign-in routes allow 20 attempts per 15 minutes per address. Phone numbers must match `+977XXXXXXXXXX`.

#### Google sign-in setup

1. [Google Cloud Console](https://console.cloud.google.com/): create (or pick) a project.
2. **APIs & Services > OAuth consent screen**: choose **External**, fill in the app name and support email, and add your own Google account under **Test users** while the app is unpublished.
3. **APIs & Services > Credentials > Create credentials > OAuth client ID > Web application.**
4. Under **Authorized JavaScript origins** and **Authorized redirect URIs** add `http://localhost:8081` and each deployed web address (`https://sanjay019.com.np`, `https://flito.vercel.app`).
5. Put the **Client ID** in both `GOOGLE_CLIENT_ID` (backend) and `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (frontend), then restart both. The client secret isn't needed: the app requests an ID token and the backend verifies it against the client ID.

A standalone Android build additionally needs an **Android** OAuth client ID registered with the build's SHA-1 fingerprint.

---

## Environment variables

**Backend** (`backend/.env` locally, the Render dashboard in production):

| Variable | Example / notes |
|---|---|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.mongodb.net/flito` (required) |
| `JWT_SECRET` | 32+ random characters (required) |
| `JWT_EXPIRE` | `7d` |
| `NODE_ENV` | `development` / `production` |
| `PORT` | `5000` locally; Render injects its own |
| `FRONTEND_URL` | Web origins allowed by CORS and Socket.io, comma-separated: `https://sanjay019.com.np,https://flito.vercel.app` (required in production) |
| `BACKEND_URL` | This API's own address |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | Verification and reset emails (required in production) |
| `BREVO_SENDER_NAME` | `FLITO` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Photo and document storage. The secret stays on the server |
| `GOOGLE_CLIENT_ID` | Google OAuth Web client ID. Optional |
| `ADMIN_ACCESS_KEY` | Key required by the admin portal. Blank keeps it closed |
| `OSRM_URL` | Your own OSRM server for road distances. Optional: blank uses the public demo server, `off` uses straight-line estimates |
| `SENTRY_DSN` | Error tracking. Optional |
| `LOG_LEVEL` | `debug` / `info` / `warn` / `error` (default `info`). Logs are structured JSON (pino) |
| `ESEWA_*`, `KHALTI_*`, `SPARROW_SMS_*` | Placeholders in `.env.example`; no payment gateway or SMS is wired up yet |

**Frontend** (`frontend/.env` locally, Vercel for the web, `eas.json` for Android):

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://api.sanjay019.com.np/api` |
| `EXPO_PUBLIC_SOCKET_URL` | `https://api.sanjay019.com.np` |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Same Google Web client ID as the backend. Optional |
| `EXPO_PUBLIC_SUPPORT_PHONE` | `+9779766382090`: the Call support button (forgotten PIN), the footer and the Contact page. Blank hides it |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | `guptagroups09@gmail.com`: the footer and the Contact page. Blank hides it |

Only `EXPO_PUBLIC_`-prefixed variables reach the app, and they are built in: after changing one on Vercel, redeploy. Only `.env.example` files are committed. The backend checks its config at boot and exits with a message naming anything required that is missing.

---

## The public site

Signed-out web visitors land on a public site instead of a bare log in page. One list, `frontend/src/public/pages.js`, drives its navbar, footer, the Settings rows and the web addresses.

| Page | Address | What it covers |
|---|---|---|
| Landing | `/` | The empty-return problem, how it works per role, features, routes and border points, example journeys (labelled as examples, not customer stories), trust, common questions |
| How it works | `/how-it-works` | Each role's steps and what they need, a booking's statuses, how prices are agreed, cancelling |
| Safety & trust | `/safety` | What is verified, account safety, tips per role, banned goods, Nepal's emergency numbers |
| About us | `/about` | What FLITO is and isn't, who it's for, values, what works today and what's next |
| Our mission | `/mission` | Why FLITO exists |
| Help center | `/help` | Searchable answers by topic (`/help?topic=offers` opens one topic) |
| Contact us | `/contact` | Support phone and email (from the variables above), what to write about |
| Terms of Service | `/terms` | The rules, matching how the app actually works |
| Privacy Policy | `/privacy` | What is collected, who sees it, the services used, your rights |

**Where they show:**

- **Web, signed out:** the full site, with a sticky navbar (a slide-in menu on phones) and footer. A first-time visitor sees it in Nepali with a bilingual language banner.
- **Signed in:** `/` is the dashboard instead. The same pages sit in **Settings → Help & support / About FLITO / Legal**, inside the app's own navigation and without the marketing chrome. `/terms` and the rest keep one address whether you are signed in or not, so a shared link always works.
- **Android, signed out:** no landing page (the language choice comes first, then Log In); the pages open from the links at the foot of the log in pages.
- Sign Up's "Terms of Service" and "Privacy Policy" open those pages, and "Join as a truck owner" links (`/signup?role=owner`) arrive with the role chosen. The log in pages and the laptop sidebar carry an About · Help · Terms · Privacy row.

The Terms show a "last updated" date in the reader's calendar, set by `LEGAL_UPDATED` in `frontend/src/public/content.js`. Change it with every edit to the legal text.

---

## Roles and flows

| Role | Can do |
|---|---|
| **shipper** | Post loads for 1 to 10 trucks, choose from ranked truck matches, ask a truck at their own price, accept owners' offers, stop with "Enough Trucks", track bookings, rate the owner |
| **owner** | List trucks with a base, service area and rates; offer on loads with one or more trucks; answer shippers' requests; add drivers by phone; assign drivers; track jobs; rate the shipper |
| **driver** | Log in with phone + PIN, see the job on one screen, tap arrived / loaded / delivered, share location while in transit, take delivery photos and the receiver's signature, see earnings |
| **admin** | Browse and filter every user, truck, load and booking; open each one's page with its full history; approve, reject or revoke identity and truck verification; suspend, ban or reactivate accounts; cancel a load or a booking; reset a PIN |

**Happy path:** a shipper posts a load (goods, weight, pickup and drop-off, pickup day, how many trucks) → owners offer a price per truck, or the shipper asks a matched truck at their price → the other side accepts or declines → each acceptance books one truck as its own booking, with its regular driver if verified → the driver marks arrived, picked up, delivered, with photos and a signature → the booking completes → shipper and owner rate each other.

**Offer rules** (`backend/src/services/negotiation.js`, `quotesController.js`): either side opens. An owner applies with one or more of their trucks, each truck becoming its own offer at the same price, never more trucks than the load still needs and each truck once. A shipper can request a matched truck at their own price, with as many requests waiting as the trucks still needed plus two spare. The other side accepts or declines at that price: **there is no bargaining** (quotes from when counter-offers existed are still read). Only verified owners can offer or accept. A load takes offers until the end of its pickup day in Nepal time (at least 12 hours after posting), and an offer stays open 48 hours but never past its load. Acceptance reserves the truck's trip days and claims a slot on the load in conditional updates, so neither can be booked twice when acceptances race. When every slot is filled, or the shipper taps "Enough Trucks", the remaining offers close.

**Loads that need several trucks** (`backend/src/services/loadSlots.js`): a load can need up to 10 trucks, its weight split evenly. Each truck is a slot, and each accepted truck is its own booking with its own driver, payment and delivery proof. A cancelled booking gives its slot back and puts the load back on the market while there is still time (`services/bookingRelease.js`). Loads posted before slots existed count as one truck.

**Truck matching** (`backend/src/services/truckMatching.js`): a truck is a candidate only if it is active, its owner is verified and active, it carries at least its share of the load, both stops are inside its service area (anywhere in Nepal, or only its base province or district), and it isn't booked on any day the trip needs. Candidates score out of 100: how well the load fills the truck (30), how close its base is to the pickup (25), the owner's rating (smoothed so one review can't dominate) and completed trips (20), asking price against the cheapest (15), and readiness: a verified driver on it, current insurance, an admin-verified truck (10). The strongest signals are shown to the shipper as reasons.

#### Trip length and availability

A booking blocks its truck for every day the trip needs, not just the pickup day. The number of days comes from the road distance (`backend/src/services/tripSchedule.js`): a loaded truck is planned at 28 km/h plus 2 hours for loading and unloading, with at most 10 driving hours a day. So Kathmandu to Pokhara (about 200 km) is 1 day and Kathmandu to Nepalgunj (about 530 km) is 3. The days are reserved together in one conditional update, so two bookings can't overlap, and cancelling or completing frees them all. The return trip isn't blocked, so an owner can pick up a load on the way back.

**Truck listings** follow how trucks are described in Nepal: the trade's classes (pickup, mini truck, light truck or canter, 6, 10 and 12-wheeler, trailer) with common makes and models, body type, year, fuel, cargo bed size in feet, and extras shippers ask about (tarpaulin, a helper or khalasi, GPS, hill roads). Papers (chassis and engine numbers, bluebook tax, insurance, pollution test green sticker) stay private to the owner; shippers only see whether the insurance is current, and the fleet page flags papers that have lapsed or end within 30 days. Registration numbers stay private until a booking is made. Distances are real road distances from OpenStreetMap roads (OSRM), falling back to the straight-line distance times 1.4 if the routing server can't be reached (the app then says "about").

**Pricing:** each truck can carry a rate per km and a minimum charge. Its asking price is the rate times the distance, rounded to the nearest Rs. 100 and never below the minimum. A truck without a rate shows no price and the shipper names one. Joining and using FLITO is free; the shipper pays the owner directly for now (see [Known gaps](#known-gaps)).

**Fleet drivers:** an owner adds a driver with a name and phone number; FLITO makes a 4-digit PIN shown once to the owner. The owner's photo of the driver's license goes straight to admin review, and a driver can only be assigned to a booking once approved. Owners can reset a driver's PIN.

**Identity verification (KYC):** every account uploads at least one complete identity document: citizenship card (front and back), national ID (front and back), driving license, or passport (photo page). Owners also add a PAN certificate (company registration optional); drivers add a driving license, which counts as their identity document. An address is required before submitting. Documents are stored privately in Cloudinary and shown only through links that expire after 10 minutes. Once submitted they're frozen; an admin approves, or rejects with a reason the user sees, and the user can fix and resubmit. An admin can also revoke a verification later. A verified name can't be edited.

**What verification unlocks** (`backend/src/services/kycPolicy.js`): owners must be verified to offer or accept, and drivers before they can be assigned to a booking. Browsing, posting loads and every shipper action need no verification.

**Verified badge:** a rounded amber seal shows beside anyone whose identity an admin approved, and any truck an admin verified, on profiles, matches, offers and bookings. Other users only ever get a yes or no `verified` (`backend/src/services/partyView.js`). To verify a truck, its owner uploads the bluebook and a photo showing its number plate (insurance optional) from My Fleet; changing the truck's class, body, capacity, make, model, year, chassis or engine number removes the badge until it's checked again.

**Address:** province, district, municipality and ward from official lists (7 provinces, 77 districts, 753 local levels, 6,743 wards), plus tole as free text. "Use Current Location" fills in the province, district and municipality from GPS using Survey Department boundaries, then the ward from OpenStreetMap's ward boundaries (6,696 of 6,743 wards mapped), and suggests a tole from about 18,000 named places. All of it is answered from data shipped with the server, so nothing is looked up online. Sources and licenses: `backend/src/data/nepal/SOURCES.md`.

**Admin console:** a sidebar of sections (users, loads, bookings, identity verification and trucks, the last two with a count of what is waiting for review) with filters, search and paging. Every user, truck, load and booking has its own page and web address, linked to each other, showing the full record, related records and an **audit history**: each admin action is written to an append-only `AuditLog` with who did it, what changed and the reason given to the person affected.

**Contact between parties:** phone numbers appear only on bookings, for the shipper, owner and driver on that booking (one-tap call buttons), and are hidden again if it is cancelled. They never appear on loads or offers.

---

## API reference

Routes marked `public` need no token; every other route needs `Authorization: Bearer <jwt>`.

**Auth**

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | Health check with database state (used by Render) |
| POST | `/api/auth/signup` | public | Email account (email, password, role, name, optional phone); emails a verification code |
| POST | `/api/auth/login` | public | Email + password |
| POST | `/api/auth/signup-phone` | public | Phone account (role, name, `+977` phone, 4-digit PIN) |
| POST | `/api/auth/pin-login` | public | Phone + PIN |
| POST | `/api/auth/google` | public | Verify a Google ID token, log in or create the account (`role` only for a new one) |
| POST | `/api/auth/admin/login` | public | Admin log in, needs `ADMIN_ACCESS_KEY` |
| POST | `/api/auth/admin/signup` | public | Create an admin, needs `ADMIN_ACCESS_KEY` |
| POST | `/api/auth/verify-email` | public | Confirm an email with its code |
| POST | `/api/auth/resend-verification` | any | Email a fresh verification code |
| POST | `/api/auth/forgot-password` | public | Email a reset code (same answer whether or not the account exists) |
| POST | `/api/auth/reset-password` | public | New password with the reset code |
| GET | `/api/auth/me` | any | Current user |

**Loads, offers and bookings**

| Method | Route | Role | Purpose |
|---|---|---|---|
| POST | `/api/loads` | shipper | Post a load: `goodsType`, `weight` (kg), `trucksNeeded` (1–10, default 1), optional `pickupDate` (YYYY-MM-DD, up to 14 days ahead), and `pickupLocation`/`dropoffLocation` as Nepal addresses with optional `coordinates`, `contactPerson` and `phone`. The server adds the display address, road `distanceKm` (`distanceSource`: `route` or `estimate`) and `tripDays` |
| GET | `/api/loads` | any | Open loads, or `?mine=true` for your own |
| GET | `/api/loads/:id` | any | Load detail |
| GET | `/api/loads/:id/quotes` | shipper | Offers on your load |
| GET | `/api/loads/:id/matches` | shipper | Trucks that can carry your load, best first, with score, reasons, asking price and any open offer |
| POST | `/api/loads/:id/requests` | shipper | Ask a matched truck at your price (`truckId`, `price`) |
| GET | `/api/loads/:id/my-trucks` | owner | Your trucks for a load, with why each can't carry it and its asking price |
| PATCH | `/api/loads/:id/cancel` | shipper | Cancel your load |
| PATCH | `/api/loads/:id/relist` | shipper | Reopen an expired load, optionally with a new `pickupDate` |
| PATCH | `/api/loads/:id/close` | shipper | "Enough Trucks": stop looking once some trucks are booked |
| POST | `/api/loads/:id/photos` | shipper | Up to 6 photos (multipart `photos`) |
| DELETE | `/api/loads/:id/photos/:photoId` | shipper | Remove a photo |
| POST | `/api/quotes` | owner (verified) | Offer on a load: `loadId`, `quotedPrice` (per truck), `truckIds` (one or more of your trucks) |
| GET | `/api/quotes/mine` | owner | Your offers and shippers' requests |
| PATCH | `/api/quotes/:id/accept` | the side that didn't make the offer | Accept: books that truck as a booking and reserves its days |
| PATCH | `/api/quotes/:id/reject` | either side | Decline, or withdraw your own offer |
| GET | `/api/bookings` | any | Bookings for your role |
| GET | `/api/bookings/:id` | party | Booking detail, with the parties' phone numbers |
| PATCH | `/api/bookings/:id/assign-driver` | owner | Assign a driver |
| PATCH | `/api/bookings/:id/status` | party | Update status / pickup and drop-off progress; shipper or owner may cancel while pending or confirmed |
| PATCH | `/api/bookings/:id/location` | driver | GPS ping, only while `in_transit` |
| POST | `/api/bookings/:id/rate` | party | Rate after completion (1–5, optional review) |
| POST | `/api/bookings/:id/delivery-proof` | driver | Up to 5 delivery photos |
| POST | `/api/bookings/:id/signature` | driver | The receiver's signature |

**Trucks, profile, fleet and verification**

| Method | Route | Role | Purpose |
|---|---|---|---|
| POST | `/api/trucks` | owner | Add a truck. Required: `registrationNumber`, `truckType` (`pickup`, `mini-truck`, `light-truck`, `6-wheeler`, `10-wheeler`, `12-wheeler`, `trailer`, `other`), `bodyType` (`open`, `covered`, `flatbed`, `tipper`, `tanker`, `refrigerated`), `capacity` (kg). Optional: make, model, year, fuel, cargo bed, features, base location, service area, `ratePerKm`, `minimumCharge`, and papers (chassis, engine, bluebook, insurance, green sticker dates) |
| GET | `/api/trucks` | owner | Your fleet |
| PATCH | `/api/trucks/:id` | owner | Update details, rates or status (`null` clears an optional field) |
| PATCH | `/api/trucks/:id/driver` | owner | Assign or unassign the truck's regular driver |
| DELETE | `/api/trucks/:id` | owner | Remove a truck (and its papers from storage) |
| POST | `/api/trucks/:id/documents` | owner | Upload a paper (multipart `document` + `type`: `bluebook`, `truck_photo`, `insurance`) |
| DELETE | `/api/trucks/:id/documents/:docId` | owner | Remove a paper before submitting |
| POST | `/api/trucks/:id/verification` | owner | Send the truck for review |
| GET | `/api/users/lookup?phone=` | owner/admin | Find a driver by phone |
| PATCH | `/api/users/me` | any | Edit your profile (name locks once KYC is submitted) |
| PATCH | `/api/users/me/pin` | any | Set or change your login PIN |
| GET | `/api/users/me/notifications` | any | Your notification feed, with unread count |
| POST | `/api/users/me/notifications/read` | any | Mark notifications read |
| PATCH / DELETE | `/api/users/me/push-token` | any | Register / unregister this device for push |
| POST / DELETE | `/api/users/me/avatar` | any | Upload (cropped square) / remove your profile photo |
| GET | `/api/users/me/drivers` | owner | Drivers you added |
| POST | `/api/users/me/drivers` | owner | Add a driver (name, phone); returns their PIN once |
| POST | `/api/users/me/drivers/:id/pin` | owner | Make a new PIN for your driver |
| POST | `/api/users/me/drivers/:id/license` | owner | Upload your driver's license and send them for review |
| GET | `/api/users/me/kyc` | shipper/owner/driver | Your verification status and documents |
| POST | `/api/users/me/kyc/documents` | shipper/owner/driver | Upload or replace a document (multipart `document` + `type`) |
| DELETE | `/api/users/me/kyc/documents/:docId` | shipper/owner/driver | Remove a document before submitting |
| POST | `/api/users/me/kyc/submit` | shipper/owner/driver | Send documents for review |
| GET | `/api/locations` | public | Provinces, districts and local levels with ward counts |
| POST | `/api/locations/detect` | any | Province, district, local level and ward at `{ lat, lng }`, plus a suggested tole |

**Admin** (all `admin`)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/admin/stats` | Platform counts for the dashboard and filter chips |
| GET | `/api/admin/users` | Users, newest first. Filters: `q`, `role`, `status`, `kycStatus`, `addedBy` |
| GET | `/api/admin/users/:userId` | One user: profile, verification with document links, activity counts, admin history |
| PATCH | `/api/admin/users/:userId/status` | Suspend / ban / reactivate, with a note. Effective on the user's next request; an admin can't change their own |
| POST | `/api/admin/users/:userId/reset-pin` | New PIN for a caller support has identified |
| GET | `/api/admin/trucks` | Trucks with owner and paper links. Filters: `q`, `status`, `ownerId`, `driverId` (`/pending` = review queue) |
| GET | `/api/admin/trucks/:truckId` | One truck: papers and expiry, area, rates, owner, driver, booked days |
| PATCH | `/api/admin/trucks/:truckId` | Approve, or reject with a reason |
| POST | `/api/admin/trucks/:truckId/revoke` | Take a verification back, with a reason |
| GET | `/api/admin/loads` | Every load whatever its status. Filters: `q`, `status`, `shipperId` |
| GET | `/api/admin/loads/:loadId` | One load: cargo, route, shipper, offers, bookings |
| POST | `/api/admin/loads/:loadId/cancel` | Take a load off the market before any truck is booked |
| GET | `/api/admin/bookings` | Every booking. Filters: `status`, `userId`, `truckId`, `loadId` |
| GET | `/api/admin/bookings/:bookingId` | One booking: parties and contacts, price, progress, proof, ratings |
| POST | `/api/admin/bookings/:bookingId/cancel` | Stop an undelivered booking; truck days and the load's slot are given back |
| GET | `/api/admin/kyc` | Verification submissions with document links. `?status=` pending (default) / approved / rejected, `q` (`/pending` = queue) |
| PATCH | `/api/admin/kyc/:userId` | Approve, or reject with a required reason |
| POST | `/api/admin/kyc/:userId/revoke` | Take a verification back, with a reason |

**Paging.** Admin lists take `?page=1&limit=20` (limit at most 50) and answer with their items plus `pagination: { page, limit, total, totalPages }`. A page past the end is empty, not an error.

**Suspended and banned accounts** are checked on every authenticated request, so a suspension locks the user out immediately, even with an unexpired token: `403` with code `AUTH_ACCOUNT_STATUS`, and the app signs them out. A token for a deleted account is a `401`.

**Errors** carry a stable `code` next to the English `message` (`backend/src/utils/respond.js`), so the app shows its own Nepali text for them. The app sends `Accept-Language` (`ne` or `en`), which picks the language of emailed codes.

### Real-time (Socket.io)

Clients emit `join-room` with their JWT to join a private `user-<id>` room; the server verifies the token first. Server events: `new-quote`, `quote-updated`, `quote-accepted`, `booking-assigned`, `booking-status-changed`, `location-update`, `delivery-proof-added`, `kyc-reviewed`, `truck-reviewed`, `notification`.

---

## Push notifications

Free, through Expo's push API: no Firebase or APNs setup. `backend/src/services/push.js` posts to `https://exp.host/--/api/v2/push/send` directly (the `expo-server-sdk` package ships an ESM-only build that breaks under Jest). The app registers a token on log in (`services/pushNotifications.js`) and unregisters it on log out.

A push goes out alongside the matching socket event for new offers, an accepted offer (and the ones it closed), a driver assigned, pickup, delivery, cancellation, delivery photos or a signature added, and verification decisions. Not for `location-update`, which fires every ~15 seconds during a trip. Every notification is also kept in the in-app feed (the bell).

**The web has no push** (browser push needs its own service worker); it stays live through Socket.io while the tab is open. Tapping a notification on Android opens the related load, booking or verification screen (`navigationRef.js`).

---

## Live tracking

Maps use **Leaflet + OpenStreetMap**: no API key, no billing. The same HTML (`frontend/src/components/map/mapHtml.js`) renders in a `WebView` on Android and an `iframe` on the web, so the map behaves the same on both.

- **Posting a load:** pickup and drop-off use the same province, district, municipality, ward and tole pickers as a profile address, filled from "Use Current Location" or the saved address. An exact point on the map is optional.
- **Tracking:** `TrackingMap` shows the pickup and drop-off pins plus a driver marker that moves live with `location-update` events, without resetting the viewer's pan or zoom.
- **Sharing:** while a booking is `in_transit`, the assigned driver can turn on "Share My Location". It samples every ~15 s / 25 m and sends it to the server, which keeps only the latest position on the booking and pushes it to the shipper and owner. Sharing stops when the driver leaves the screen; it is never a background broadcast. The server accepts a ping only while the booking is in transit and checks the coordinates are real.

---

## Bilingual support

Everything is usable in **English** and **नेपाली**, and the app starts in Nepali. On Android a new device opens on a language choice written in both languages; on the web the landing page shows a bilingual language banner until one is picked. The EN / ने and light/dark pill (`QuickToggles`) is in the header, the laptop sidebar and the log in pages, and Settings has the full choices. The choice is remembered on the device.

- **Every screen and label** is translated, in namespaced files at `frontend/src/i18n/locales/{en,ne}/<area>.json` (common, navigation, auth, home, loads, bookings, trucks, kyc, profile, admin, notifications, site, legal).
- **Server messages** carry a stable `code` the app translates (`frontend/src/i18n/serverMessages.js`), so the server never needs the caller's language.
- **Emailed codes** go out in the user's language (`backend/src/services/email.js`), falling back to English.
- **Calendar (A.D. or B.S.):** dates are shown and picked in either calendar, defaulting to B.S. in Nepali, with Devanagari months and digits. Dates are always stored and sent as A.D. `YYYY-MM-DD` (`frontend/src/utils/bsCalendar.js`).
- **Place names** (7 provinces, 77 districts, 753 local levels) render in Devanagari, from the same dataset as the ward counts.
- **Not translated:** free text people type (goods, toles, names) and a few deeply composed validation messages.

**Light and dark:** the whole app and site follow a light or dark palette built from the brand colours (Freight Amber `#FF9F00`, Deep Asphalt `#1E242B`, Velocity Teal `#00D2A2`, Industrial Chalk `#F4F6F8`, Midnight Cabin `#12161A`) in `frontend/src/theme/tokens.js`, with every text tone checked for WCAG AA contrast. "Match device" is the default.

---

## Deployment

### 1. MongoDB Atlas

1. Create a cluster (a region near Nepal: Mumbai or Singapore).
2. **Database Access:** add a database user with a strong password; URL-encode special characters in the connection string.
3. **Network Access:** allow `0.0.0.0/0` (Render's outbound IPs aren't fixed). Safe as long as the password is strong and the string never reaches the app.
4. **Connect → Drivers:** copy the `mongodb+srv://...` string, fill in the password, and add `/flito` before the `?`.

### 2. Backend → Render

1. New → Web Service → connect this repo. **Root Directory** `backend` · **Build** `npm install` · **Start** `npm start` · **Health check path** `/api/health`.
2. Set the backend variables above, with `NODE_ENV=production` and a `JWT_SECRET` different from local.
3. **Custom domain:** in Render's Settings → Custom Domains add `api.sanjay019.com.np` and point a CNAME at the service. The `*.onrender.com` address keeps working.
4. Check `https://api.sanjay019.com.np/api/health` returns `{"status":"ok"}`.

> On Render's free plan a service sleeps after ~15 minutes idle and takes 30–60 s to wake.

### 3. Web → Vercel

1. Add New Project → import this repo. **Root Directory** `frontend`. Vercel uses `frontend/vercel.json` (build `npm run build:web`, output `dist`, rewrites so every address loads the app).
2. Set the frontend variables above in Project → Settings → Environment Variables, then deploy (redeploy after any change).
3. **Domain:** add `sanjay019.com.np` in Project → Settings → Domains. `flito.vercel.app` keeps working.

### 4. Close the loop on CORS

Set `FRONTEND_URL` on Render to every web origin, comma-separated, https and no trailing slash: `https://sanjay019.com.np,https://flito.vercel.app`. **Skipping this blocks every API call with a CORS error even though both services are up.**

### 5. Android → EAS

```bash
npm install -g eas-cli
cd frontend
eas login
eas build --platform android --profile preview      # installable APK
eas build --platform android --profile production   # Play Store app bundle
```

EAS builds run on Expo's servers and never see your local `.env`: the API, socket and support values are set per profile in `frontend/eas.json`. The project id is already in `app.json`.

### Deployment checklist

```
☐ /api/health returns 200 on api.sanjay019.com.np
☐ The web app loads on sanjay019.com.np with no CORS errors in the console
☐ Sign up and log in round-trip web → API → Atlas
☐ Socket.io connects, and an event reaches a second tab without a refresh
☐ /terms, /help and the other pages open directly from their addresses
☐ The Contact page and footer show the support phone and email
☐ An Android build hits the same API and behaves the same
```

---

## Known gaps

Deliberate scope cuts and open items, not oversights:

- **No payments in the app.** The shipper pays the owner directly (cash or transfer). A `Payment` model and eSewa/Khalti settings exist, but no gateway is wired up; it needs a merchant account.
- **Phone numbers aren't confirmed by SMS.** Phone + PIN sign-up trusts the number typed; identity verification is what ties an account to a real person. `src/services/sms.js` and `otpStore.js` are kept, unused, for a later SMS feature.
- **The Terms and Privacy Policy need legal review.** They describe the product as built but name no registered company; have a lawyer in Nepal review them before launch.
- **Email needs Brevo in production.** Without `BREVO_API_KEY`/`BREVO_SENDER_EMAIL`, codes are only logged, and production refuses to boot.
- **Google sign-in needs an OAuth client ID** to be used end to end. Signature, audience and expiry are checked; the request `nonce` is not yet compared.
- **Accounts from before email login** (old phone + OTP accounts) have no way in unless a password or PIN is set for them. After deploying, run `npm run migrate-auth-indexes` once so accounts without a phone don't collide on an old index.
- **Truck paper dates are typed in.** Admins check the uploaded bluebook and photo, but the bluebook, insurance and green sticker dates owners enter aren't read from the documents.
- **Road distances use the public OSRM demo server by default:** real routes, cached, about one request a second. For real traffic run your own and set `OSRM_URL`. OSRM's car profile knows nothing about truck restrictions or seasonal closures.
- **Trip length is a plan, not tracking.** A delayed truck can overrun into a day it was booked for, and nothing models where a truck ends up after a job.
- **Push receipts aren't checked.** A dead push token is cleared on its next failed send rather than from Expo's delivery receipts.
- **Ward and tole data are volunteer-mapped.** 6,696 of 6,743 wards and 713 of 753 municipalities are complete in OpenStreetMap; near a ward border the answer can be the neighbour. Results are always shown as a suggestion to check.
- **The B.S. calendar table covers 2000 to 2090.** The last few years are projections that published calendars may adjust by a day; dates are stored as A.D., so only display could differ.
- **Native push is unverified on a real device.** The pipeline is built and the backend half is tested; check that a real push arrives on Android before relying on it.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| CORS error in the browser console | `FRONTEND_URL` on Render doesn't list the exact web origin (http vs https, trailing slash, or a Vercel preview URL) |
| 502/504 on the first request | The Render instance is waking from sleep; retry |
| MongoDB "Authentication failed" | Special characters in the password need URL-encoding in `MONGODB_URI` |
| Backend exits at boot | A required variable is missing; the message names it |
| Contact page says details are coming soon | `EXPO_PUBLIC_SUPPORT_PHONE`/`EXPO_PUBLIC_SUPPORT_EMAIL` aren't set on Vercel, or the site wasn't redeployed after setting them |
| Socket connects then drops | socket.io client and server major versions differ |
| 404 when refreshing a page on Vercel | Missing `rewrites` in `frontend/vercel.json` |
| An Android build can't reach the API or shows no support contacts | `EXPO_PUBLIC_*` values must be in the `eas.json` profile, not only the local `.env` |
| "Too many attempts" on log in | The sign-in rate limit (20 per 15 minutes; 5 for the admin portal) |

---

## License

MIT
