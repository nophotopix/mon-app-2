# No.Photo.Pix — PRD

## Original Problem Statement
Modern photo gallery web app for a photographer to sell photos with PayPal payment.

## User Choices & Brand
- **Brand**: No.Photo.Pix (NPP)
- **Theme**: Dark elegant gold/red premium photography
- **Photos**: Unsplash demo + admin upload
- **Logo**: 5cm x 15cm centered, gold halo
- **Contact**: Instagram @no_photo_pix, phone 07 60 59 93 12
- **Payment methods**: PayPal · Wero · Revolut
- **Packs**: 1 photo=3€, 3=8€ (populaire), 5=12€

## Architecture
- **Backend**: FastAPI + Motor (MongoDB). Routes under /api. Static /uploads.
- **Frontend**: React + React Router + Tailwind + Shadcn + Sonner + Phosphor + Cormorant Garamond / Outfit.
- **Collections**: photos, orders.
- **Email**: SendGrid SDK installed, MOCKED when SENDGRID_API_KEY empty (logs only).

## Personas
- **Visitor**: browses, selects via heart, pays via chosen method, receives photos by email.
- **Admin (photographer)**: uploads photos, validates orders manually after payment confirmation.

## Implemented
### Phase 1 (2026-02-18) — Gallery MVP
- Gallery + masonry + heart selection + floating payment bar + PayPal.me redirect
- Admin: login, upload, delete photos
- Auto-seed 8 Unsplash photos

### Phase 2 — Branding & Packs
- NPP logo (header + 5cm×15cm hero), gold dark theme
- Pack pricing (DP algorithm) with savings badge
- "Comment ça marche" 4-step section
- Instagram link in footer
- "Pas de PayPal ?" gold CTA

### Phase 3 — Multi-payment + Orders + Email (2026-05-20)
- 3 payment methods: PayPal, Wero (phone 07 60 59 93 12), Revolut (revolut.me/nophotopix)
- Footer payment icons (PayPal/Wero/Revolut)
- CheckoutModal: 3-step flow (email → method → instructions)
- Backend Order model with status pending/completed
- Success page `/success/:orderId` with order summary + locked/unlocked photo downloads + 12s polling
- Admin Orders tab with "Valider & envoyer" button (sends email)
- SendGrid integration prepared, **MOCKED** (logs `[MOCKED EMAIL]`) until SENDGRID_API_KEY provided
- 100% backend (17/17 pytest) + 100% frontend e2e validated (iter 3)

## Required env vars (backend/.env)
```
ADMIN_PASSWORD=97140
PAYPAL_ME_HANDLE=nophotopix
REVOLUT_ME_HANDLE=nophotopix
WERO_PHONE=+33760599312
WERO_PHONE_DISPLAY=07 60 59 93 12
SENDGRID_API_KEY=          # ⬅ TO PROVIDE for real emails
SENDER_EMAIL=no-reply@nophotopix.com  # ⬅ verified in SendGrid
SENDER_NAME=No.Photo.Pix
PUBLIC_BASE_URL=https://image-select-pay.preview.emergentagent.com
```

## Backlog
### P1 (next)
- SendGrid: provide API key + verified sender → flip from MOCKED to LIVE (no code change needed)
- Email template polish (logo image, better HTML)
- Order ID short-link / lookup page for clients

### P2
- Watermark on previews until paid
- Photo lightbox preview
- Photo categories / collections
- Real PayPal Checkout SDK (auto-confirm payments)

## Next Tasks
- Customer: get SendGrid account + API key + verified sender → email flows go live
- Optional: change ADMIN_PASSWORD to something stronger than `97140`
