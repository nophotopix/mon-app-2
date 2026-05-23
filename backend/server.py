from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Header, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import shutil
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '97140')
PAYPAL_ME_HANDLE = os.environ.get('PAYPAL_ME_HANDLE', 'nophotopix')
REVOLUT_ME_HANDLE = os.environ.get('REVOLUT_ME_HANDLE', 'nophotopix')
WERO_PHONE = os.environ.get('WERO_PHONE', '+33760599312')
WERO_PHONE_DISPLAY = os.environ.get('WERO_PHONE_DISPLAY', '07 60 59 93 12')
PRICE_PER_PHOTO = float(os.environ.get('PRICE_PER_PHOTO', '3'))
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'no-reply@nophotopix.com')
SENDER_NAME = os.environ.get('SENDER_NAME', 'No.Photo.Pix')
PUBLIC_BASE_URL = os.environ.get('PUBLIC_BASE_URL', '')

# Create the main app without a prefix
app = FastAPI()

# Mount uploads directory for serving local images
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Models
class Photo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    title: Optional[str] = None
    source: str = "unsplash"  # unsplash | upload
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AdminLogin(BaseModel):
    password: str


class PaymentMethod(BaseModel):
    id: str
    label: str
    sub: str
    kind: str  # url | phone


class Config(BaseModel):
    price_per_photo: float
    paypal_handle: str
    revolut_handle: str
    wero_phone: str
    wero_phone_display: str
    currency: str = "EUR"


class OrderCreate(BaseModel):
    email: str
    photo_ids: List[str]
    total: float
    payment_method: str  # paypal | wero | revolut


class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    photo_ids: List[str]
    total: float
    payment_method: str
    status: str = "pending"  # pending | completed | cancelled
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    validated_at: Optional[str] = None
    email_sent: bool = False


class OrderWithPhotos(Order):
    photos: List[Photo] = []


