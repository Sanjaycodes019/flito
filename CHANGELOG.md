# Changelog

All notable changes to FLITO. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
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
- `Card` called hooks conditionally, which could crash when `onPress` toggled.
- Vulnerable `qs` dependency (`npm audit fix`), and the backend's other high and critical `npm audit` findings.
- Stale admin dashboard and profile tests.

## Earlier

- Road distances, multi-day bookings, AD/BS calendar, offline ward and tole detection.
- Admin console, role-based navigation, profile redesign, Nepali translations.
- Verified badge for admin-approved people and trucks.
- Truck matching and bidding, Nepal addresses, truck listings, profile page.
- Identity document choice, responsive pages, profile photos.
