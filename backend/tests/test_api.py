"""Backend tests for No_Photo_PIX API"""
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://image-select-pay.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = "Noclan97140$"


def _png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), (10, 10, 10)).save(buf, format="PNG")
    buf.seek(0)
    return buf


def _jpeg_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (200, 100, 50)).save(buf, format="JPEG", quality=80)
    buf.seek(0)
    return buf


class TestConfig:
    def test_config(self):
        r = requests.get(f"{API}/config", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["price_per_photo"] == 3
        assert d["paypal_handle"] == "nophotopix"
        assert d["revolut_handle"] == "nophotopix"
        assert d["wero_phone"] == "+33760599312"
        assert d["wero_phone_display"] == "07 60 59 93 12"
        assert d["currency"] == "EUR"


class TestPhotos:
    def test_list_photos_seeded(self):
        r = requests.get(f"{API}/photos", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 8
        for p in data:
            assert "_id" not in p
            assert "id" in p and "url" in p and "source" in p
            assert p["source"] in ("unsplash", "upload")


class TestAdminLogin:
    def test_login_success(self):
        r = requests.post(f"{API}/admin/login", json={"password": ADMIN_PASSWORD}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["token"] == ADMIN_PASSWORD

    def test_login_wrong(self):
        r = requests.post(f"{API}/admin/login", json={"password": "bad"}, timeout=10)
        assert r.status_code == 401


# ============= PHOTO URL FIX (iteration 6) =============
class TestPhotoUrlFix:
    """Verify backend returns relative URLs for uploaded photos
    and Unsplash external URLs verbatim. Also tests that uploaded URL is
    fetchable via {BASE_URL}/api/files/... returning 200 image/*."""

    HDRS = {"X-Admin-Token": ADMIN_PASSWORD}

    def test_unsplash_urls_returned_verbatim(self):
        """At least one seeded photo should have an external https unsplash URL kept as-is."""
        r = requests.get(f"{API}/photos", timeout=10)
        assert r.status_code == 200
        data = r.json()
        unsplash = [p for p in data if p["source"] == "unsplash"]
        assert len(unsplash) >= 1, "Expected at least 1 unsplash seeded photo"
        for p in unsplash:
            assert p["url"].startswith("https://images.unsplash.com/"), (
                f"Unsplash URL must be verbatim, got: {p['url']}"
            )
            # MUST NOT be prefixed with the legacy Netlify host
            assert "venerable-beignet" not in p["url"]

    def test_uploaded_jpeg_returns_relative_url(self):
        """POST a JPEG and assert response.url is RELATIVE (starts with /api/files/nophotopix/uploads/
        or /uploads/) — NOT an absolute Netlify URL."""
        files = {"file": ("TEST_relurl.jpg", _jpeg_bytes(), "image/jpeg")}
        r = requests.post(f"{API}/photos", files=files, headers=self.HDRS,
                          data={"title": "TEST_relurl"}, timeout=15)
        assert r.status_code == 200, r.text
        photo = r.json()
        pid = photo["id"]
        try:
            url = photo["url"]
            # Must be relative — not absolute http(s)
            assert not url.startswith("http://"), f"URL is absolute: {url}"
            assert not url.startswith("https://"), f"URL is absolute: {url}"
            # And specifically not pointing at the Netlify legacy host
            assert "venerable-beignet" not in url, f"URL still has legacy Netlify prefix: {url}"
            # Should start with /api/files/nophotopix/uploads/ OR /uploads/ (fallback)
            assert url.startswith("/api/files/nophotopix/uploads/") or url.startswith("/uploads/"), (
                f"Expected relative URL starting with /api/files/nophotopix/uploads/ or /uploads/, got: {url}"
            )

            # List should show same relative URL
            lst = requests.get(f"{API}/photos", timeout=10).json()
            match = next((p for p in lst if p["id"] == pid), None)
            assert match is not None
            assert match["url"] == url, (
                f"Listed URL ({match['url']}) differs from upload URL ({url})"
            )

            # GET {BASE_URL}{url} must return 200 image/jpeg (or image/*)
            full = f"{BASE_URL}{url}"
            img = requests.get(full, timeout=15)
            assert img.status_code == 200, f"GET {full} -> {img.status_code}"
            ctype = img.headers.get("Content-Type", "")
            assert ctype.startswith("image/"), f"Expected image/*, got {ctype}"
            assert len(img.content) > 100
        finally:
            requests.delete(f"{API}/photos/{pid}", headers=self.HDRS, timeout=10)

    def test_startup_migration_strips_legacy_netlify_prefix(self):
        """Insert a photo doc with legacy Netlify-prefixed URL, restart backend,
        confirm url is rewritten to relative form. Cleanup afterwards."""
        from pymongo import MongoClient
        import datetime as dt
        import subprocess
        import time
        import uuid

        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        client = MongoClient(mongo_url)
        db = client[db_name]
        try:
            test_id = f"TEST_migrate_{uuid.uuid4().hex[:8]}"
            legacy_url = "https://venerable-beignet-9414de.netlify.app/api/files/legacy/test.jpg"
            doc = {
                "id": test_id,
                "url": legacy_url,
                "source": "upload",
                "title": "TEST_migrate",
                "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            }
            db.photos.insert_one(doc)

            # Restart backend to trigger migration in startup_event
            subprocess.run(["sudo", "supervisorctl", "restart", "backend"],
                           check=True, capture_output=True, timeout=30)
            # Wait for backend to come back up
            deadline = time.time() + 30
            while time.time() < deadline:
                try:
                    h = requests.get(f"{API}/config", timeout=2)
                    if h.status_code == 200:
                        break
                except Exception:
                    pass
                time.sleep(0.5)
            else:
                pytest.fail("Backend did not come back after restart")

            # Read back doc — URL should be relative now
            updated = db.photos.find_one({"id": test_id})
            assert updated is not None
            assert updated["url"] == "/api/files/legacy/test.jpg", (
                f"Expected migrated URL '/api/files/legacy/test.jpg', got: {updated['url']}"
            )
            assert "venerable-beignet" not in updated["url"]
        finally:
            db.photos.delete_one({"id": test_id})
            client.close()


class TestUploadDelete:
    def test_upload_requires_auth(self):
        files = {"file": ("t.png", _png_bytes(), "image/png")}
        r = requests.post(f"{API}/photos", files=files, timeout=15)
        assert r.status_code == 401

    def test_upload_and_delete_flow(self):
        files = {"file": ("TEST_upload.png", _png_bytes(), "image/png")}
        headers = {"X-Admin-Token": ADMIN_PASSWORD}
        r = requests.post(f"{API}/photos", files=files, headers=headers,
                          data={"title": "TEST_photo"}, timeout=15)
        assert r.status_code == 200, r.text
        photo = r.json()
        assert photo["source"] == "upload"
        assert "/uploads/" in photo["url"]
        assert "_id" not in photo
        pid = photo["id"]

        # Verify it appears in list
        lst = requests.get(f"{API}/photos", timeout=10).json()
        assert any(p["id"] == pid for p in lst)

        # Verify file is served (may be absolute URL for object-storage, or relative)
        img_url = photo["url"] if photo["url"].startswith("http") else f"{BASE_URL}{photo['url']}"
        img = requests.get(img_url, timeout=15)
        assert img.status_code == 200

        # Delete without auth -> 401
        r = requests.delete(f"{API}/photos/{pid}", timeout=10)
        assert r.status_code == 401

        # Delete with auth
        r = requests.delete(f"{API}/photos/{pid}", headers=headers, timeout=10)
        assert r.status_code == 200
        assert r.json().get("success") is True

        # 404 after delete


class TestOrders:
    @classmethod
    def _photo_ids(cls, n=2):
        photos = requests.get(f"{API}/photos", timeout=10).json()
        return [p["id"] for p in photos[:n]]

    def test_create_order_invalid_email(self):
        ids = self._photo_ids(1)
        r = requests.post(f"{API}/orders", json={
            "email": "notanemail",
            "photo_ids": ids,
            "total": 3,
            "payment_method": "paypal",
        }, timeout=10)
        assert r.status_code == 400

    def test_create_order_invalid_method(self):
        ids = self._photo_ids(1)
        r = requests.post(f"{API}/orders", json={
            "email": "TEST_x@example.com",
            "photo_ids": ids,
            "total": 3,
            "payment_method": "bitcoin",
        }, timeout=10)
        assert r.status_code == 400

    def test_create_order_empty_photos(self):
        r = requests.post(f"{API}/orders", json={
            "email": "TEST_x@example.com",
            "photo_ids": [],
            "total": 0,
            "payment_method": "paypal",
        }, timeout=10)
        assert r.status_code == 400

    def test_create_and_get_order(self):
        ids = self._photo_ids(3)
        assert len(ids) >= 2, "Need at least 2 photos seeded"
        payload = {
            "email": "TEST_buyer@example.com",
            "photo_ids": ids,
            "total": 8,
            "payment_method": "wero",
        }
        r = requests.post(f"{API}/orders", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["id"]
        assert order["status"] == "pending"
        assert order["email"] == "test_buyer@example.com"  # backend lowercases
        assert order["payment_method"] == "wero"
        assert order["photo_ids"] == ids
        assert order["email_sent"] is False
        assert "_id" not in order

        # GET hydrated
        r2 = requests.get(f"{API}/orders/{order['id']}", timeout=10)
        assert r2.status_code == 200
        got = r2.json()
        assert got["id"] == order["id"]
        assert "photos" in got
        assert len(got["photos"]) == len(ids)
        # Order preserved
        assert [p["id"] for p in got["photos"]] == ids
        for p in got["photos"]:
            assert "url" in p

    def test_get_order_not_found(self):
        r = requests.get(f"{API}/orders/nonexistent-id-zzz", timeout=10)
        assert r.status_code == 404


class TestAdminOrders:
    HDRS = {"X-Admin-Token": ADMIN_PASSWORD}

    def _create_order(self, method="paypal", n=2):
        photos = requests.get(f"{API}/photos", timeout=10).json()
        ids = [p["id"] for p in photos[:n]]
        r = requests.post(f"{API}/orders", json={
            "email": f"TEST_admin_{method}@example.com",
            "photo_ids": ids,
            "total": 6,
            "payment_method": method,
        }, timeout=10)
        assert r.status_code == 200, r.text
        return r.json()

    def test_admin_orders_requires_auth(self):
        r = requests.get(f"{API}/admin/orders", timeout=10)
        assert r.status_code == 401

    def test_admin_list_orders(self):
        order = self._create_order(method="paypal")
        r = requests.get(f"{API}/admin/orders", headers=self.HDRS, timeout=10)
        assert r.status_code == 200
        lst = r.json()
        assert isinstance(lst, list)
        assert any(o["id"] == order["id"] for o in lst)
        for o in lst:
            assert "photos" in o
            assert "_id" not in o
        # cleanup
        requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)

    def test_validate_order_changes_status_and_logs_email(self):
        order = self._create_order(method="revolut")
        r = requests.post(
            f"{API}/admin/orders/{order['id']}/validate",
            headers=self.HDRS,
            timeout=30,
        )
        # SendGrid key is invalid in this env -> 502 allowed; order still validated
        assert r.status_code in (200, 502), r.text
        if r.status_code == 502:
            assert "Commande validée mais email NON envoyé" in r.json().get("detail", "")
        else:
            d = r.json()
            assert d["status"] == "completed"
            assert d["validated_at"]
            assert d.get("download_token")

        # verify GET reflects state regardless
        g = requests.get(f"{API}/orders/{order['id']}", timeout=10).json()
        assert g["status"] == "completed"
        assert g.get("download_token")
        assert g.get("download_expires_at")
        assert g.get("validated_at")

        # cleanup
        requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)

    def test_validate_requires_auth(self):
        order = self._create_order(method="paypal")
        r = requests.post(f"{API}/admin/orders/{order['id']}/validate", timeout=10)
        assert r.status_code == 401
        # cleanup
        requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)

    def test_delete_order(self):
        order = self._create_order(method="wero")
        r = requests.delete(
            f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10
        )
        assert r.status_code == 200
        assert r.json().get("success") is True
        # 404 after delete
        r2 = requests.delete(
            f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10
        )
        assert r2.status_code == 404

    def test_delete_requires_auth(self):
        r = requests.delete(f"{API}/admin/orders/whatever", timeout=10)
        assert r.status_code == 401



# ============= DOWNLOAD (secure 7-day token flow) =============
class TestDownloadFlow:
    HDRS = {"X-Admin-Token": ADMIN_PASSWORD}

    @classmethod
    def _make_validated_order(cls, n=2, upload_first=False):
        """Create an order with optionally one uploaded photo + n seeded photos, then validate."""
        photo_ids = []
        uploaded_pid = None
        if upload_first:
            files = {"file": ("TEST_dl.png", _png_bytes(), "image/png")}
            r = requests.post(f"{API}/photos", files=files, headers=cls.HDRS,
                              data={"title": "TEST_dl_photo"}, timeout=15)
            assert r.status_code == 200, r.text
            uploaded_pid = r.json()["id"]
            photo_ids.append(uploaded_pid)
        seed = requests.get(f"{API}/photos", timeout=10).json()
        for p in seed:
            if p["source"] == "unsplash" and p["id"] not in photo_ids:
                photo_ids.append(p["id"])
                if len(photo_ids) >= n + (1 if upload_first else 0):
                    break

        r = requests.post(f"{API}/orders", json={
            "email": "TEST_dl@example.com",
            "photo_ids": photo_ids,
            "total": 6,
            "payment_method": "paypal",
        }, timeout=10)
        assert r.status_code == 200, r.text
        order = r.json()

        v = requests.post(f"{API}/admin/orders/{order['id']}/validate",
                          headers=cls.HDRS, timeout=30)
        assert v.status_code in (200, 502), v.text
        g = requests.get(f"{API}/orders/{order['id']}", timeout=10).json()
        assert g["status"] == "completed"
        assert g.get("download_token")
        return g, uploaded_pid

    def test_download_info_valid_token(self):
        order, _ = self._make_validated_order(n=2)
        token = order["download_token"]
        r = requests.get(f"{API}/download/{token}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["order_id"] == order["id"]
        assert d["email"] == "test_dl@example.com"
        assert d["total"] == 6
        assert d["expires_at"]
        assert d["validated_at"]
        assert "album_name" in d
        assert isinstance(d["photos"], list)
        assert len(d["photos"]) == len(order["photo_ids"])
        for p in d["photos"]:
            assert "id" in p and "url" in p
            assert "_id" not in p
        # cleanup
        requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)

    def test_download_info_invalid_token(self):
        r = requests.get(f"{API}/download/this-is-a-bogus-token-zzz", timeout=10)
        assert r.status_code == 404
        d = r.json()
        assert "Lien invalide" in d.get("detail", "")

    def test_download_file_seed_unsplash(self):
        order, _ = self._make_validated_order(n=1)
        token = order["download_token"]
        pid = order["photo_ids"][0]
        r = requests.get(f"{API}/download/{token}/file/{pid}", timeout=60)
        assert r.status_code == 200, r.text
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd.lower()
        assert "filename=" in cd
        assert len(r.content) > 100  # got some bytes
        # cleanup
        requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)

    def test_download_file_uploaded_photo(self):
        order, uploaded_pid = self._make_validated_order(n=1, upload_first=True)
        token = order["download_token"]
        assert uploaded_pid in order["photo_ids"]
        r = requests.get(f"{API}/download/{token}/file/{uploaded_pid}", timeout=30)
        assert r.status_code == 200, r.text
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd.lower()
        assert len(r.content) > 50
        # cleanup
        requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)
        requests.delete(f"{API}/photos/{uploaded_pid}", headers=self.HDRS, timeout=10)

    def test_download_file_unauthorized_photo(self):
        order, _ = self._make_validated_order(n=1)
        token = order["download_token"]
        # find a photo NOT in this order
        photos = requests.get(f"{API}/photos", timeout=10).json()
        other = next((p["id"] for p in photos if p["id"] not in order["photo_ids"]), None)
        assert other, "Need a photo NOT in the order"
        r = requests.get(f"{API}/download/{token}/file/{other}", timeout=15)
        assert r.status_code == 403
        # cleanup
        requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)

    def test_download_expired_token_returns_410(self):
        """Manually patch download_expires_at to a past timestamp via direct Mongo."""
        order, _ = self._make_validated_order(n=1)
        token = order["download_token"]
        # use pymongo to set expiry to the past
        from pymongo import MongoClient
        import datetime as dt
        client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "test_database")]
        past = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1)).isoformat()
        res = db.orders.update_one({"id": order["id"]}, {"$set": {"download_expires_at": past}})
        assert res.modified_count == 1
        r = requests.get(f"{API}/download/{token}", timeout=10)
        assert r.status_code == 410, r.text
        assert "expir" in r.json().get("detail", "").lower()
        # cleanup
        requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)
        client.close()

    def test_validate_sets_48h_ttl(self):
        """Validate-> download_expires_at - validated_at must be ~48h."""
        import datetime as dt
        order, _ = self._make_validated_order(n=1)
        exp = dt.datetime.fromisoformat(order["download_expires_at"])
        val = dt.datetime.fromisoformat(order["validated_at"])
        delta = (exp - val).total_seconds()
        # 48h +/- 1 minute tolerance
        assert 47 * 3600 + 59 * 60 <= delta <= 48 * 3600 + 60, (
            f"TTL delta is {delta}s, expected ~172800s (48h). "
            f"validated_at={val.isoformat()} expires_at={exp.isoformat()}"
        )
        requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)

    def test_validate_is_idempotent(self):
        """Re-validating a completed order returns same token, doesn't re-issue."""
        order, _ = self._make_validated_order(n=1)
        original_token = order["download_token"]
        original_expires = order["download_expires_at"]
        original_validated = order["validated_at"]

        r = requests.post(f"{API}/admin/orders/{order['id']}/validate",
                          headers=self.HDRS, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["download_token"] == original_token
        assert d["download_expires_at"] == original_expires
        assert d["validated_at"] == original_validated
        # cleanup
        requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)



