# No.Photo.Pix — PRD

## Original Problem Statement
Modern photo gallery web app for a photographer to sell photos with manual payment methods (PayPal/Wero/Revolut). After admin manually validates the payment, an automated email is sent containing a secure 48-hour download link. All preview images are protected with a visible watermark + anti-right-click / anti-drag layer to deter unauthorized reuse.

## User Choices & Brand
- **Brand**: No.Photo.Pix (NPP)
- **Theme**: Dark elegant gold/red premium photography (cinematic)
- **Photos**: Unsplash demo + admin upload (persistent via Emergent Object Storage)
- **Logo**: 5cm × 15cm centered, gold halo
- **Contact**: Instagram @no_photo_pix, phone 07 60 59 93 12
- **Payment methods**: PayPal · Wero · Revolut (manual only — no Stripe in UI)
- **Packs**: 1 photo = 3€, 3 = 8€ (populaire), 5 = 12€

## Architecture
- **Backend**: FastAPI + Motor (MongoDB). Routes under /api. Object Storage via Emergent.
- **Frontend**: React + React Router + Tailwind + Shadcn + Sonner + Phosphor.
- **Collections**: photos, albums, orders, payment_transactions.
- **Email**: SendGrid (real when SENDGRID_API_KEY valid; mocked logs when missing/invalid).
- **Deploy**: Frontend → Netlify (continuous deploy from GitHub), Backend → Render, code pushed via "Save to GitHub" from Emergent.

## Personas
- **Visitor**: browses (watermarked previews), selects via heart, pays via chosen method, receives email → /download/:token → grabs clean HD photos.
- **Admin**: uploads photos, organizes albums, validates orders manually → triggers automatic email + secure 48h download link.

## Implemented
### Phase 1–4 (prior)
- MVP gallery, packs, multi-payment, orders, SendGrid email
- Albums/Folders, Emergent Object Storage, premium cinematic UI, lightbox
- Stripe Checkout endpoints (backend only, NOT exposed in UI per user preference)

### Phase 5 (2026-05-23) — Automatic Download Links After Manual Validation
- `POST /api/admin/orders/{id}/validate` → generates secure download_token, expiration, sends automated email
- Public `/download/:token` page with secure HD streaming endpoint (token + photo_id gated)
- Supports object storage, local /uploads, and external (Unsplash) URLs via proxy
- Success page shows ACCÉDER À MES PHOTOS CTA when token exists

### Phase 6 (2026-05-23) — Watermark + Image Protection + 48h TTL
- New `ProtectedImage` component used everywhere a preview is rendered (gallery, lightbox, album hero, success page)
- Watermark: SVG-encoded diagonal repeating "NPP" pattern in gold (#E8B23A) + white, rotated -28°, mix-blend-mode screen, opacity tuned for both dark & light photos
- Anti-protection: `onContextMenu` preventDefault + `draggable=false` + `onDragStart` preventDefault + CSS `user-drag:none`, `user-select:none`, `-webkit-touch-callout:none`
- Lazy-loading preserved via `<img loading="lazy">`
- Mobile: pattern auto-scales to 180×130 below 640px
- Watermark intentionally **disabled** on `/download/:token` grid (paid customer sees clean HD previews)
- Download token TTL shortened from 7 days → **48 hours** (unlimited downloads during this window)
- All copy ("7 jours" → "48 heures") updated in backend email + frontend (Success + Download)
- **25/25 backend pytest** + frontend Playwright validated (iteration_5)

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

## Deployment workflow
- Code pushed to GitHub via the **"Save to GitHub"** button in Emergent's chat input bar.
- **Netlify** (frontend) auto-deploys on push to the connected branch.
- **Render** (backend) auto-deploys on push to the connected branch.
- Emergent cannot push directly — pushing to GitHub is the only mechanism.

## Backlog
### P1
- Provide a valid SENDGRID_API_KEY + verified sender → emails go live (no code change needed)
- Confirm PUBLIC_BASE_URL matches the production domain so email links resolve

### P2
- Polish email template (logo image, plain-text fallback)
- Categories / collections of photos
- Public "Coups de cœur clients" gallery (with customer opt-in)
- Expose Stripe (already wired backend-side) in UI as 4th payment option, if/when desired

## Test Credentials
See /app/memory/test_credentials.md (Admin: `Noclan97140$`).

## Next Tasks
- User pushes the changes to GitHub via "Save to GitHub" → Netlify + Render auto-deploy
- Provide a valid SendGrid API key & verified sender to switch email from mocked to live
