# Changelog

All notable changes to FLITO. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Gallery page (`/gallery`): 14 real screens of the app, from the live trip map and the PDF invoice to the admin console, grouped by what they show, captioned in English and Nepali, each opening full size. Three of them also sit on the landing page.
- Live trip map: the road from pickup to drop-off, the truck on it turned to its heading, and when it should arrive with the time and distance left, paced for a loaded truck. Before the trip it shows the road distance; afterwards, "Delivered". A night map in the dark theme, and full screen with the trip in a bottom sheet on phones or a card on wider screens. Free services only (Leaflet, OpenStreetMap, OSRM); route lines are thinned and cached on the server, and the driver's phone sends a fix only after moving or turning.
- Driver's location card shows whether sharing is on, when the last fix was sent and how good the GPS is.
- Payment details: truck owners add bank accounts or eSewa and Khalti wallets with their QR codes. The shipper pays the owner directly, records it on the booking, and the owner confirms it arrived. FLITO doesn't move money.
- FLITO's fees: truck owners pay a fee on each completed trip, billed by Nepali month; shippers pay nothing. Owners see the fee before they send an offer; fees past due pause new offers. Admins add FLITO's accounts and confirm fee payments.
- Public site: landing, how it works, safety, about, mission, help, contact, terms and privacy pages, served as search-friendly HTML.
- Loads that need several trucks, each its own booking; admin record pages with audit history.
- Log in with a phone number and PIN, call in one tap, Nepali first, and a one-button job screen for drivers.
- Dark and light themes; BS is now the default calendar.
- Trip invoices: a completed trip gets an invoice number (`FL/2083-84/00042`, running per Nepali fiscal year), and the shipper and truck owner can download it as a one-page PDF with the route, truck, charges, amount in words, payments, balance due and the receiver's signature. Nepali names print correctly.
- In-app notification feed with unread count, bell and screen, in English and Nepali.
- Security headers (helmet), response compression, and stripping of Mongo operators from requests.
- Structured JSON logging (pino) and optional Sentry error tracking.
- Graceful shutdown on SIGTERM/SIGINT; `/api/health` now reports database state.
- React error boundary so a broken screen no longer blanks the app.
- ESLint for backend and frontend, GitHub Actions CI, Dockerfile and docker-compose.

### Fixed
- Android camera and photo library: "Take photo" and "Choose photo" could fail with "Attempting to launch an unregistered ActivityResultLauncher" after Android replaced the app's screen. Patched `expo-modules-core` (`frontend/patches/`, applied by `patch-package` on install) to re-register the pickers whenever a new screen instance resumes.
- Google sign-in in the Android app: it now uses Google's native account picker (Google Play services) instead of the web popup, which Google won't send back to the app. The web keeps the popup. Needs an Android OAuth client for `com.flito.app` in Google Cloud (see README).
- Hairline seams between the trip map's tiles at half zoom steps.
- `Card` called hooks conditionally, which could crash when `onPress` toggled.
- Vulnerable `qs` dependency (`npm audit fix`), and the backend's other high and critical `npm audit` findings.
- Stale admin dashboard and profile tests.

## Earlier

- Road distances, multi-day bookings, AD/BS calendar, offline ward and tole detection.
- Admin console, role-based navigation, profile redesign, Nepali translations.
- Verified badge for admin-approved people and trucks.
- Truck matching and bidding, Nepal addresses, truck listings, profile page.
- Identity document choice, responsive pages, profile photos.