# ========== ITER 7: Resilient validate (SendGrid down) + admin copy-link ==========
class TestResilientValidate:
    HDRS = {"X-Admin-Token": ADMIN_PASSWORD}
    EXPECTED_BASE = "https://image-select-pay.emergent.host"

    def _fresh_order(self):
        ph = requests.get(f"{API}/photos", timeout=10).json()[0]
        r = requests.post(f"{API}/orders", json={
            "email": "qa-test@npp.io",
            "photo_ids": [ph["id"]],
            "total": 3,
            "payment_method": "paypal",
        }, timeout=10)
        assert r.status_code == 200, r.text
        return r.json()

    def test_validate_returns_200_even_when_sendgrid_fails(self):
        order = self._fresh_order()
        try:
            r = requests.post(f"{API}/admin/orders/{order['id']}/validate",
                              headers=self.HDRS, timeout=20)
            # CRITICAL: must NOT be 502 anymore
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
            d = r.json()
            assert d["status"] == "completed"
            assert d.get("validated_at")
            assert d.get("download_token")
            assert d.get("download_expires_at")
            # download_url absolute + PUBLIC_BASE_URL prefix
            assert d.get("download_url", "").startswith(self.EXPECTED_BASE + "/download/"), d.get("download_url")
            assert d["download_url"] == f"{self.EXPECTED_BASE}/download/{d['download_token']}"
            # SendGrid expected to fail with revoked key
            assert d.get("email_sent") is False
            assert d.get("email_error")
            assert "SendGrid" in d["email_error"] or "sendgrid" in d["email_error"].lower() or "révoqu" in d["email_error"].lower()
            # Friendly French message expected
            assert "révoqu" in d["email_error"] or "invalide" in d["email_error"].lower()
        finally:
            requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)

    def test_list_orders_includes_download_url_for_completed(self):
        order = self._fresh_order()
        try:
            v = requests.post(f"{API}/admin/orders/{order['id']}/validate",
                              headers=self.HDRS, timeout=20)
            assert v.status_code == 200
            token = v.json()["download_token"]
            r = requests.get(f"{API}/admin/orders", headers=self.HDRS, timeout=15)
            assert r.status_code == 200
            found = next((o for o in r.json() if o["id"] == order["id"]), None)
            assert found is not None
            assert found["status"] == "completed"
            assert found.get("download_url") == f"{self.EXPECTED_BASE}/download/{token}"
        finally:
            requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)

    def test_validate_idempotent_same_token_no_resend(self):
        order = self._fresh_order()
        try:
            v1 = requests.post(f"{API}/admin/orders/{order['id']}/validate",
                               headers=self.HDRS, timeout=20).json()
            v2 = requests.post(f"{API}/admin/orders/{order['id']}/validate",
                               headers=self.HDRS, timeout=20).json()
            assert v1["download_token"] == v2["download_token"]
            assert v1["download_url"] == v2["download_url"]
            assert v1["validated_at"] == v2["validated_at"]
            assert v1["download_expires_at"] == v2["download_expires_at"]
            # email_sent unchanged (still False from first call)
            assert v2["email_sent"] == v1["email_sent"]
        finally:
            requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)

    def test_download_endpoint_works_with_token(self):
        order = self._fresh_order()
        try:
            v = requests.post(f"{API}/admin/orders/{order['id']}/validate",
                              headers=self.HDRS, timeout=20).json()
            token = v["download_token"]
            r = requests.get(f"{API}/download/{token}", timeout=10)
            assert r.status_code == 200, r.text
            d = r.json()
            assert "photos" in d and isinstance(d["photos"], list) and len(d["photos"]) >= 1
            # download a file
            pid = d["photos"][0]["id"]
            f = requests.get(f"{API}/download/{token}/file/{pid}", timeout=15)
            assert f.status_code == 200
            assert "content-disposition" in {k.lower(): v for k, v in f.headers.items()}
        finally:
            requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)

    def test_validate_expires_in_about_48h(self):
        from datetime import datetime
        order = self._fresh_order()
        try:
            v = requests.post(f"{API}/admin/orders/{order['id']}/validate",
                              headers=self.HDRS, timeout=20).json()
            va = datetime.fromisoformat(v["validated_at"].replace("Z", "+00:00"))
            ex = datetime.fromisoformat(v["download_expires_at"].replace("Z", "+00:00"))
            delta_h = (ex - va).total_seconds() / 3600
            assert 47.5 <= delta_h <= 48.5, f"Expected ~48h, got {delta_h}"
        finally:
            requests.delete(f"{API}/admin/orders/{order['id']}", headers=self.HDRS, timeout=10)
