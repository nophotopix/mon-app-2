"""Backend tests for No_Photo_PIX API"""
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://image-select-pay.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = "97140"


def _png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), (10, 10, 10)).save(buf, format="PNG")
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
        assert photo["url"].startswith("/uploads/")
        assert "_id" not in photo
        pid = photo["id"]

        # Verify it appears in list
        lst = requests.get(f"{API}/photos", timeout=10).json()
        assert any(p["id"] == pid for p in lst)

        # Verify file is served
        img = requests.get(f"{BASE_URL}{photo['url']}", timeout=10)
        assert img.status_code == 200

        # Delete without auth -> 401
        r = requests.delete(f"{API}/photos/{pid}", timeout=10)
        assert r.status_code == 401

        # Delete with auth
        r = requests.delete(f"{API}/photos/{pid}", headers=headers, timeout=10)
        assert r.status_code == 200
        assert r.json().get("success") is True

        # 404 after delete


# ============= ORDERS =============
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
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "completed"
        assert d["validated_at"]
        assert d["email_sent"] is True
        assert len(d["photos"]) >= 1

        # verify GET also reflects
        g = requests.get(f"{API}/orders/{order['id']}", timeout=10).json()
        assert g["status"] == "completed"
        assert g["email_sent"] is True

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
