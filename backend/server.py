from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Header, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import shutil
import secrets
import requests
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Noclan97140$')
PAYPAL_ME_HANDLE = os.environ.get('PAYPAL_ME_HANDLE', 'nophotopix')
REVOLUT_ME_HANDLE = os.environ.get('REVOLUT_ME_HANDLE', 'nophotopix')
WERO_PHONE = os.environ.get('WERO_PHONE', '+33760599312')
WERO_PHONE_DISPLAY = os.environ.get('WERO_PHONE_DISPLAY', '07 60 59 93 12')
PRICE_PER_PHOTO = float(os.environ.get('PRICE_PER_PHOTO', '3'))
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'no-reply@nophotopix.com')
SENDER_NAME = os.environ.get('SENDER_NAME', 'No.Photo.Pix')
PUBLIC_BASE_URL = os.environ.get('PUBLIC_BASE_URL', '')
ADMIN_NOTIFICATION_EMAIL = os.environ.get('ADMIN_NOTIFICATION_EMAIL', 'nophotopix@gmail.com')

# Stripe
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
DOWNLOAD_TOKEN_TTL_HOURS = 48

# ============= EMERGENT OBJECT STORAGE =============
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "nophotopix"
MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}

_storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    """Initialize Emergent Object Storage. Returns session storage_key or None on failure."""
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        resp = requests.post(
            f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30
        )
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        return _storage_key
    except Exception as exc:
        logging.getLogger(__name__).error(f"Object storage init failed: {exc}")
        return None


def storage_put(path: str, data: bytes, content_type: str) -> Optional[dict]:
    """Upload bytes to object storage. Returns the storage response dict or None on failure."""
    key = init_storage()
    if not key:
        return None
    try:
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
        if resp.status_code == 403:
            # Storage key expired — re-init once and retry.
            global _storage_key
            _storage_key = None
            key = init_storage()
            if key:
                resp = requests.put(
                    f"{STORAGE_URL}/objects/{path}",
                    headers={"X-Storage-Key": key, "Content-Type": content_type},
                    data=data,
                    timeout=120,
                )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logging.getLogger(__name__).error(f"Object storage put failed for {path}: {exc}")
        return None


