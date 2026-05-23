# No.Photo.Pix — PRD

## Original Problem Statement
Modern photo gallery web app for a photographer to sell photos with manual payment methods (PayPal/Wero/Revolut). After admin manually validates the payment, an automated email must be sent containing a secure 7-day download link.

## User Choices & Brand
- **Brand**: No.Photo.Pix (NPP)
- **Theme**: Dark elegant gold/red premium photography (cinematic)
- **Photos**: Unsplash demo + admin upload (persistent via Emergent Object Storage)
- **Logo**: 5cm x 15cm centered, gold halo
- **Contact**: Instagram @no_photo_pix, phone 07 60 59 93 12
- **Payment methods**: PayPal · Wero · Revolut (manual only — no Stripe in UI)
- **Packs**: 1 photo = 3€, 3 = 8€ (populaire), 5 = 12€

## Architecture
- **Backend**: FastAPI + Motor (MongoDB). Routes under /api. Object Storage via Emergent.
- **Frontend**: React + React Router + Tailwind + Shadcn + Sonner + Phosphor.
- **Collections**: photos, albums, orders, payment_transactions.
- **Email**: SendGrid (real when SENDGRID_API_KEY valid; mocked logs when missing/invalid).

## Personas
- **Visitor**: browses, selects via heart, pays via chosen method, receives email → /download/:token → grabs HD photos.
- **Admin**: uploads photos, organizes albums, validates orders manually → triggers automatic email + download link.

## Implemented
### Phase 1–4 (prior)
- MVP gallery, packs, multi-payment, orders, SendGrid email (manual photo links in email)
- Albums/Folders, Emergent Object Storage, premium cinematic UI, lightbox
- Stripe Checkout endpoints (backend only, NOT exposed in UI per user preference)

### Phase 5 (2026-05-23) — Automatic Download Links After Manual Validation
- `POST /api/admin/orders/{id}/validate` now:
  - generates a secure `download_token` (URL-safe, 40 bytes)
  - sets `download_expires_at` (7 days)
  - sends an automated SendGrid email containing a single button "TÉLÉCHARGER MES PHOTOS" → `/download/{token}`
  - idempotent: re-validation returns existing token without re-issuing
- New public route `GET /api/download/{token}` (info) + `GET /api/download/{token}/file/{photo_id}` (secure file stream)
- Token-gated photo file streaming supports: object storage, local /uploads, and external (Unsplash) URLs via proxy
- 410 Gone when token expired; 403 when photo doesn't belong to the order; 404 when token invalid/order not completed
- Frontend page `/download/:token` (Download.jsx) — premium gold/dark UI with order meta, expiration date, photo grid with secure HD download anchors
- Success page now shows prominent "ACCÉDER À MES PHOTOS" CTA when order has a download_token
- Per-photo download buttons on Success use secure token URL when available
- **24/24 backend pytest** + frontend Playwright validated (iteration_4)

## Required env vars (backend/.env)
```
ADMIN_PASSWORD=Noclan97140$
PAYPAL_ME_HANDLE=nophotopix
REVOLUT_ME_HANDLE=nophotopix
WERO_PHONE=+33760599312
WERO_PHONE_DISPLAY=07 60 59 93 12
SENDGRID_API_KEY=          # ⬅ TO PROVIDE for real emails (currently invalid → mocked)
SENDER_EMAIL=no-reply@nophotopix.com
SENDER_NAME=No.Photo.Pix
PUBLIC_BASE_URL=https://venerable-beignet-9414de.netlify.app  # ⬅ MUST match the actual public domain
EMERGENT_LLM_KEY=...
STRIPE_API_KEY=sk_test_emergent  # unused in UI, kept for future
```

## Backlog
### P1
- Provide a valid SENDGRID_API_KEY + verified sender → emails go live (no code change needed)
- Confirm PUBLIC_BASE_URL matches the production domain so email links resolve
- Cosmetic: ensure /download/{token} grid thumbnails render (resolveImageUrl prefix for relative /uploads/... — currently broken alt for uploaded photos only; HD download itself works)

### P2
- Watermark on previews until paid
- Categories / collections of photos
- Polish email template (logo image, plain-text fallback)
- Expose Stripe (already wired backend-side) in UI as 4th payment option, if/when desired

## Test Credentials
See /app/memory/test_credentials.md (Admin: `Noclan97140$`).

## Next Tasks
- Provide a valid SendGrid API key & verified sender to switch email from mocked to live
- (Optional) Fix thumbnail rendering for uploaded photos on /download/:token grid