# Seed initial gallery from design guidelines
SEED_PHOTOS = [
    {"url": "https://images.unsplash.com/photo-1569525987258-6aa03a5e4926?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNzl8MHwxfHNlYXJjaHwzfHxibGFjayUyMGFuZCUyMHdoaXRlJTIwYXJjaGl0ZWN0dXJlJTIwbWluaW1hbHxlbnwwfHx8fDE3NzkxMTg3MDN8MA&ixlib=rb-4.1.0&q=85", "title": "Architecture I"},
    {"url": "https://images.unsplash.com/photo-1551161440-88a5c5b09ba0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNzl8MHwxfHNlYXJjaHw0fHxibGFjayUyMGFuZCUyMHdoaXRlJTIwYXJjaGl0ZWN0dXJlJTIwbWluaW1hbHxlbnwwfHx8fDE3NzkxMTg3MDN8MA&ixlib=rb-4.1.0&q=85", "title": "Skyline"},
    {"url": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwyfHxibGFjayUyMGFuZCUyMHdoaXRlJTIwcG9ydHJhaXQlMjBwaG90b2dyYXBoeSUyMG1vb2R8ZW58MHx8fHwxNzc5MTE4NzAzfDA&ixlib=rb-4.1.0&q=85", "title": "Portrait I"},
    {"url": "https://images.unsplash.com/photo-1475070929565-c985b496cb9f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwzfHxkYXJrJTIwbW9vZHklMjBsYW5kc2NhcGUlMjBtaW5pbWFsfGVufDB8fHx8MTc3OTExODcwM3ww&ixlib=rb-4.1.0&q=85", "title": "River"},
    {"url": "https://images.unsplash.com/photo-1705435896415-933b94be4ea5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHw0fHxkYXJrJTIwbW9vZHklMjBsYW5kc2NhcGUlMjBtaW5pbWFsfGVufDB8fHx8MTc3OTExODcwM3ww&ixlib=rb-4.1.0&q=85", "title": "Lone Tree"},
    {"url": "https://images.unsplash.com/photo-1540172777610-b15b605dd68d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwzfHxibGFjayUyMGFuZCUyMHdoaXRlJTIwcG9ydHJhaXQlMjBwaG90b2dyYXBoeSUyMG1vb2R8ZW58MHx8fHwxNzc5MTE4NzAzfDA&ixlib=rb-4.1.0&q=85", "title": "Portrait II"},
    {"url": "https://images.unsplash.com/photo-1461695008884-244cb4543d74?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNzl8MHwxfHNlYXJjaHwyfHxibGFjayUyMGFuZCUyMHdoaXRlJTIwYXJjaGl0ZWN0dXJlJTIwbWluaW1hbHxlbnwwfHx8fDE3NzkxMTg3MDN8MA&ixlib=rb-4.1.0&q=85", "title": "Mirror"},
    {"url": "https://images.unsplash.com/photo-1530037327011-979a1109a5dc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbW9vZHklMjBsYW5kc2NhcGUlMjBtaW5pbWFsfGVufDB8fHx8MTc3OTExODcwM3ww&ixlib=rb-4.1.0&q=85", "title": "Mountain"},
]


async def seed_photos():
    """Seed gallery with default photos if collection is empty."""
    count = await db.photos.count_documents({})
    if count == 0:
        docs = []
        for p in SEED_PHOTOS:
            photo = Photo(url=p["url"], title=p["title"], source="unsplash")
            docs.append(photo.model_dump())
        if docs:
            await db.photos.insert_many(docs)
        logger.info(f"Seeded {len(docs)} default photos")


@api_router.get("/")
async def root():
    return {"message": "No_Photo_PIX API"}


@api_router.get("/config", response_model=Config)
async def get_config():
    return Config(
        price_per_photo=PRICE_PER_PHOTO,
        paypal_handle=PAYPAL_ME_HANDLE,
        revolut_handle=REVOLUT_ME_HANDLE,
        wero_phone=WERO_PHONE,
        wero_phone_display=WERO_PHONE_DISPLAY,
    )


def _absolute_url(url: str) -> str:
    """Convert a relative /uploads/... path into a fully-qualified URL using PUBLIC_BASE_URL.
    If PUBLIC_BASE_URL is not set, returns the path unchanged (server-relative)."""
    if not url:
        return url
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if PUBLIC_BASE_URL:
        return f"{PUBLIC_BASE_URL.rstrip('/')}{url}"
    return url


def _hydrate_photo(doc: dict) -> dict:
    """Ensure photo.url is always an absolute, frontend-usable URL."""
    if isinstance(doc, dict) and "url" in doc:
        doc["url"] = _absolute_url(doc["url"])
    return doc


@api_router.get("/photos", response_model=List[Photo])
async def list_photos():
    photos = await db.photos.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [_hydrate_photo(p) for p in (photos or [])]


@api_router.post("/admin/login")
async def admin_login(body: AdminLogin):
    if body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")
    return {"success": True, "token": ADMIN_PASSWORD}


def _check_admin(token: Optional[str]):
    if not token or token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Non autorisé")


async def _do_upload_photo(file: UploadFile, title: Optional[str], x_admin_token: Optional[str]):
    _check_admin(x_admin_token)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier doit être une image")

    ext = Path(file.filename or "").suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        ext = ".jpg"

    photo_id = str(uuid.uuid4())
    filename = f"{photo_id}{ext}"
    dest = UPLOAD_DIR / filename

    with dest.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Store the relative URL in DB (so PUBLIC_BASE_URL changes propagate automatically),
    # but return absolute URL via _hydrate_photo.
    rel_url = f"/uploads/{filename}"
    photo = Photo(id=photo_id, url=rel_url, title=title or file.filename, source="upload")
    doc = photo.model_dump()
    await db.photos.insert_one(doc)
    return _hydrate_photo(doc)


@api_router.post("/photos", response_model=Photo)
async def upload_photo(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    x_admin_token: Optional[str] = Header(None),
):
    return await _do_upload_photo(file, title, x_admin_token)


# Alias route to match the conventional admin-prefixed pattern.
@api_router.post("/admin/photos/upload", response_model=Photo)
async def upload_photo_admin_alias(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    x_admin_token: Optional[str] = Header(None),
):
    return await _do_upload_photo(file, title, x_admin_token)


@api_router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, x_admin_token: Optional[str] = Header(None)):
    _check_admin(x_admin_token)
    photo = await db.photos.find_one({"id": photo_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo introuvable")

    # Remove file if uploaded
    if photo.get("source") == "upload":
        url = photo.get("url", "")
        if url.startswith("/uploads/"):
            file_path = UPLOAD_DIR / url.replace("/uploads/", "")
            if file_path.exists():
                file_path.unlink()

    await db.photos.delete_one({"id": photo_id})
    return {"success": True}


# ============= ORDERS =============

async def _hydrate_order(order: dict) -> dict:
    """Attach Photo objects to an order document with absolute URLs."""
    photo_docs = await db.photos.find(
        {"id": {"$in": order.get("photo_ids", [])}}, {"_id": 0}
    ).to_list(1000)
    by_id = {p["id"]: _hydrate_photo(p) for p in photo_docs}
    order["photos"] = [by_id[pid] for pid in order.get("photo_ids", []) if pid in by_id]
    return order


def _send_order_email(order: dict, photos: list):
    """
    Send order email via SendGrid.
    Returns tuple (success: bool, error_message: Optional[str]).
    When SENDGRID_API_KEY is empty, just logs and returns (True, None).
    """
    base_url = PUBLIC_BASE_URL.rstrip("/") if PUBLIC_BASE_URL else ""

    download_links = []
    for p in photos:
        url = p["url"]
        if not url.startswith("http"):
            url = f"{base_url}{url}" if base_url else url
        download_links.append(
            f'<li><a href="{url}" style="color:#E8B23A;text-decoration:none;">'
            f'{p.get("title") or "Photo"}</a></li>'
        )

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#050505;color:#fff;padding:40px 24px;">
      <h1 style="color:#E8B23A;font-family:Georgia,serif;font-weight:300;font-size:32px;margin:0 0 8px;">Merci pour votre achat !</h1>
      <p style="color:#aaa;font-size:14px;letter-spacing:2px;text-transform:uppercase;margin:0 0 32px;">No.Photo.Pix</p>
      <p style="color:#fff;font-size:16px;line-height:1.6;">Votre paiement a été confirmé. Voici vos {len(photos)} photo(s) en HD :</p>
      <ul style="color:#fff;line-height:2;padding-left:20px;">
        {''.join(download_links)}
      </ul>
      <p style="color:#888;font-size:13px;margin-top:32px;">Total payé : <strong style="color:#E8B23A;">{order['total']} €</strong></p>
      <p style="color:#666;font-size:12px;margin-top:24px;border-top:1px solid #222;padding-top:16px;">
        Si un lien ne fonctionne pas, contactez-nous sur Instagram @no_photo_pix.
      </p>
    </div>
    """

    if SENDGRID_API_KEY:
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail, From

            message = Mail(
                from_email=From(SENDER_EMAIL, SENDER_NAME),
                to_emails=order["email"],
                subject=f"Vos photos No.Photo.Pix sont prêtes ({len(photos)} photo(s))",
                html_content=html,
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            resp = sg.send(message)
            logger.info(f"SendGrid email sent to {order['email']}, status={resp.status_code}")
            return True, None
        except Exception as exc:
            err = str(exc)
            logger.error(f"SendGrid send failed: {err}")
            # Build a friendly French message for common SendGrid errors
            friendly = err
            if "403" in err or "Forbidden" in err:
                friendly = (
                    f"L'email expéditeur ({SENDER_EMAIL}) n'est pas vérifié dans SendGrid. "
                    f"Allez sur SendGrid → Settings → Sender Authentication → Single Sender "
                    f"Verification pour le vérifier."
                )
            elif "401" in err or "Unauthorized" in err:
                friendly = "Clé API SendGrid invalide ou expirée."
            return False, friendly
    else:
        logger.info(
            f"[MOCKED EMAIL] To: {order['email']} | Subject: Vos photos No.Photo.Pix sont prêtes "
            f"| {len(photos)} photo(s) | Total: {order['total']} €"
        )
        logger.info(f"[MOCKED EMAIL HTML] {html}")
        return True, None


@api_router.post("/orders", response_model=Order)
async def create_order(body: OrderCreate):
    if body.payment_method not in {"paypal", "wero", "revolut"}:
        raise HTTPException(status_code=400, detail="Méthode de paiement invalide")
    if not body.photo_ids:
        raise HTTPException(status_code=400, detail="Aucune photo sélectionnée")
    if "@" not in body.email or "." not in body.email:
        raise HTTPException(status_code=400, detail="Email invalide")

    # Verify photos exist
    count = await db.photos.count_documents({"id": {"$in": body.photo_ids}})
    if count != len(set(body.photo_ids)):
        raise HTTPException(status_code=400, detail="Une ou plusieurs photos n'existent pas")

    order = Order(
        email=body.email.strip().lower(),
        photo_ids=body.photo_ids,
        total=body.total,
        payment_method=body.payment_method,
    )
    await db.orders.insert_one(order.model_dump())
    return order


@api_router.get("/orders/{order_id}", response_model=OrderWithPhotos)
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    await _hydrate_order(order)
    return order


@api_router.get("/admin/orders", response_model=List[OrderWithPhotos])
async def list_orders(x_admin_token: Optional[str] = Header(None)):
    _check_admin(x_admin_token)
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for o in orders:
        await _hydrate_order(o)
    return orders


@api_router.post("/admin/orders/{order_id}/validate", response_model=OrderWithPhotos)
async def validate_order(
    order_id: str, x_admin_token: Optional[str] = Header(None)
):
    _check_admin(x_admin_token)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order["status"] == "completed":
        await _hydrate_order(order)
        return order

    await _hydrate_order(order)
    sent, send_error = _send_order_email(order, order["photos"])

    now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "completed", "validated_at": now, "email_sent": sent}},
    )
    order["status"] = "completed"
    order["validated_at"] = now
    order["email_sent"] = sent
    if not sent and send_error:
        # Surface the SendGrid error to the admin (non-fatal — order is still completed)
        raise HTTPException(status_code=502, detail=f"Commande validée mais email NON envoyé : {send_error}")
    return order


@api_router.delete("/admin/orders/{order_id}")
async def delete_order(order_id: str, x_admin_token: Optional[str] = Header(None)):
    _check_admin(x_admin_token)
    res = await db.orders.delete_one({"id": order_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return {"success": True}


# Include the router in the main app
app.include_router(api_router)

# CORS configuration.
# IMPORTANT: when allow_credentials=True, the browser rejects `Access-Control-Allow-Origin: *`.
# Since this API uses a header-based admin token (not cookies), credentials are not required.
# This setup allows ALL origins which is required because the frontend is hosted on a
# different domain (Netlify / Emergent) than the backend (Render).
_cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
_cors_origins = [o.strip() for o in _cors_origins if o.strip()]
_wildcard = "*" in _cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_credentials=not _wildcard,
    allow_origins=_cors_origins if not _wildcard else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    await seed_photos()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
