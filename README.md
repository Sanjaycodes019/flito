# FLITO

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

Check the backend is healthy: `curl http://localhost:5000/api/health` → `{"status":"ok"}`

### Tests

```bash
cd backend
npm test
```

152 API tests run against a real in-memory MongoDB (no external services, nothing to configure), covering email/password signup and login, email verification, password reset, booking permissions, quote negotiation turn-taking, competitive bidding and double-booking protection, rating averages, expiry, fleet ownership scoping, file uploads, KYC, identity verification gating, and push notifications (Expo's API is mocked, no real push is ever sent by the suite).

```bash
cd frontend
npm test
```

43 component tests (Jest + React Native Testing Library) cover the app's core business logic at the UI layer: the login, signup, forgot/reset password and email verification screens (`AuthScreens`), counter-offer negotiation turn-taking (`LoadDetailScreen`), the KYC upload/submit flow (`KycScreen`), and booking status transitions per role (`BookingDetailScreen`). `services/api` and native modules (location, image/document pickers, notifications, Google sign-in, the WebView-based map/signature canvases) are mocked. See `jest.setup.js`.

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
- **Email verification** and **password reset** both use a 6-digit code sent by email (Brevo) and typed into the app. A code expires after 15 minutes. A new account can use the app right away; Home shows a "Verify your email" prompt until it's confirmed. Changing your email in Edit Profile resets verification.
- In development (`NODE_ENV !== production`) every code is **`123456`**. It is also returned in the API response and shown in the app as a "Dev mode" notice, so no email account is needed to test. With no `BREVO_API_KEY` set, the email is logged to the server console instead of sent.
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
| `NOMINATIM_CONTACT` | backend `.env`, Render | Email or URL sent to OpenStreetMap's Nominatim with "Use Current Location" lookups, as its usage policy requires |
| `NOMINATIM_URL` | backend `.env`, Render | Your own Nominatim server. Optional, defaults to the public service |
| `CLOUDINARY_CLOUD_NAME` | backend `.env`, Render | Cloudinary cloud name (file uploads) |
| `CLOUDINARY_API_KEY` | backend `.env`, Render | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | backend `.env`, Render | Cloudinary API secret, server only, never in the app |
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
| **admin** | Platform stats, KYC approve/reject, suspend users |

**Happy path:** shipper posts a load (goods, weight, pickup and dropoff, pickup date) → picks a truck from the ranked matches and sends a price → owner accepts, counters or declines → on acceptance a **booking is created** with that truck, and its regular driver if verified → driver marks picked up → delivered → booking completes → both parties rate each other. Owners can also quote on open loads with one of their trucks.

**Truck matching** (`backend/src/services/truckMatching.js`): a truck is a candidate only if it is active, its owner is verified and active, its capacity covers the load's weight, both stops are inside its service area (anywhere in Nepal, or only its base province or district), and it isn't already booked on the pickup day. Candidates are scored out of 100: how well the load fills the truck (30), how close its base is to the pickup (30), the owner's rating, smoothed so a single review can't dominate, and completed trips (20), asking price against the cheapest (15), and readiness: a verified driver already on the truck and insurance that is still current (5).

**Truck listings** follow how trucks are described in Nepal: the freight trade's classes (pickup, mini truck, light truck or canter, 6, 10 and 12-wheeler, trailer) with common makes and models, body type, year, fuel, cargo bed size in feet, and extras shippers ask about (tarpaulin, a helper or khalasi, GPS, hill roads). Papers (chassis and engine numbers, bluebook tax, insurance, pollution test green sticker) stay private to the owner: shippers only ever see whether the insurance is current, and the owner's fleet page flags papers that have lapsed or end within 30 days. The strongest signals are shown to the shipper as reasons. Distances are estimates: straight-line distance between municipality centres (or pinned points) times 1.4 for Nepal's winding roads.

**Pricing:** each truck can carry a rate per km and a minimum charge. The asking price for a trip is the rate times the estimated distance, rounded to the nearest Rs. 100 and never below the minimum. A truck without a rate shows no price and the shipper names one.

**Offer rules** (`backend/src/services/negotiation.js`): either side opens (a shipper's request to a truck, or an owner's quote with a truck), then they take turns. A counter must move toward the other side: a shipper offers less than the owner's price and more than their own last offer; an owner asks more than the shipper's offer and less than their own last price. A negotiation ends after 6 offers, when the last one must be accepted or declined. One live negotiation per owner per load, and at most 3 shipper requests waiting per load. Accepting books the load and the truck's pickup day atomically, so neither is ever booked twice, and closes every other offer on the load. A load takes offers until the end of its pickup day (at least 12 hours), offers stay open 48 hours (a counter restarts that) but never past their load, and cancelling or completing a booking frees the truck's day.

Admins cannot be created through public signup (the signup validator only accepts shipper/owner/driver). Use the script instead:

```bash
cd backend
npm run create-admin -- admin@example.com SomePassword123 Sita Sharma
```

**Identity verification (KYC):** every account uploads at least one complete identity document: citizenship card (front and back), National ID card (front and back), driving license, or passport (photo page). Once one is complete, the others are optional. Owners also add a PAN certificate (company registration optional) and drivers add a driving license, which counts as their identity document (citizenship, National ID and passport are optional for drivers). An address is required before submitting.

**Address:** every account can set a Nepal address from the Profile page: province, district, municipality and ward from official lists (7 provinces, 77 districts, 753 local levels, 6,743 wards), plus tole/village/area as free text. It's optional at sign-up and required before identity verification. "Use Current Location" fills in the province, district and municipality from the phone's GPS using Survey Department boundaries, and suggests a tole from OpenStreetMap. The user always chooses the ward and checks the result: no current ward boundaries are openly available, and GPS can be tens of metres off near a boundary. Data sources and licenses are in `backend/src/data/nepal/SOURCES.md`. Documents are stored privately in Cloudinary and shown only through links that expire after 10 minutes. Once submitted they're frozen; an admin approves, or rejects with a reason the user sees, and the user can fix and resubmit. A verified name can't be edited.

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
| POST | `/api/loads` | shipper | Post a load: `goodsType`, `weight` (kg), optional `pickupDate` (YYYY-MM-DD, today to 14 days ahead; defaults to today), and `pickupLocation`/`dropoffLocation` as Nepal addresses (`provinceId`, `districtId`, `localLevelId`, `ward`, `tole`) with optional `coordinates`, `contactPerson` and `phone`. The server adds the display `address`, short `label` and estimated `distanceKm` |
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
| POST | `/api/locations/detect` | any | Province, district and local level at `{ lat, lng }`, plus a suggested tole (no ward) |
| GET | `/api/users/me/kyc` | shipper/owner/driver | Own verification status and documents |
| POST | `/api/users/me/kyc/documents` | shipper/owner/driver | Upload or replace a document (multipart `document` + `type`) |
| DELETE | `/api/users/me/kyc/documents/:docId` | shipper/owner/driver | Remove a document before submitting |
| POST | `/api/users/me/kyc/submit` | shipper/owner/driver | Send documents for review |
| POST | `/api/trucks` | owner | Add a truck. Required: `registrationNumber`, `truckType` (`pickup`, `mini-truck`, `light-truck`, `6-wheeler`, `10-wheeler`, `12-wheeler`, `trailer`, `other`), `bodyType` (`open`, `covered`, `flatbed`, `tipper`, `tanker`, `refrigerated`), `capacity` (kg). Optional: `make`, `model`, `year`, `fuelType`, `cargoBed` (`lengthFt`, `widthFt`, `heightFt`), `features` (`tarpaulin`, `helper`, `gpsTracker`, `hillRoads`), `baseLocation` (province, district, municipality), `serviceArea` (`nepal`, `province`, `district`), `ratePerKm`, `minimumCharge`, and papers: `chassisNumber`, `engineNumber`, `bluebookRenewedUntil`, `insurance` (`type`, `company`, `policyNumber`, `validUntil`), `emissionTestValidUntil` (dates as YYYY-MM-DD) |
| GET | `/api/trucks` | owner | Your fleet |
| PATCH | `/api/trucks/:id` | owner | Update truck details, rates or status (`null` clears an optional field) |
| PATCH | `/api/trucks/:id/driver` | owner | Assign/unassign the truck's driver |
| DELETE | `/api/trucks/:id` | owner | Remove a truck |
| GET | `/api/admin/stats` | admin | Platform metrics |
| GET | `/api/admin/kyc/pending` | admin | Submissions awaiting review, with 10-minute document links |
| PATCH | `/api/admin/kyc/:userId` | admin | Approve, or reject with a required reason |
| PATCH | `/api/admin/users/:userId/status` | admin | Suspend/ban/reactivate |

### Real-time (Socket.io)

Clients emit `join-room` with their JWT to join a private `user-<id>` room; the server verifies the token before joining. Server pushes: `new-quote`, `quote-updated`, `quote-accepted`, `booking-assigned`, `booking-status-changed`, `location-update`.

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
- **Distances are estimates, not routes.** Truck matching and asking prices use straight-line distance between municipality centres (or pinned points) times 1.4. That's close for most highway trips but can be well off where the road detours around a river or ridge. A routing service (OSRM or a paid API) would make both exact.
- **Truck papers are taken on trust.** Owners type in their bluebook, insurance and green sticker dates; nothing checks them against the documents, and there's no upload for photos of the papers yet. Dates are entered in A.D.; the bluebook's own dates are in B.S., so owners convert them themselves until a B.S. calendar is added.
- **Availability is by day.** A booked truck is unavailable for the whole pickup day and free again the next, whatever the trip's real length; a multi-day haul can still be double-booked for its later days.
- **Push receipt-checking is skipped.** Expo's push API has a second async step (check delivery receipts ~15 minutes later) that would catch a token going stale faster; not implemented. A dead token still gets cleared, just on its *next* failed send rather than proactively.
- **Wards aren't detected from location.** The official boundary data stops at local levels, and the only free ward map is outdated (pre-2020), so "Use Current Location" fills province, district and municipality and the user picks the ward. Near a boundary, GPS error can still place someone in the neighbouring municipality, which is why the app shows the accuracy and asks the user to check.
- **Tole suggestions use the public Nominatim service.** It allows about one request per second for the whole app and discourages heavy commercial use. The backend throttles and caches lookups; a busy production deployment should run its own Nominatim (`NOMINATIM_URL`).
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
