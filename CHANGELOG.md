# Changelog

All notable changes to FLITO. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Trip invoices: a completed trip gets an invoice number (`FL/2083-84/00042`, running per Nepali fiscal year), and the shipper and truck owner can download it as a one-page PDF with the route, truck, charges, amount in words, payments, balance due and the receiver's signature. Nepali names print correctly.
- In-app notification feed with unread count, bell and screen, in English and Nepali.
- Security headers (helmet), response compression, and stripping of Mongo operators from requests.
- Structured JSON logging (pino) and optional Sentry error tracking.
- Graceful shutdown on SIGTERM/SIGINT; `/api/health` now reports database state.
- React error boundary so a broken screen no longer blanks the app.
- ESLint for backend and frontend, GitHub Actions CI, Dockerfile and docker-compose.

### Fixed
- `Card` called hooks conditionally, which could crash when `onPress` toggled.
- Vulnerable `qs` dependency (`npm audit fix`).
- Stale admin dashboard and profile tests.

## Earlier

- Road distances, multi-day bookings, AD/BS calendar, offline ward and tole detection.
- Admin console, role-based navigation, profile redesign, Nepali translations.
- Verified badge for admin-approved people and trucks.
- Truck matching and bidding, Nepal addresses, truck listings, profile page.
- Identity document choice, responsive pages, profile photos.
