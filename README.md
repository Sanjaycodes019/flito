# FLITO

[![CI](https://github.com/Sanjaycodes019/flito/actions/workflows/ci.yml/badge.svg)](https://github.com/Sanjaycodes019/flito/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Freight & Load Interchange for Truck Operations**, a digital freight matching platform connecting trucks with cargo to eliminate empty return trips in Nepal.

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
│       ├── models/       User, Truck, Load, Quote, Booking, Payment, Notification
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
cp .env.example .env     # then edit .env and set MONGODB_URI and JWT_SECRET
npm run dev              # http://localhost:5000
```

```bash
# 2. Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env     # defaults already point at localhost:5000
npm run web              # http://localhost:8081
```

Check the backend is healthy: `curl http://localhost:5000/api/health` → `{"status":"ok","db":"up","uptime":12}` (503 when the database is down)

### Tests

```bash
cd backend
npm test
```

283 API tests run against a real in-memory MongoDB (no external services, nothing to configure), covering email/password signup and login, email verification, password reset, the language of emailed codes, booking permissions, real road distances and multi-day truck availability, ward and tole detection, quote negotiation turn-taking, competitive bidding and double-booking protection, rating averages, expiry, fleet ownership scoping, file uploads, KYC, identity verification gating, the admin lists (users, loads, bookings, review queues: paging, newest-first order, access) and account suspension, the in-app notification feed, security headers and query-operator stripping, and push notifications (Expo's API is mocked, no real push is ever sent by the suite).

```bash
cd frontend
npm test
```

123 component tests (Jest + React Native Testing Library) cover the app's core business logic at the UI layer: the login, signup, forgot/reset password and email verification screens (`AuthScreens`), the AD/BS calendar and date picker (`DateField`, `bsCalendar`), counter-offer negotiation turn-taking (`LoadDetailScreen`), the KYC upload/submit flow (`KycScreen`), and booking status transitions per role (`BookingDetailScreen`). `services/api` and native modules (location, image/document pickers, notifications, Google sign-in, the WebView-based map/signature canvases) are mocked. See `jest.setup.js`.

### Code quality

```bash
npm run lint            # in backend/ or frontend/ (ESLint)
npm run test:coverage   # coverage report
```

CI (`.github/workflows/ci.yml`) runs lint and the full test suite for both projects on every push and pull request. A pre-commit hook (Husky + lint-staged, installed by `npm install` at the repo root) lints staged files. See [CONTRIBUTING.md](CONTRIBUTING.md).

### Docker

```bash
docker compose up --build   # API on :5000 with a local MongoDB
```

### Demo data

Once `MONGODB_URI` points at a real database, load a demo account for every role plus a few loads with competing quotes:

```bash
cd backend
npm run seed
```

Every demo account logs in with password `Demo1234`: `admin@flito.demo`, `shipper@flito.demo`, `owner1@flito.demo`, `owner2@flito.demo`, `driver@flito.demo`. Each also has a phone number (`+9779800000000` to `+9779800000004`) so an owner can assign the demo driver by phone. Re-running is safe; nothing is duplicated.

### Signing in during development

Auth is **email + password** (or **Continue with Google**), issuing a JWT. Phone number is optional: collected at signup or later in Edit Profile, and used only for things like an owner assigning a driver, never to log in.

- **Passwords** need 8+ characters with at least one letter and one digit. The signup screen shows a live strength meter against that same rule.
- **Email verification** and **password reset** both use a random 6-digit code sent by email (Brevo) and typed into the app. A new account can use the app right away; Home shows a "Verify your email" prompt until it's confirmed. Changing your email in Edit Profile resets verification and emails the new address.
- Codes are only ever sent by email, never returned by the API, and only a hash is stored. A code expires after 15 minutes, works once, and stops working after 5 wrong tries. A new code can be requested every 45 seconds (the app shows the countdown). Resetting your password with an emailed code also confirms that email.
- With `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` set (backend `.env`), emails are really sent, in development too, so sign up with an inbox you can open. Without them, the email, code included, is printed to the backend console instead. The test suite never loads `.env`, so it never sends email.
- **Google sign-in** needs a Google OAuth client ID (see [Google sign-in setup](#google-sign-in-setup)). Until one is set, tapping the Google button explains it isn't available yet rather than failing. Once set, both pages handle either case:
  - **Log In page, "Continue with Google":** an existing account logs straight in. If that Google account has no FLITO account yet, the app moves to the Sign Up page with the Google sign-in already done, and only asks for a role before creating the account.
  - **Sign Up page, "Sign up with Google":** creates the account with the role picked on the page. If that Google account already has a FLITO account, it logs in and says "Welcome back" instead of failing.
  - A Google account whose email already belongs to an email/password account is linked to that account rather than duplicated.

Phone numbers, when given, must match `+977XXXXXXXXXX`.

#### Google sign-in setup

1. [Google Cloud Console](https://console.cloud.google.com/): create (or pick) a project.
2. **APIs & Services > OAuth consent screen**: choose **External**, fill in the app name and support email, and add your own Google account under **Test users** while the app is unpublished.
3. **APIs & Services > Credentials > Create credentials > OAuth client ID > Web application.**
4. Under **Authorized JavaScript origins** add `http://localhost:8081`. Under **Authorized redirect URIs** add `http://localhost:8081` as well (plus your deployed frontend URL later).
5. Copy the **Client ID** into both `GOOGLE_CLIENT_ID` (backend `.env`) and `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (frontend `.env`), then restart both servers. The client secret is not needed: the app requests an ID token and the backend verifies it against the client ID.

A standalone Android build (EAS) additionally needs an **Android** OAuth client ID registered with the build's SHA-1 fingerprint. The Web client above covers web and local testing.

---

## Environment variables

| Variable | Where | Example |
|---|---|---|
| `MONGODB_URI` | backend `.env`, Render | `mongodb+srv://user:pass@cluster0.mongodb.net/flito` |
| `JWT_SECRET` | backend `.env`, Render | 32+ random chars (required in production) |
| `JWT_EXPIRE` | backend `.env`, Render | `7d` |
| `NODE_ENV` | backend `.env`, Render | `development` / `production` |
| `PORT` | backend `.env` | `5000` (Render injects its own, don't hardcode) |
| `FRONTEND_URL` | backend `.env`, Render | `https://flito.vercel.app` (required in production) |
| `BREVO_API_KEY` | backend `.env`, Render | Brevo API key for verification and reset emails (required in production) |
| `BREVO_SENDER_EMAIL` | backend `.env`, Render | A sender address verified in Brevo (required in production) |
| `BREVO_SENDER_NAME` | backend `.env`, Render | `FLITO` |
| `GOOGLE_CLIENT_ID` | backend `.env`, Render | Google OAuth Web client ID, used to verify ID tokens. Optional |
| `OSRM_URL` | backend `.env`, Render | Your own OSRM routing server for road distances. Optional: defaults to the free public demo server, and `off` uses straight-line estimates only |
| `CLOUDINARY_CLOUD_NAME` | backend `.env`, Render | Cloudinary cloud name (file uploads) |
| `CLOUDINARY_API_KEY` | backend `.env`, Render | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | backend `.env`, Render | Cloudinary API secret, server only, never in the app |
| `SENTRY_DSN` | backend `.env`, Render | Sentry DSN for error tracking. Optional: blank disables it |
| `LOG_LEVEL` | backend `.env`, Render | `debug` / `info` / `warn` / `error` (default `info`). Logs are structured JSON (pino) |
| `EXPO_PUBLIC_API_URL` | frontend `.env`, Vercel | `https://flito-api.onrender.com/api` |
| `EXPO_PUBLIC_SOCKET_URL` | frontend `.env`, Vercel | `https://flito-api.onrender.com` |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | frontend `.env`, Vercel | Same Google OAuth Web client ID as the backend. Optional |

Only `EXPO_PUBLIC_`-prefixed vars are exposed to Expo client code. Never commit real values, only `.env.example` is tracked.

The backend validates its config at boot and exits with a clear message if something required is missing, rather than failing later with opaque 500s.

---

## Roles and flows

| Role | Can do |
|---|---|
| **shipper** | Post loads, choose from matching trucks, send and negotiate offers, track bookings, rate the owner |
| **owner** | List trucks with a base and rates, answer booking requests, quote on loads with a truck, assign drivers, track jobs won |
| **driver** | View assigned jobs, update pickup/delivery status, push GPS pings, view earnings |
| **admin** | Browse every user, load and booking (paged, newest first), review the KYC and truck-verification queues (approve/reject), suspend, ban or reactivate users |

**Happy path:** shipper posts a load (goods, weight, pickup and dropoff, pickup date) → picks a truck from the ranked matches and sends a price → owner accepts, counters or declines → on acceptance a **booking is created** with that truck, and its regular driver if verified → driver marks picked up → delivered → booking completes → both parties rate each other. Owners can also quote on open loads with one of their trucks.

**Truck matching** (`backend/src/services/truckMatching.js`): a truck is a candidate only if it is active, its owner is verified and active, its capacity covers the load's weight, both stops are inside its service area (anywhere in Nepal, or only its base province or district), and it isn't already booked on any day the trip needs (see [Trip length](#trip-length-and-availability)). Candidates are scored out of 100: how well the load fills the truck (30), how close its base is to the pickup (25), the owner's rating, smoothed so a single review can't dominate, and completed trips (20), asking price against the cheapest (15), and readiness: a verified driver already on the truck, insurance that is still current, and an admin-verified truck (10).

#### Trip length and availability

A booking blocks its truck for every day the trip needs, not just the pickup day. The number of days comes from the road distance (`backend/src/services/tripSchedule.js`): a loaded truck is planned at 28 km/h plus 2 hours for loading and unloading, with at most 10 driving hours a day. So Kathmandu to Pokhara (about 200 km) is 1 day and Kathmandu to Nepalgunj (about 530 km) is 3. The days are reserved together in one conditional update, so two bookings can't overlap on any of them, and cancelling or completing the booking frees them all. The return trip isn't blocked, so an owner can pick up a load on the way back.

**Truck listings** follow how trucks are described in Nepal: the freight trade's classes (pickup, mini truck, light truck or canter, 6, 10 and 12-wheeler, trailer) with common makes and models, body type, year, fuel, cargo bed size in feet, and extras shippers ask about (tarpaulin, a helper or khalasi, GPS, hill roads). Papers (chassis and engine numbers, bluebook tax, insurance, pollution test green sticker) stay private to the owner: shippers only ever see whether the insurance is current, and the owner's fleet page flags papers that have lapsed or end within 30 days. The strongest signals are shown to the shipper as reasons. Distances are real road distances from OpenStreetMap roads (OSRM), between municipality centres or pinned points, and fall back to the straight-line distance times 1.4 if the routing server can't be reached (the app then says "about").

**Pricing:** each truck can carry a rate per km and a minimum charge. The asking price for a trip is the rate times the estimated distance, rounded to the nearest Rs. 100 and never below the minimum. A truck without a rate shows no price and the shipper names one.

**Offer rules** (`backend/src/services/negotiation.js`): either side opens (a shipper's request to a truck, or an owner's quote with a truck), then they take turns. A counter must move toward the other side: a shipper offers less than the owner's price and more than their own last offer; an owner asks more than the shipper's offer and less than their own last price. A negotiation ends after 6 offers, when the last one must be accepted or declined. One live negotiation per owner per load, and at most 3 shipper requests waiting per load. Accepting books the load and the truck's pickup day atomically, so neither is ever booked twice, and closes every other offer on the load. A load takes offers until the end of its pickup day (at least 12 hours), offers stay open 48 hours (a counter restarts that) but never past their load, and cancelling or completing a booking frees the truck's day.

Admins cannot be created through public signup (the signup validator only accepts shipper/owner/driver). Use the script instead:

```bash
cd backend
npm run create-admin -- admin@example.com SomePassword123 Sita Sharma
```

**Identity verification (KYC):** every account uploads at least one complete identity document: citizenship card (front and back), National ID card (front and back), driving license, or passport (photo page). Once one is complete, the others are optional. Owners also add a PAN certificate (company registration optional) and drivers add a driving license, which counts as their identity document (citizenship, National ID and passport are optional for drivers). An address is required before submitting.

**Address:** every account can set a Nepal address from the Profile page: province, district, municipality and ward from official lists (7 provinces, 77 districts, 753 local levels, 6,743 wards), plus tole/village/area as free text. It's optional at sign-up and required before identity verification. "Use Current Location" fills in the province, district and municipality from the phone's GPS using Survey Department boundaries, then the ward from OpenStreetMap's ward boundaries (6,696 of the 6,743 wards are mapped), and suggests a tole from about 18,000 named places in OpenStreetMap. All of it is answered from data shipped with the server, so nothing is looked up online. The user always checks the result: the ward is left empty where it isn't mapped, and GPS can be tens of metres off near a boundary. Data sources and licenses are in `backend/src/data/nepal/SOURCES.md`. Documents are stored privately in Cloudinary and shown only through links that expire after 10 minutes. Once submitted they're frozen; an admin approves, or rejects with a reason the user sees, and the user can fix and resubmit. A verified name can't be edited.

**Verified badge:** a rounded amber seal with a white tick (`frontend/src/components/common/VerifiedBadge.js`) shows beside anyone whose identity an admin approved, and beside any truck an admin verified: on the profile and home greeting, truck matches, offers, and bookings. Other users only ever receive a yes or no `verified` for a person or truck (`backend/src/services/partyView.js`), never where a verification stands. To get a truck verified, its owner uploads the bluebook and a photo of the truck showing its number plate (the insurance paper is optional) from My Fleet and sends them for review; an admin approves or rejects with a reason from the Admin Dashboard. Changing the truck's class, body, capacity, make, model, year, chassis or engine number takes the badge away until it's checked again.

**What verification unlocks:** owners must be verified to submit, counter or accept quotes, and drivers must be verified before an owner can assign them to a booking. Shippers, browsing and posting loads need no verification. The rule lives in `backend/src/services/kycPolicy.js`.

---

## API reference

Routes marked `public` need no token; every other route requires `Authorization: Bearer <jwt>`.

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | Health check (used by Render) |
| POST | `/api/auth/signup` | public | Create an account (email, password, role, name, optional phone), return JWT and email a verification code |
| POST | `/api/auth/login` | public | Email + password, return JWT |
| POST | `/api/auth/google` | public | Verify a Google ID token, log in or create the account (`role` needed only for a new one) |
| POST | `/api/auth/verify-email` | public | Confirm an email with its 6-digit code |
| POST | `/api/auth/resend-verification` | any | Email a fresh verification code |
| POST | `/api/auth/forgot-password` | public | Email a reset code (same response whether or not the account exists) |
| POST | `/api/auth/reset-password` | public | Set a new password with the reset code, return JWT |
| GET | `/api/auth/me` | any | Current user |
| POST | `/api/loads` | shipper | Post a load: `goodsType`, `weight` (kg), optional `pickupDate` (YYYY-MM-DD, today to 14 days ahead; defaults to today), and `pickupLocation`/`dropoffLocation` as Nepal addresses (`provinceId`, `districtId`, `localLevelId`, `ward`, `tole`) with optional `coordinates`, `contactPerson` and `phone`. The server adds the display `address`, short `label`, the road `distanceKm` (with `distanceSource`: `route` or `estimate`) and `tripDays` |
| GET | `/api/loads/:id/matches` | shipper | Trucks that can carry own load, best match first, with score, reasons, asking price and any open offer |
| POST | `/api/loads/:id/requests` | shipper | Request a matched truck at a price (`truckId`, `price`) |
| GET | `/api/loads/:id/my-trucks` | owner | Own trucks for a load, with why each can't carry it and each one's asking price |
| GET | `/api/loads` | any | Open loads, or `?mine=true` for own |
| GET | `/api/loads/:id` | any | Load detail |
| GET | `/api/loads/:id/quotes` | shipper | Quotes on own load |
| PATCH | `/api/loads/:id/cancel` | shipper | Cancel own load |
| PATCH | `/api/loads/:id/relist` | shipper | Reopen an expired load, optionally with a new `pickupDate` |
| POST | `/api/loads/:id/photos` | shipper | Upload up to 6 photos (multipart field `photos`) |
| DELETE | `/api/loads/:id/photos/:photoId` | shipper | Remove a photo (also deleted from storage) |
| POST | `/api/quotes` | owner | Quote on a load with one of your trucks (`loadId`, `truckId`, `quotedPrice`) |
| GET | `/api/quotes/mine` | owner | Own quotes and booking requests from shippers |
| PATCH | `/api/quotes/:id/accept` | party without the standing offer | Accept → creates booking with the truck and reserves its day |
| PATCH | `/api/quotes/:id/reject` | either party | Decline, or withdraw your own offer |
| PATCH | `/api/quotes/:id/counter` | either party | Counter-offer within the offer rules |
| GET | `/api/bookings` | any | Bookings for your role |
| GET | `/api/bookings/:id` | party | Booking detail |
| PATCH | `/api/bookings/:id/assign-driver` | owner | Assign driver |
| PATCH | `/api/bookings/:id/status` | party | Update status |
| PATCH | `/api/bookings/:id/location` | driver | GPS ping (only while `in_transit`) |
| POST | `/api/bookings/:id/rate` | party | Rate after completion |
| POST | `/api/bookings/:id/delivery-proof` | driver | Upload up to 5 proof-of-delivery photos |
| POST | `/api/bookings/:id/signature` | driver | Capture (or replace) the recipient's delivery signature |
| GET | `/api/users/lookup?phone=` | owner/admin | Find a driver by phone |
| PATCH | `/api/users/me` | any | Edit own profile (name locks once KYC is submitted) |
| PATCH | `/api/users/me/push-token` | any | Register this device's Expo push token |
| DELETE | `/api/users/me/push-token` | any | Unregister on logout |
| POST | `/api/users/me/avatar` | any | Upload or replace the profile photo (multipart `avatar`, cropped to a square) |
| DELETE | `/api/users/me/avatar` | any | Remove the profile photo |
| GET | `/api/locations` | public | Nepal's provinces, districts and local levels with ward counts |
| POST | `/api/locations/detect` | any | Province, district, local level and ward (null where unmapped) at `{ lat, lng }`, plus a suggested tole |
| GET | `/api/users/me/kyc` | shipper/owner/driver | Own verification status and documents |
| POST | `/api/users/me/kyc/documents` | shipper/owner/driver | Upload or replace a document (multipart `document` + `type`) |
| DELETE | `/api/users/me/kyc/documents/:docId` | shipper/owner/driver | Remove a document before submitting |
| POST | `/api/users/me/kyc/submit` | shipper/owner/driver | Send documents for review |
| POST | `/api/trucks` | owner | Add a truck. Required: `registrationNumber`, `truckType` (`pickup`, `mini-truck`, `light-truck`, `6-wheeler`, `10-wheeler`, `12-wheeler`, `trailer`, `other`), `bodyType` (`open`, `covered`, `flatbed`, `tipper`, `tanker`, `refrigerated`), `capacity` (kg). Optional: `make`, `model`, `year`, `fuelType`, `cargoBed` (`lengthFt`, `widthFt`, `heightFt`), `features` (`tarpaulin`, `helper`, `gpsTracker`, `hillRoads`), `baseLocation` (province, district, municipality), `serviceArea` (`nepal`, `province`, `district`), `ratePerKm`, `minimumCharge`, and papers: `chassisNumber`, `engineNumber`, `bluebookRenewedUntil`, `insurance` (`type`, `company`, `policyNumber`, `validUntil`), `emissionTestValidUntil` (dates as YYYY-MM-DD) |
| GET | `/api/trucks` | owner | Your fleet |
| PATCH | `/api/trucks/:id` | owner | Update truck details, rates or status (`null` clears an optional field) |
| PATCH | `/api/trucks/:id/driver` | owner | Assign/unassign the truck's driver |
| DELETE | `/api/trucks/:id` | owner | Remove a truck (and its verification papers from storage) |
| POST | `/api/trucks/:id/documents` | owner | Upload or replace a verification paper (multipart `document` + `type`: `bluebook`, `truck_photo`, `insurance`) |
| DELETE | `/api/trucks/:id/documents/:docId` | owner | Remove a paper before submitting |
| POST | `/api/trucks/:id/verification` | owner | Send the truck and its papers for admin review |
| GET | `/api/admin/stats` | admin | Platform metrics |
| GET | `/api/admin/users` | admin | Every user, newest signup first, with role, account status and KYC status (paged) |
| GET | `/api/admin/loads` | admin | Every load whatever its status, newest first, with its shipper (paged) |
| GET | `/api/admin/bookings` | admin | Every booking, newest first, with its load, shipper, owner, driver and truck (paged) |
| GET | `/api/admin/kyc/pending` | admin | Submissions awaiting review, newest first, with 10-minute document links (paged) |
| PATCH | `/api/admin/kyc/:userId` | admin | Approve, or reject with a required reason |
| GET | `/api/admin/trucks/pending` | admin | Trucks awaiting verification, newest first, with their owner and 10-minute paper links (paged) |
| PATCH | `/api/admin/trucks/:truckId` | admin | Approve a truck, or reject it with a required reason |
| PATCH | `/api/admin/users/:userId/status` | admin | Suspend/ban/reactivate (`status`: `active`, `suspended`, `banned`). Takes effect on the user's very next request; an admin can't change their own |

**Paging.** Every admin list takes `?page=1&limit=20` (limit at most 50) and answers with its items plus `pagination: { page, limit, total, totalPages }`. A page past the end is empty, not an error.

**Suspended and banned accounts.** The server reads an account's status on every authenticated request, so a suspension or ban locks the user out immediately, even with a token that hasn't expired: they get `403` with code `AUTH_ACCOUNT_STATUS` (and the app signs them out). A token for a deleted account is a `401`.

**Language.** The app sends its language as a standard `Accept-Language` header (`ne` or `en`) on every request. It picks the language of the verification and reset-code emails; everything else the API returns is English plus a stable `code` (see [Bilingual support](#bilingual-support)).

### Real-time (Socket.io)

Clients emit `join-room` with their JWT to join a private `user-<id>` room; the server verifies the token before joining. Server pushes: `new-quote`, `quote-updated`, `quote-accepted`, `booking-assigned`, `booking-status-changed`, `location-update`, `kyc-reviewed`, `truck-reviewed`.

---

## Push notifications

Free, via Expo's push API. No Firebase/APNs setup, no paid account. `backend/src/services/push.js` posts directly to `https://exp.host/--/api/v2/push/send` (not the `expo-server-sdk` package, which currently ships an ESM-only build that breaks under Jest/CommonJS); the frontend registers a token on login (`services/pushNotifications.js`) and unregisters it on logout.

A push fires alongside the matching Socket.io event for: a new quote, a counter-offer, a quote accepted (winner) or superseded (losing bids), a driver assigned, pickup/delivery/cancellation, delivery photos or a signature added, and a KYC decision. Deliberately **not** on `location-update`, that fires every ~15s while a driver shares location, and would spam a device with a notification per ping.

**Web has no push** (browser push needs its own VAPID/service-worker setup, out of scope). `registerForPushNotifications()` is a no-op on web, and the web build stays live entirely through the existing Socket.io connection while its tab is open. Tapping a notification on Android deep-links to the relevant load, booking, or the KYC screen (`navigationRef.js`).

Before an EAS/standalone Android build (not needed for Expo Go testing), run `eas init` once to populate `app.json`'s EAS project id. `getExpoPushTokenAsync()` needs it for a reliable token outside of Expo Go.

---

## Live tracking

The pickup/dropoff map (on a load) and the live tracking map (on a booking) use **Leaflet + OpenStreetMap**, no API key, no billing account. The same HTML (`frontend/src/components/map/mapHtml.js`) renders inside a `WebView` on Android and an `iframe` on web (`MapCanvas.native.js` / `MapCanvas.web.js`, resolved automatically by the `.native`/`.web` filename convention), so the map behaves identically on both.

- **Posting a load:** the pickup and dropoff are chosen with the same province, district, municipality, ward and tole pickers as a profile address (`NepalAddressFields`), filled from "Use Current Location" or the shipper's saved address if they like. The map (`LocationPickerMap`) stays folded away under "Exact point on map" until the shipper opens it to pin a spot. Coordinates are optional. A load without them still works, it just won't render a tracking map later.
- **Tracking a booking:** `TrackingMap` shows static pickup/dropoff pins plus a driver marker that moves live as `location-update` socket events arrive, without reloading the map or resetting the viewer's pan/zoom.
- **Sharing location:** while a booking is `in_transit`, the assigned driver sees a "Share My Location" toggle (`LocationSharingToggle`). It samples position every ~15s/25m (`expo-location`) and PATCHes `/api/bookings/:id/location`, which persists it and pushes `location-update` to the shipper and owner. Sharing stops automatically when the driver leaves the screen. It is never a background/always-on broadcast.
- The server only accepts a location ping while the booking is `in_transit`, and validates `lat`/`lng` are real coordinates (not just any number).

---

## Bilingual support

The app is fully usable in **English** and **नेपाली**. A language toggle sits on every auth screen and in Profile settings; the choice is remembered on-device (no account field) via `frontend/src/i18n` (`i18next`/`react-i18next`), and guesses Nepali on first launch if the device itself is set to it.

- **Every screen, component and navigation label** is translated, organized into namespaced resource files at `frontend/src/i18n/locales/{en,ne}/<area>.json` (common, navigation, auth, home, loads, bookings, trucks, kyc, profile, admin).
- **Backend messages** (errors and the one success confirmation) carry a stable `code` alongside the unchanged English `message` (see `backend/src/utils/respond.js`), so the frontend can render its own Nepali translation (`frontend/src/i18n/serverMessages.js`) without the server ever needing to know the caller's language, and without touching what the backend tests assert on.
- **Emailed codes** (verification and password reset) go out in the user's language: the app sends `Accept-Language`, and `backend/src/services/email.js` holds the English and Nepali copy. A language it doesn't have falls back to English.
- **Calendar (A.D. or B.S.):** dates can be shown and picked in either the Gregorian (A.D.) or Bikram Sambat (B.S.) calendar. The choice is on the Profile page, and on the date pickers and the pickup date, remembered on-device, and defaults to B.S. when the app is in Nepali. B.S. months and digits are in Devanagari in Nepali. Dates are always stored and sent as A.D. `YYYY-MM-DD`; only display and picking change (`frontend/src/utils/bsCalendar.js`).
- **Not translated:** free text people type (goods, toles, names), and a few deeply composed validation messages (a truck's field-by-field checks, address errors), which show the English detail inside a Nepali sentence.
- **Nepal's official place names** (7 provinces, 77 districts, 753 local levels) render in Devanagari too — `nameNe`/`categoryNe` fields added to `locations.json` by `backend/scripts/addNepaliLocationNames.js` from the same `local-states-nepal` dataset already used for ward counts (see `backend/src/data/nepal/SOURCES.md`). Free-text fields (a load's goods, an address's tole, a truck's registration number) are never translated, only official UI text and place names.

---

## Deployment

### 1. MongoDB Atlas

1. Create a free **M0** cluster (pick a region near your users, Mumbai/Singapore for Nepal).
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

### 4. Close the Loop on CORS

Back in Render, set `FRONTEND_URL` to your exact Vercel domain (https, no trailing slash) and save. **Skipping this blocks every API call with a CORS error even though both services are up.**

### 5. Android → EAS

```bash
npm install -g eas-cli
cd frontend
eas login
eas build:configure
eas build --platform android --profile preview
```

Set the production `EXPO_PUBLIC_*` values per-profile in `eas.json`. EAS builds run on Expo's servers and won't see your local `.env`.

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

- **Email needs a Brevo account.** Sending is built (`src/services/email.js`), but until `BREVO_API_KEY`/`BREVO_SENDER_EMAIL` are set, verification and reset codes are only logged to the server console. Production refuses to boot without them, since undelivered codes mean nobody can verify an email or recover a password. **This is the remaining hard blocker for a public launch.**
- **Google sign-in needs an OAuth client ID.** The full flow is built and the backend verifies ID tokens, but it can't be exercised end to end until a client ID exists (see [Google sign-in setup](#google-sign-in-setup)). Signature, audience and expiry are checked; the request `nonce` is not yet compared.
- **Accounts created before email login can't sign in.** The switch from phone+OTP to email+password left earlier phone-only accounts with no way to log in. The demo seed and `create-admin` script now set emails and passwords; older test accounts would need both set in the database. After deploying, run `npm run migrate-auth-indexes` once so accounts without a phone number don't collide on the old unique index.
- **Phone/OTP code is retained but unused.** `src/services/sms.js` and `src/services/otpStore.js` are no longer wired to any route, kept in case a later feature (e.g. delivery SMS) wants them.
- **No payment integration.** `Payment` model and `khalti`/`esewa` enums exist; no gateway is wired up. Needs a merchant account.
- **Road distances come from the public OSRM demo server by default.** They are real routes, cached and limited to about one request a second, which is fine for an MVP. For real traffic run your own OSRM server and set `OSRM_URL`. OSRM's car profile knows nothing about truck restrictions or seasonal road closures, and if the server is unreachable the distance falls back to the straight-line estimate (marked "about" in the app).
- **Truck papers are taken on trust.** Owners type in their bluebook, insurance and green sticker dates; nothing checks them against the documents, and there's no upload for photos of the papers yet. Dates can be entered in A.D. or B.S. (the bluebook's own dates are in B.S.); they are stored as A.D.
- **Trip length is a plan, not tracking.** A booking blocks the days the trip should take (see [Trip length](#trip-length-and-availability)). A delayed truck can still overrun into a day it was booked for, and nothing models where a truck ends up after a job.
- **Push receipt-checking is skipped.** Expo's push API has a second async step (check delivery receipts ~15 minutes later) that would catch a token going stale faster; not implemented. A dead token still gets cleared, just on its *next* failed send rather than proactively.
- **Ward and tole data are volunteer-mapped.** Ward boundaries come from OpenStreetMap: 6,696 of 6,743 wards are mapped and 713 of 753 municipalities are complete, so a few points return no ward and the user picks it. Outlines are simplified to about 10 m, so near a ward border the answer can be the neighbour, and a volunteer's mistake is a wrong ward. Tole suggestions only cover places someone has mapped, and none is offered beyond about 1.2 km from one. Both are always shown as a suggestion to check.
- **The Nepali (B.S.) calendar table covers 2000 to 2090.** Month lengths are set by astronomical calculation each year, so the last few years are projections that published calendars may adjust by a day. Dates are stored and sent as A.D. days, so a difference would only change how a date is shown.
- **Native push delivery is unverified on a real device.** The full pipeline (registration → backend send → Android banner → tap → deep link) is built and the backend half is tested, but this development environment has no Android device/emulator to confirm a real push actually arrives. Worth a real-device check before relying on it.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| CORS error in browser console | `FRONTEND_URL` on Render doesn't exactly match the Vercel domain (http vs https, trailing slash, or a preview URL) |
| 502/504 on first request | Render free instance waking from sleep, retry |
| MongoDB "Authentication failed" | Special characters in the DB password need URL-encoding in `MONGODB_URI` |
| Backend exits immediately at boot | Missing `MONGODB_URI`/`JWT_SECRET`. The error message names the variable |
| Socket connects then drops | socket.io client/server major versions mismatched, or `transports: ['websocket']` not forced |
| 404 refreshing a non-root route on Vercel | Missing `rewrites` in `frontend/vercel.json` |
| EAS build can't see env vars | `EXPO_PUBLIC_*` must be set in `eas.json` profiles, not just local `.env` |

---

## License

MIT