def storage_get(path: str) -> Optional[tuple]:
    """Download from object storage. Returns (bytes, content_type) or None."""
    key = init_storage()
    if not key:
        return None
    try:
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
        if resp.status_code == 403:
            global _storage_key
            _storage_key = None
            key = init_storage()
            if key:
                resp = requests.get(
                    f"{STORAGE_URL}/objects/{path}",
                    headers={"X-Storage-Key": key},
                    timeout=60,
                )
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
    except Exception as exc:
        logging.getLogger(__name__).error(f"Object storage get failed for {path}: {exc}")
        return None

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
    album_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Album(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    date: Optional[str] = None  # ISO date string YYYY-MM-DD
    description: Optional[str] = None
    cover_photo_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AlbumWithMeta(Album):
    photo_count: int = 0
    cover_url: Optional[str] = None


class AlbumWithPhotos(Album):
    photos: List[Photo] = []
    cover_url: Optional[str] = None
    photo_count: int = 0


class AlbumCreate(BaseModel):
    name: str
    date: Optional[str] = None
    description: Optional[str] = None


class AlbumUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None
    cover_photo_id: Optional[str] = None


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
    # Client info (name + phone optional)
    name: Optional[str] = None
    phone: Optional[str] = None
    # Optional album context (for nicer admin email copy)
    album_id: Optional[str] = None


class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: Optional[str] = None
    phone: Optional[str] = None
    email: str
    photo_ids: List[str]
    total: float
    payment_method: str
    status: str = "pending"  # pending | completed | cancelled
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    validated_at: Optional[str] = None
    email_sent: bool = False
    email_error: Optional[str] = None
    download_token: Optional[str] = None
    download_expires_at: Optional[str] = None
    download_url: Optional[str] = None
    # Extra workflow metadata for the "paid" manual flow
    proof: Optional[str] = None
    verified: bool = False
    downloaded_at: Optional[str] = None
    admin_notified: bool = False
    album_name: Optional[str] = None
    stripe_session_id: Optional[str] = None
    album_id: Optional[str] = None


class StripeCheckoutRequest(BaseModel):
    email: str
    photo_ids: List[str]
    album_id: Optional[str] = None
    origin_url: str


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
    """DEPRECATED for photo URLs — kept for email-template usage only.
    Returns absolute URL using PUBLIC_BASE_URL (must be a FRONTEND URL).
    For API resources like /api/files/... use the frontend's REACT_APP_BACKEND_URL instead
    (the frontend will hydrate the URL via resolveImageUrl).
    """
    if not url:
        return url
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if PUBLIC_BASE_URL:
        return f"{PUBLIC_BASE_URL.rstrip('/')}{url}"
    return url


def _hydrate_photo(doc: dict) -> dict:
    """Return photo.url as-is (relative or absolute).
    The frontend's resolveImageUrl() prefixes REACT_APP_BACKEND_URL for relative paths,
    which correctly resolves API resources (/api/files/...) and local uploads (/uploads/...)
    to the Render backend, not the Netlify frontend.
    External URLs (https://images.unsplash.com/...) are kept verbatim.
    """
    if isinstance(doc, dict) and "url" in doc and doc["url"] is None:
        doc["url"] = ""
    return doc


@api_router.get("/photos", response_model=List[Photo])
async def list_photos(album_id: Optional[str] = None):
    query = {}
    if album_id is not None:
        if album_id in ("none", "null", ""):
            query = {"$or": [{"album_id": None}, {"album_id": {"$exists": False}}]}
        else:
            query = {"album_id": album_id}
    photos = await db.photos.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [_hydrate_photo(p) for p in (photos or [])]


@api_router.post("/admin/login")
async def admin_login(body: AdminLogin):
    if body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")
    return {"success": True, "token": ADMIN_PASSWORD}


def _check_admin(token: Optional[str]):
    if not token or token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Non autorisé")


@api_router.get("/files/{path:path}")
async def serve_object_file(path: str):
    """Serve a file from Emergent Object Storage. Public endpoint (no auth) — gallery images
    are meant to be viewable; HD downloads are gated by validated orders + email links."""
    result = storage_get(path)
    if not result:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    data, content_type = result
    return Response(content=data, media_type=content_type, headers={
        "Cache-Control": "public, max-age=86400",
    })


async def _do_upload_photo(file: UploadFile, title: Optional[str], album_id: Optional[str], x_admin_token: Optional[str]):
    _check_admin(x_admin_token)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier doit être une image")

    ext = Path(file.filename or "").suffix.lower().lstrip(".") or "jpg"
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"

    # If album_id provided, verify it exists.
    clean_album_id: Optional[str] = None
    if album_id:
        album_id = album_id.strip()
        if album_id and album_id not in ("none", "null", ""):
            exists = await db.albums.find_one({"id": album_id}, {"_id": 0, "id": 1})
            if not exists:
                raise HTTPException(status_code=404, detail="Album introuvable")
            clean_album_id = album_id

    photo_id = str(uuid.uuid4())
    filename = f"{photo_id}.{ext}"
    data = await file.read()
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")

    # Try Emergent Object Storage first; fall back to local disk if unavailable.
    storage_path = f"{APP_NAME}/uploads/{filename}"
    rel_url: str
    upload_result = storage_put(storage_path, data, content_type) if EMERGENT_LLM_KEY else None

    if upload_result and upload_result.get("path"):
        # Persistent storage. URL is served via /api/files/{path:path}
        rel_url = f"/api/files/{upload_result['path']}"
        storage_kind = "object"
    else:
        # Fallback: local filesystem (will not persist across Render restarts).
        dest = UPLOAD_DIR / filename
        with dest.open("wb") as buffer:
            buffer.write(data)
        rel_url = f"/uploads/{filename}"
        storage_kind = "local"
        logging.getLogger(__name__).warning(
            f"Photo {photo_id} stored locally (object storage unavailable)"
        )

    photo = Photo(
        id=photo_id,
        url=rel_url,
        title=title or file.filename,
        source="upload",
        album_id=clean_album_id,
    )
    doc = photo.model_dump()
    # Persist storage_kind & path in DB for serving / future cleanup
    doc["storage_kind"] = storage_kind
    doc["storage_path"] = storage_path if storage_kind == "object" else f"uploads/{filename}"
    await db.photos.insert_one(doc)

    # If this is the first photo in the album, auto-set it as cover.
    if clean_album_id:
        album = await db.albums.find_one({"id": clean_album_id}, {"_id": 0})
        if album and not album.get("cover_photo_id"):
            await db.albums.update_one(
                {"id": clean_album_id}, {"$set": {"cover_photo_id": photo_id}}
            )

    return _hydrate_photo(doc)


@api_router.post("/photos", response_model=Photo)
async def upload_photo(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    album_id: Optional[str] = Form(None),
    x_admin_token: Optional[str] = Header(None),
):
    return await _do_upload_photo(file, title, album_id, x_admin_token)


# Alias route to match the conventional admin-prefixed pattern.
@api_router.post("/admin/photos/upload", response_model=Photo)
async def upload_photo_admin_alias(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    album_id: Optional[str] = Form(None),
    x_admin_token: Optional[str] = Header(None),
):
    return await _do_upload_photo(file, title, album_id, x_admin_token)


@api_router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, x_admin_token: Optional[str] = Header(None)):
    _check_admin(x_admin_token)
    photo = await db.photos.find_one({"id": photo_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo introuvable")

    # Cleanup. For local files we can hard delete; for object storage there's no delete API,
    # so the file remains in storage but the DB row is removed.
    if photo.get("source") == "upload":
        if photo.get("storage_kind") == "local" or photo.get("url", "").startswith("/uploads/"):
            url = photo.get("url", "")
            if url.startswith("/uploads/"):
                file_path = UPLOAD_DIR / url.replace("/uploads/", "")
                if file_path.exists():
                    file_path.unlink()

    await db.photos.delete_one({"id": photo_id})

    # If this photo was an album cover, clear it (album keeps existing).
    await db.albums.update_many(
        {"cover_photo_id": photo_id}, {"$set": {"cover_photo_id": None}}
    )
    return {"success": True}


# ============= ALBUMS =============

async def _album_meta(album: dict) -> dict:
    """Add photo_count and cover_url to an album document."""
    if not isinstance(album, dict):
        return album
    album["photo_count"] = await db.photos.count_documents({"album_id": album["id"]})

    cover_url = None
    cover_id = album.get("cover_photo_id")
    if cover_id:
        cover = await db.photos.find_one({"id": cover_id}, {"_id": 0, "url": 1})
        if cover:
            cover_url = cover.get("url") or None
    if not cover_url:
        # fallback: first photo of the album
        first = await db.photos.find_one(
            {"album_id": album["id"]}, {"_id": 0, "url": 1}, sort=[("created_at", 1)]
        )
        if first:
            cover_url = first.get("url") or None
    album["cover_url"] = cover_url
    return album


@api_router.get("/albums", response_model=List[AlbumWithMeta])
async def list_albums():
    albums = await db.albums.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    return [await _album_meta(a) for a in (albums or [])]


@api_router.get("/albums/{album_id}", response_model=AlbumWithPhotos)
async def get_album(album_id: str):
    album = await db.albums.find_one({"id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album introuvable")
    photos = await db.photos.find(
        {"album_id": album_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    album["photos"] = [_hydrate_photo(p) for p in (photos or [])]
    await _album_meta(album)
    return album


@api_router.post("/admin/albums", response_model=AlbumWithMeta)
async def create_album(body: AlbumCreate, x_admin_token: Optional[str] = Header(None)):
    _check_admin(x_admin_token)
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="Le nom de l'album est requis")
    album = Album(
        name=body.name.strip(),
        date=(body.date or "").strip() or None,
        description=(body.description or "").strip() or None,
    )
    doc = album.model_dump()
    await db.albums.insert_one(doc)
    return await _album_meta(doc)


@api_router.put("/admin/albums/{album_id}", response_model=AlbumWithMeta)
async def update_album(
    album_id: str,
    body: AlbumUpdate,
    x_admin_token: Optional[str] = Header(None),
):
    _check_admin(x_admin_token)
    album = await db.albums.find_one({"id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album introuvable")

    updates: dict = {}
    if body.name is not None and body.name.strip():
        updates["name"] = body.name.strip()
    if body.date is not None:
        updates["date"] = body.date.strip() or None
    if body.description is not None:
        updates["description"] = body.description.strip() or None
    if body.cover_photo_id is not None:
        # verify photo belongs to this album
        if body.cover_photo_id:
            p = await db.photos.find_one(
                {"id": body.cover_photo_id, "album_id": album_id}, {"_id": 0, "id": 1}
            )
            if not p:
                raise HTTPException(status_code=400, detail="La photo de couverture doit appartenir à cet album")
        updates["cover_photo_id"] = body.cover_photo_id or None

    if updates:
        await db.albums.update_one({"id": album_id}, {"$set": updates})
        album.update(updates)
    return await _album_meta(album)


@api_router.delete("/admin/albums/{album_id}")
async def delete_album(
    album_id: str,
    delete_photos: bool = False,
    x_admin_token: Optional[str] = Header(None),
):
    _check_admin(x_admin_token)
    album = await db.albums.find_one({"id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album introuvable")

    if delete_photos:
        # Delete all photos in album (including files for uploads).
        photos = await db.photos.find({"album_id": album_id}, {"_id": 0}).to_list(5000)
        for p in photos:
            if p.get("source") == "upload":
                url = p.get("url", "")
                if url.startswith("/uploads/"):
                    file_path = UPLOAD_DIR / url.replace("/uploads/", "")
                    if file_path.exists():
                        file_path.unlink()
        await db.photos.delete_many({"album_id": album_id})
    else:
        # Just unassign photos from album, keep them.
        await db.photos.update_many({"album_id": album_id}, {"$set": {"album_id": None}})

    await db.albums.delete_one({"id": album_id})
    return {"success": True, "deleted_photos": bool(delete_photos)}


# ============= ORDERS =============

async def _hydrate_order(order: dict) -> dict:
    """Attach Photo objects to an order document with absolute URLs."""
    photo_docs = await db.photos.find(
        {"id": {"$in": order.get("photo_ids", [])}}, {"_id": 0}
    ).to_list(1000)
    by_id = {p["id"]: _hydrate_photo(p) for p in photo_docs}
    order["photos"] = [by_id[pid] for pid in order.get("photo_ids", []) if pid in by_id]
    # Resolve album name for emails + admin UI
    if order.get("album_id"):
        album = await db.albums.find_one({"id": order["album_id"]}, {"_id": 0, "name": 1})
        order["album_name"] = album.get("name") if album else "Galerie"
    else:
        order["album_name"] = "Galerie"
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
        name=body.name,
        phone=body.phone,
        album_id=body.album_id,
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


class OrderPaid(BaseModel):
    proof: Optional[str] = None


@api_router.post("/orders/{order_id}/paid", response_model=OrderWithPhotos)
async def mark_order_paid(
    order_id: str,
    body: OrderPaid,
    request: Request,
):
    """
    Client-side manual payment confirmation for PayPal/Wero/Revolut.
    Generates the secure 48h download token, sends the customer HD email and
    notifies the admin/photographer by email.
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    if order.get("status") == "refused":
        raise HTTPException(status_code=403, detail="Commande refusée")

    # Idempotency: if token already exists, keep the same link, but still
    # re-attempt missing email steps (best-effort).
    public_base = _resolve_public_base(request)

    if order.get("status") == "completed" and order.get("download_token"):
        if body.proof is not None and not order.get("proof"):
            await db.orders.update_one({"id": order_id}, {"$set": {"proof": body.proof}})

        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if not order.get("download_url"):
            order["download_url"] = (
                f"{public_base}/download/{order['download_token']}"
                if public_base
                else f"/download/{order['download_token']}"
            )
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"download_url": order["download_url"]}},
            )
        await _hydrate_order(order)

        album_name = order.get("album_name")
        if not order.get("email_sent"):
            sent, send_error = _send_download_email(order, album_name=album_name)
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"email_sent": sent, "email_error": (send_error or None)}},
            )
            order["email_sent"] = sent
            order["email_error"] = send_error

        if not order.get("admin_notified"):
            base = (PUBLIC_BASE_URL or "").rstrip("/")
            admin_order_url = (
                f"{base}/admin?order_id={order_id}" if base else f"/admin?order_id={order_id}"
            )
            admin_ok, _ = _send_admin_notification_email(order, order.get("photos") or [], admin_order_url)
            await db.orders.update_one({"id": order_id}, {"$set": {"admin_notified": admin_ok}})
            order["admin_notified"] = admin_ok

        return order

    now = datetime.now(timezone.utc).isoformat()
    token = _gen_download_token()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=DOWNLOAD_TOKEN_TTL_HOURS)).isoformat()
    logger.info(
        f"[DOWNLOAD TOKEN CREATED] order={order_id} token={token[:12]}... expires_at={expires_at}"
    )

    update_fields = {
        "status": "completed",
        "validated_at": now,
        "download_token": token,
        "download_expires_at": expires_at,
        "download_url": f"{public_base}/download/{token}" if public_base else f"/download/{token}",
    }
    if body.proof is not None:
        update_fields["proof"] = body.proof

    upd = await db.orders.update_one({"id": order_id}, {"$set": update_fields})
    logger.info(
        f"[DOWNLOAD TOKEN SAVED] order={order_id} matched={upd.matched_count} modified={upd.modified_count}"
    )

    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    logger.info(
        f"[DOWNLOAD TOKEN REFETCH] order={order_id} has_token={bool(order and order.get('download_token'))} "
        f"has_url={bool(order and order.get('download_url'))} has_expires={bool(order and order.get('download_expires_at'))}"
    )
    await _hydrate_order(order)

    album_name = order.get("album_name")
    sent, send_error = _send_download_email(order, album_name=album_name)
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"email_sent": sent, "email_error": (send_error or None)}},
    )
    order["email_sent"] = sent
    order["email_error"] = send_error

    base = (PUBLIC_BASE_URL or "").rstrip("/")
    admin_order_url = (
        f"{base}/admin?order_id={order_id}" if base else f"/admin?order_id={order_id}"
    )
    admin_ok, _ = _send_admin_notification_email(order, order.get("photos") or [], admin_order_url)
    await db.orders.update_one({"id": order_id}, {"$set": {"admin_notified": admin_ok}})
    order["admin_notified"] = admin_ok

    return order


@api_router.get("/admin/orders", response_model=List[OrderWithPhotos])
async def list_orders(x_admin_token: Optional[str] = Header(None)):
    _check_admin(x_admin_token)
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    base = (PUBLIC_BASE_URL or "").rstrip("/")
    for o in orders:
        if o.get("status") == "completed" and o.get("download_token"):
            o["download_url"] = f"{base}/download/{o['download_token']}" if base else f"/download/{o['download_token']}"
        await _hydrate_order(o)
    return orders


@api_router.post("/admin/orders/{order_id}/validate", response_model=OrderWithPhotos)
async def validate_order(
    order_id: str, x_admin_token: Optional[str] = Header(None)
):
    """Manual admin validation for PayPal/Wero/Revolut orders.
    On validation:
      - generates a secure download token (valid 48 hours)
      - generates the public download_url and ALWAYS returns it (even if email fails)
      - attempts to send the automated SendGrid email with the link
    Idempotent: re-validating a completed order returns the existing token + URL.
    NEVER returns an HTTP error when only the email step fails — the admin UI uses
    `email_sent` + `email_error` to display a copy-fallback for manual sending.
    """
    _check_admin(x_admin_token)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    base = (PUBLIC_BASE_URL or "").rstrip("/")

    if order["status"] == "completed":
        # Already validated — just refresh the helper fields and return
        if order.get("download_token"):
            order["download_url"] = f"{base}/download/{order['download_token']}" if base else f"/download/{order['download_token']}"
        await _hydrate_order(order)
        return order

    # Generate secure download token + 48h expiration
    token = _gen_download_token()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=DOWNLOAD_TOKEN_TTL_HOURS)).isoformat()
    now = datetime.now(timezone.utc).isoformat()
    download_url = f"{base}/download/{token}" if base else f"/download/{token}"

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "completed",
            "validated_at": now,
            "download_token": token,
            "download_expires_at": expires_at,
            "download_url": download_url,
        }},
    )
    order["status"] = "completed"
    order["validated_at"] = now
    order["download_token"] = token
    order["download_expires_at"] = expires_at
    order["download_url"] = download_url

    logger.info(f"[ORDER VALIDATED] id={order_id} email={order['email']} token={token[:12]}... url={download_url}")

    # Resolve album name (for email copy)
    album_name = "Galerie"
    if order.get("album_id"):
        album = await db.albums.find_one({"id": order["album_id"]}, {"_id": 0, "name": 1})
        if album:
            album_name = album.get("name")

    # Send the automated download email (best-effort)
    sent, send_error = _send_download_email(order, album_name=album_name)

    # Persist email outcome
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"email_sent": sent, "email_error": (send_error or None)}},
    )
    order["email_sent"] = sent
    order["email_error"] = send_error

    if sent:
        logger.info(f"[EMAIL OK] order={order_id} to={order['email']}")
    else:
        logger.error(f"[EMAIL FAILED] order={order_id} to={order['email']} error={send_error}")

    await _hydrate_order(order)
    # Always 200. Admin UI displays the email_error + copy-to-clipboard download link.
    return order


@api_router.post("/admin/orders/{order_id}/resend", response_model=OrderWithPhotos)
async def resend_order_email(
    order_id: str,
    x_admin_token: Optional[str] = Header(None),
):
    """Admin helper to re-send the customer email with the already-generated link."""
    _check_admin(x_admin_token)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order.get("status") != "completed" or not order.get("download_token"):
        raise HTTPException(status_code=400, detail="Commande non validée / lien indisponible")

    await _hydrate_order(order)
    album_name = order.get("album_name")
    sent, send_error = _send_download_email(order, album_name=album_name)
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"email_sent": sent, "email_error": (send_error or None)}},
    )
    order["email_sent"] = sent
    order["email_error"] = send_error
    return order


@api_router.post("/admin/orders/{order_id}/verify", response_model=OrderWithPhotos)
async def verify_order(
order_id: str,
x_admin_token: Optional[str] = Header(None),
):
return await mark_order_paid(order_id, x_admin_token)



@api_router.post("/admin/orders/{order_id}/refuse", response_model=OrderWithPhotos)
async def refuse_order(
    order_id: str,
    x_admin_token: Optional[str] = Header(None),
):
    """Admin refusal: blocks future downloads by switching status."""
    _check_admin(x_admin_token)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "status": "refused",
                "verified": False,
                "download_token": None,
                "download_expires_at": None,
                "download_url": None,
            }
        },
    )
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await _hydrate_order(order)
    return order


@api_router.delete("/admin/orders/{order_id}")
async def delete_order(order_id: str, x_admin_token: Optional[str] = Header(None)):
    _check_admin(x_admin_token)
    res = await db.orders.delete_one({"id": order_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return {"success": True}


# ============= STRIPE PAYMENTS + DOWNLOAD =============

PACK_PRICES = {1: 3.0, 3: 8.0, 5: 12.0}


def _compute_pack_total(count: int) -> float:
    """Compute minimum cost using packs of 1=3€, 3=8€, 5=12€ (DP)."""
    if count <= 0:
        return 0.0
    INF = float("inf")
    dp = [INF] * (count + 1)
    dp[0] = 0.0
    for i in range(1, count + 1):
        for qty, price in PACK_PRICES.items():
            if i - qty >= 0 and dp[i - qty] + price < dp[i]:
                dp[i] = dp[i - qty] + price
    return round(dp[count], 2)


def _gen_download_token() -> str:
    return secrets.token_urlsafe(40)


def _resolve_public_base(request: Optional[Request] = None) -> str:
    """
    Resolve the best public frontend base URL for download links.
    Priority:
      1) PUBLIC_BASE_URL env (production canonical)
      2) Origin header (when called from frontend)
      3) Request base URL (backend host fallback)
    """
    if PUBLIC_BASE_URL:
        return PUBLIC_BASE_URL.rstrip("/")
    if request is not None:
        origin = request.headers.get("origin")
        if origin:
            return origin.rstrip("/")
        return str(request.base_url).rstrip("/")
    return ""


def _send_download_email(order: dict, album_name: Optional[str] = None) -> tuple:
    """Send the customer email with their secure download link."""
    download_url = order.get("download_url") or ""
    if not download_url:
        base = (PUBLIC_BASE_URL or "").rstrip("/")
        download_url = f"{base}/download/{order['download_token']}" if base else f"/download/{order['download_token']}"
    photo_count = len(order.get("photo_ids", []))

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#050505;color:#fff;padding:40px 24px;">
      <h1 style="color:#E8B23A;font-family:Georgia,serif;font-weight:300;font-size:32px;margin:0 0 8px;">Merci pour votre achat !</h1>
      <p style="color:#aaa;font-size:14px;letter-spacing:2px;text-transform:uppercase;margin:0 0 24px;">No.Photo.Pix · Paiement confirmé</p>
      <p style="color:#fff;font-size:16px;line-height:1.6;">
        Votre paiement de <strong style="color:#E8B23A;">{order['total']} €</strong> a été confirmé.
        Vous avez accès au téléchargement HD de <strong>{photo_count} photo(s)</strong>{f" de l'album <em>{album_name}</em>" if album_name else ""}.
      </p>
      <div style="margin:32px 0;text-align:center;">
        <a href="{download_url}"
           style="display:inline-block;background:linear-gradient(135deg,#E8B23A,#FFD66B,#C8902A);color:#000;
                  padding:14px 28px;border-radius:4px;text-decoration:none;font-weight:600;
                  letter-spacing:1px;font-size:14px;">
          TÉLÉCHARGER MES PHOTOS
        </a>
      </div>
      <p style="color:#888;font-size:13px;line-height:1.6;">
        Ce lien est valable pendant <strong>48 heures</strong> à compter de la réception de cet email.
        Téléchargements illimités pendant cette période. Conservez vos photos en local.
      </p>
      <p style="color:#666;font-size:12px;margin-top:14px;">
        Si vous n’avez pas finalisé le paiement, votre accès pourra être désactivé.
      </p>
      <p style="color:#666;font-size:11px;margin-top:32px;word-break:break-all;">
        Lien direct : {download_url}
      </p>
      <p style="color:#666;font-size:12px;margin-top:24px;border-top:1px solid #222;padding-top:16px;">
        Une question ? Contactez-nous sur Instagram <a href="https://www.instagram.com/no_photo_pix/" style="color:#E8B23A;">@no_photo_pix</a>.
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
                subject=f"Vos photos No.Photo.Pix sont prêtes ({photo_count} photo(s))",
                html_content=html,
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            resp = sg.send(message)
            logger.info(f"[SENDGRID OK] to={order['email']} from={SENDER_EMAIL} status={resp.status_code} download={download_url}")
            return True, None
        except Exception as exc:
            err_text = str(exc)
            body = getattr(exc, "body", None)
            if body:
                try:
                    err_text = f"{err_text} | body={body.decode() if isinstance(body, bytes) else body}"
                except Exception:
                    pass
            logger.error(
                f"[SENDGRID FAILED] to={order['email']} from={SENDER_EMAIL} error={err_text}"
            )
            # Friendly French message for the admin UI
            friendly = err_text
            low = err_text.lower()
            if "401" in low or "unauthorized" in low or "authorization grant" in low:
                friendly = (
                    "Clé SendGrid invalide ou révoquée. "
                    "Régénère une clé sur SendGrid → Settings → API Keys et "
                    "mets-la à jour dans la variable d'environnement SENDGRID_API_KEY (Render)."
                )
            elif "403" in low or "forbidden" in low or "from address does not match" in low or "does not match a verified" in low:
                friendly = (
                    f"L'adresse expéditeur ({SENDER_EMAIL}) n'est pas vérifiée dans SendGrid. "
                    "Va sur SendGrid → Settings → Sender Authentication → Single Sender Verification "
                    "pour vérifier cette adresse (ou utilise une adresse depuis un domaine que tu as vérifié)."
                )
            elif "does not contain a valid address" in low or "bad request" in low:
                friendly = "Adresse email destinataire invalide."
            return False, friendly
    else:
        logger.warning(
            f"[EMAIL NOT SENT] No SENDGRID_API_KEY configured — download URL: {download_url} (recipient: {order['email']})"
        )
        # No key configured -> treat as 'not sent' so admin sees the fallback UI
        return False, "Aucune clé SendGrid configurée (SENDGRID_API_KEY manquante). Copie le lien et envoie-le manuellement au client."


def _send_admin_notification_email(
    order: dict,
    ordered_photos: list,
    admin_order_url: str,
):
    """
    Send a SendGrid notification to the photographer/admin with the order details.
    Best-effort: returns (success: bool, error_message: Optional[str]).
    """
    client_name = (order.get("name") or "").strip() or "—"
    client_phone = (order.get("phone") or "").strip() or "—"
    proof = (order.get("proof") or "").strip() or "Aucune preuve fournie."
    album_name = order.get("album_name") or "Galerie"
    order_time = order.get("created_at") or "—"
    order_status = order.get("status") or "—"
    photo_count = len(ordered_photos)

    photo_list_items = ""
    for p in ordered_photos:
        title = p.get("title") or p.get("id") or "Photo"
        photo_list_items += f"<li style='margin:6px 0;color:#fff;'>{title}</li>"

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;background:#050505;color:#fff;padding:32px 24px;">
      <h1 style="color:#E8B23A;font-family:Georgia,serif;font-weight:300;font-size:28px;margin:0 0 16px;">
        Nouvelle commande NO.PHOTO.PIX
      </h1>
      <div style="color:#aaa;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin-bottom:22px;">
        No.Photo.Pix · Commande client
      </div>

      <div style="background:#0a0a0a;border:1px solid #222;padding:16px 16px;margin-bottom:18px;">
        <p style="margin:8px 0;"><strong style="color:#E8B23A;">Nom client :</strong> {client_name}</p>
        <p style="margin:8px 0;"><strong style="color:#E8B23A;">Email :</strong> {order.get('email','')}</p>
        <p style="margin:8px 0;"><strong style="color:#E8B23A;">Téléphone :</strong> {client_phone}</p>
        <p style="margin:8px 0;"><strong style="color:#E8B23A;">Méthode de paiement :</strong> {order.get('payment_method','')}</p>
        <p style="margin:8px 0;"><strong style="color:#E8B23A;">Montant :</strong> <span style="color:#E8B23A;">{order.get('total','')} €</span></p>
        <p style="margin:8px 0;"><strong style="color:#E8B23A;">Album :</strong> {album_name}</p>
        <p style="margin:8px 0;"><strong style="color:#E8B23A;">Nombre de photos :</strong> {photo_count}</p>
        <p style="margin:8px 0;"><strong style="color:#E8B23A;">Heure de la commande :</strong> {order_time}</p>
        <p style="margin:8px 0;"><strong style="color:#E8B23A;">Statut :</strong> {order_status}</p>
      </div>

      <div style="background:#0a0a0a;border:1px solid #222;padding:16px 16px;margin-bottom:18px;">
        <p style="margin:0 0 10px;"><strong style="color:#E8B23A;">Photos commandées :</strong></p>
        <ul style="padding-left:18px;margin:0;list-style:disc;line-height:1.4;">
          {photo_list_items or "<li style='margin:6px 0;color:#fff;'>—</li>"}
        </ul>
      </div>

      <div style="background:#0a0a0a;border:1px solid #222;padding:16px 16px;margin-bottom:18px;">
        <p style="margin:0 0 10px;"><strong style="color:#E8B23A;">Lien admin commande :</strong></p>
        <p style="margin:0;color:#fff;word-break:break-all;">
          <a href="{admin_order_url}" style="color:#E8B23A;text-decoration:none;">{admin_order_url}</a>
        </p>
      </div>

      <div style="background:#0a0a0a;border:1px solid #222;padding:16px 16px;">
        <p style="margin:0 0 10px;"><strong style="color:#E8B23A;">Preuve optionnelle :</strong></p>
        <p style="margin:0;color:#ddd;word-break:break-word;line-height:1.4;">{proof}</p>
      </div>
    </div>
    """

    if SENDGRID_API_KEY:
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail, From

            message = Mail(
                from_email=From(SENDER_EMAIL, SENDER_NAME),
                to_emails=ADMIN_NOTIFICATION_EMAIL,
                subject="Nouvelle commande NO.PHOTO.PIX",
                html_content=html,
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            resp = sg.send(message)
            logger.info(
                f"[ADMIN EMAIL OK] to={ADMIN_NOTIFICATION_EMAIL} order={order.get('id')} status={resp.status_code}"
            )
            return True, None
        except Exception as exc:
            err_text = str(exc)
            logger.error(
                f"[ADMIN EMAIL FAILED] to={ADMIN_NOTIFICATION_EMAIL} order={order.get('id')} error={err_text}"
            )
            return False, err_text

    logger.warning(
        f"[ADMIN EMAIL NOT SENT] SENDGRID_API_KEY manquante — order={order.get('id')}."
    )
    return False, "SENDGRID_API_KEY manquante"


def _get_stripe_checkout(host_url: str):
    """Initialize Stripe checkout helper. Uses STRIPE_API_KEY env var (sk_test_emergent by default)."""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


@api_router.post("/payments/checkout/session")
async def create_stripe_checkout(body: StripeCheckoutRequest, request: Request):
    """Create a Stripe Checkout Session for the selected photos. Amount computed server-side."""
    raise HTTPException(status_code=404, detail="Stripe non disponible (paiements manuels uniquement)")

    from emergentintegrations.payments.stripe.checkout import CheckoutSessionRequest

    if "@" not in body.email or "." not in body.email:
        raise HTTPException(status_code=400, detail="Email invalide")
    if not body.photo_ids:
        raise HTTPException(status_code=400, detail="Aucune photo sélectionnée")
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")

    # Verify photos exist
    photo_ids = list(dict.fromkeys(body.photo_ids))  # dedupe, preserve order
    found = await db.photos.count_documents({"id": {"$in": photo_ids}})
    if found != len(photo_ids):
        raise HTTPException(status_code=400, detail="Photos invalides")

    # ✋ Backend-computed amount (never trust frontend).
    amount = _compute_pack_total(len(photo_ids))

    # Build URLs from origin
    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/"

    # Pre-create order in DB (pending)
    order = Order(
        email=body.email.strip().lower(),
        photo_ids=photo_ids,
        total=amount,
        payment_method="stripe",
        album_id=body.album_id,
    )
    await db.orders.insert_one(order.model_dump())

    # Create Stripe session
    host_url = str(request.base_url)
    stripe_checkout = _get_stripe_checkout(host_url)
    session = await stripe_checkout.create_checkout_session(
        CheckoutSessionRequest(
            amount=amount,
            currency="eur",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "order_id": order.id,
                "email": order.email,
                "photo_count": str(len(photo_ids)),
                "album_id": body.album_id or "",
            },
        )
    )

    # Record payment transaction
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "order_id": order.id,
        "email": order.email,
        "amount": amount,
        "currency": "eur",
        "payment_status": "initiated",
        "status": "open",
        "metadata": {"order_id": order.id, "photo_count": str(len(photo_ids))},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Link session to order
    await db.orders.update_one(
        {"id": order.id}, {"$set": {"stripe_session_id": session.session_id}}
    )

    return {"url": session.url, "session_id": session.session_id, "order_id": order.id}


async def _finalize_paid_order(session_id: str) -> Optional[dict]:
    """Idempotent finalization: mark order paid, generate token, send email. Safe to call multiple times."""
    order = await db.orders.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not order:
        return None
    if order["status"] == "completed" and order.get("download_token"):
        return order  # already processed

    token = _gen_download_token()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=DOWNLOAD_TOKEN_TTL_HOURS)).isoformat()
    now = datetime.now(timezone.utc).isoformat()
    base = _resolve_public_base()
    download_url = f"{base}/download/{token}" if base else f"/download/{token}"

    await db.orders.update_one(
        {"id": order["id"], "status": {"$ne": "completed"}},
        {"$set": {
            "status": "completed",
            "validated_at": now,
            "download_token": token,
            "download_expires_at": expires_at,
            "download_url": download_url,
        }},
    )

    # Re-fetch fresh
    order = await db.orders.find_one({"id": order["id"]}, {"_id": 0})

    # Send email (best-effort)
    album_name = None
    if order.get("album_id"):
        album = await db.albums.find_one({"id": order["album_id"]}, {"_id": 0, "name": 1})
        if album:
            album_name = album.get("name")
    sent, send_error = _send_download_email(order, album_name=album_name)
    await db.orders.update_one(
        {"id": order["id"]},
        {"$set": {"email_sent": sent, "email_error": (send_error or None)}},
    )
    order["email_sent"] = sent
    order["email_error"] = send_error
    return order


@api_router.get("/payments/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    """Poll Stripe session status. Finalizes order (idempotent) when status=paid."""
    raise HTTPException(status_code=404, detail="Stripe non disponible (paiements manuels uniquement)")

    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")
    host_url = str(request.base_url)
    stripe_checkout = _get_stripe_checkout(host_url)
    status = await stripe_checkout.get_checkout_status(session_id)

    # Update payment_transactions
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": status.status,
            "payment_status": status.payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    response = {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }
    if status.payment_status == "paid":
        order = await _finalize_paid_order(session_id)
        if order:
            response["order_id"] = order["id"]
            response["download_token"] = order.get("download_token")
    return response


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Stripe webhook receiver. Validates signature and finalizes orders."""
    raise HTTPException(status_code=404, detail="Stripe non disponible (paiements manuels uniquement)")

    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")
    body = await request.body()
    host_url = str(request.base_url)
    stripe_checkout = _get_stripe_checkout(host_url)
    try:
        webhook_response = await stripe_checkout.handle_webhook(
            body, request.headers.get("Stripe-Signature")
        )
    except Exception as exc:
        logger.error(f"Stripe webhook failed: {exc}")
        raise HTTPException(status_code=400, detail="Webhook invalide")

    # Update payment_transactions
    if webhook_response.session_id:
        await db.payment_transactions.update_one(
            {"session_id": webhook_response.session_id},
            {"$set": {
                "event_type": webhook_response.event_type,
                "event_id": webhook_response.event_id,
                "payment_status": webhook_response.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if webhook_response.payment_status == "paid":
            await _finalize_paid_order(webhook_response.session_id)
    return {"received": True}


# ============= DOWNLOAD =============

async def _get_download_order(token: str) -> dict:
    token = (token or "").strip()
    logger.info(f"[DOWNLOAD TOKEN RECEIVED] token={token[:20]}... length={len(token)}")
    if not token:
        logger.error("[DOWNLOAD ERROR REASON] empty token")
        raise HTTPException(status_code=404, detail="Lien invalide")
    order = await db.orders.find_one({"download_token": token}, {"_id": 0})
    logger.info(f"[DOWNLOAD ORDER FOUND] {bool(order)}")
    allowed_statuses = {
        "payment_declared",
        "completed",
        "link_sent",
        "validated",
        "verified",
        "downloaded",
    }
    if order:
        logger.info(f"[DOWNLOAD ORDER STATUS] {order.get('status')}")
    if not order or order.get("status") not in allowed_statuses:
        logger.error(
            f"[DOWNLOAD ERROR REASON] not found or invalid status status={order.get('status') if order else 'none'}"
        )
        raise HTTPException(status_code=404, detail="Lien invalide ou commande non payée")
    # Check expiration
    expires_str = order.get("download_expires_at")
    logger.info(f"[DOWNLOAD EXPIRES_AT] {expires_str}")
    logger.info(f"[DOWNLOAD CURRENT_TIME] {datetime.now(timezone.utc).isoformat()}")
    if expires_str:
        try:
            expires = datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires:
                logger.error("[DOWNLOAD ERROR REASON] token expired")
                raise HTTPException(status_code=410, detail="Ce lien de téléchargement a expiré")
        except (ValueError, TypeError):
            logger.error("[DOWNLOAD ERROR REASON] invalid expires_at format")
    return order


@api_router.get("/download/{token}")
async def download_info(token: str):
    """Public endpoint to get the order content for a download token."""
    order = await _get_download_order(token)
    photos = await db.photos.find(
        {"id": {"$in": order.get("photo_ids", [])}}, {"_id": 0}
    ).to_list(2000)
    by_id = {p["id"]: _hydrate_photo(p) for p in photos}
    ordered_photos = [by_id[pid] for pid in order["photo_ids"] if pid in by_id]

    album_name = None
    if order.get("album_id"):
        album = await db.albums.find_one({"id": order["album_id"]}, {"_id": 0, "name": 1})
        if album:
            album_name = album.get("name")

    return {
        "order_id": order["id"],
        "email": order["email"],
        "total": order["total"],
        "validated_at": order.get("validated_at"),
        "expires_at": order.get("download_expires_at"),
        "album_name": album_name,
        "photos": ordered_photos,
    }


@api_router.get("/download/{token}/file/{photo_id}")
async def download_file(token: str, photo_id: str):
    """Stream a specific photo file (must belong to the validated order)."""
    order = await _get_download_order(token)
    # Mark as downloaded on first successful access (idempotent-ish).
    try:
        await db.orders.update_one(
            {"id": order.get("id"), "downloaded_at": {"$exists": False}},
            {"$set": {"downloaded_at": datetime.now(timezone.utc).isoformat()}},
        )
    except Exception:
        # Download streaming should not fail because the analytics update failed.
        pass
    if photo_id not in order.get("photo_ids", []):
        raise HTTPException(status_code=403, detail="Photo non autorisée pour ce lien")
    photo = await db.photos.find_one({"id": photo_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo introuvable")

    storage_path = photo.get("storage_path")
    if photo.get("storage_kind") == "object" and storage_path:
        result = storage_get(storage_path)
        if not result:
            raise HTTPException(status_code=404, detail="Fichier introuvable")
        data, content_type = result
        ext = (storage_path.rsplit(".", 1)[-1] or "jpg").lower()
        filename = f"nophotopix-{photo_id[:8]}.{ext}"
        return Response(
            content=data,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "private, max-age=3600",
            },
        )

    # Fallback for local storage
    url = photo.get("url", "")
    if url.startswith("/uploads/"):
        file_path = UPLOAD_DIR / url.replace("/uploads/", "")
        if file_path.exists():
            ext = file_path.suffix.lstrip(".") or "jpg"
            return Response(
                content=file_path.read_bytes(),
                media_type=MIME_TYPES.get(ext, "application/octet-stream"),
                headers={
                    "Content-Disposition": f'attachment; filename="nophotopix-{photo_id[:8]}.{ext}"',
                },
            )

    # External URL (e.g., Unsplash seed photos) — proxy the bytes so we keep the
    # secure token gating and force a proper download filename.
    if url.startswith("http://") or url.startswith("https://"):
        try:
            r = requests.get(url, timeout=60, stream=False)
            r.raise_for_status()
            content_type = r.headers.get("Content-Type", "image/jpeg")
            ext = "jpg"
            if "png" in content_type:
                ext = "png"
            elif "webp" in content_type:
                ext = "webp"
            elif "gif" in content_type:
                ext = "gif"
            return Response(
                content=r.content,
                media_type=content_type,
                headers={
                    "Content-Disposition": f'attachment; filename="nophotopix-{photo_id[:8]}.{ext}"',
                    "Cache-Control": "private, max-age=3600",
                },
            )
        except Exception as exc:
            logger.error(f"Proxy download failed for {photo_id}: {exc}")

    raise HTTPException(status_code=404, detail="Fichier indisponible")


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

async def _migrate_photo_urls():
    """One-shot migration: strip any legacy frontend-host prefix from photo.url so the
    URL becomes relative again (/api/files/... or /uploads/...). The frontend then
    correctly resolves them via REACT_APP_BACKEND_URL.

    This is idempotent and safe: photos that already store relative URLs or external
    https URLs are left untouched. Targets the well-known accidental prefix observed
    in earlier deploys (PUBLIC_BASE_URL pointing to the Netlify frontend).
    """
    # Known bad prefixes — extend if more domains are observed
    bad_prefixes = [
        "https://venerable-beignet-9414de.netlify.app",
        "http://venerable-beignet-9414de.netlify.app",
    ]
    # Also strip the currently-configured PUBLIC_BASE_URL if it is a frontend URL
    if PUBLIC_BASE_URL:
        pb = PUBLIC_BASE_URL.rstrip("/")
        if pb and pb not in bad_prefixes:
            bad_prefixes.append(pb)

    fixed = 0
    for prefix in bad_prefixes:
        # Only strip when followed by an API/upload path — never strip from external image hosts
        async for doc in db.photos.find(
            {"url": {"$regex": f"^{prefix}/(api/files/|uploads/)"}}, {"_id": 1, "url": 1}
        ):
            new_url = doc["url"][len(prefix):]
            await db.photos.update_one({"_id": doc["_id"]}, {"$set": {"url": new_url}})
            fixed += 1
    if fixed:
        logger.info(f"Migrated {fixed} photo URL(s) to relative form")


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    # Initialize object storage (best-effort — uploads fall back to local disk if it fails).
    if EMERGENT_LLM_KEY:
        key = init_storage()
        if key:
            logger.info("Emergent Object Storage initialized")
        else:
            logger.warning("Emergent Object Storage init failed — uploads will use local disk")
    else:
        logger.info("EMERGENT_LLM_KEY not set — uploads will use local disk")
    await seed_photos()
    await _migrate_photo_urls()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
