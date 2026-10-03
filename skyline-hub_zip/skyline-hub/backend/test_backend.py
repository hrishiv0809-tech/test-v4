import os
import sys
import unittest
from decimal import Decimal
from fastapi.testclient import TestClient

# Ensure app is importable
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.event import Event, EventStatus
from app.models.ticket import Ticket, TicketStatus
from app.models.product import ProductVariant, ProductSize
from app.models.transaction import Transaction, TransactionType, TransactionSource

client = TestClient(app)

class SkylineBackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Authenticate demo users
        resp = client.post("/api/auth/login", json={"email": "admin@skyline.edu", "password": "admin123"})
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        cls.admin_token = resp.json()["access_token"]
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

        resp = client.post("/api/auth/login", json={"email": "treasurer@skyline.edu", "password": "treasurer123"})
        assert resp.status_code == 200
        cls.treasurer_token = resp.json()["access_token"]
        cls.treasurer_headers = {"Authorization": f"Bearer {cls.treasurer_token}"}

        resp = client.post("/api/auth/login", json={"email": "volunteer@skyline.edu", "password": "volunteer123"})
        assert resp.status_code == 200
        cls.volunteer_token = resp.json()["access_token"]
        cls.volunteer_headers = {"Authorization": f"Bearer {cls.volunteer_token}"}

        resp = client.post("/api/auth/login", json={"email": "member@skyline.edu", "password": "member123"})
        assert resp.status_code == 200
        cls.member_token = resp.json()["access_token"]
        cls.member_headers = {"Authorization": f"Bearer {cls.member_token}"}

    def test_01_auth_me(self):
        resp = client.get("/api/auth/me", headers=self.admin_headers)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["role"], "ADMIN")

    def test_02_member_verification(self):
        # Active member
        resp = client.get("/api/checkin/verify-member?query=SKY-PREM-8899", headers=self.volunteer_headers)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["result"], "GREEN")
        self.assertEqual(resp.json()["status_text"], "ACTIVE MEMBER")

        # Invalid member
        resp = client.get("/api/checkin/verify-member?query=NON_EXISTENT", headers=self.volunteer_headers)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["result"], "RED")

    def test_03_member_card_qr(self):
        resp = client.get("/api/memberships/card-qr", headers=self.member_headers)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("data:image/png;base64,", resp.json()["qr_code"])

    def test_04_event_and_ticket_flow(self):
        # 1. Get Spring Gala
        events_resp = client.get("/api/events")
        self.assertEqual(events_resp.status_code, 200)
        gala = next(e for e in events_resp.json() if "Spring Gala" in e["title"])
        
        # 2. Buy ticket as member (gets member price )
        buy_resp = client.post(
            "/api/tickets/purchase",
            json={
                "event_id": gala["id"],
                "buyer_name": "Jordan Lee",
                "buyer_email": "member@skyline.edu"
            },
            headers=self.member_headers
        )
        self.assertEqual(buy_resp.status_code, 200)
        ticket_data = buy_resp.json()
        self.assertTrue(ticket_data["is_member_price"])
        self.assertEqual(float(ticket_data["price_paid"]), 15.0)
        tck_code = ticket_data["ticket_code"]

        # 3. Check in ticket (First time -> GREEN)
        checkin_resp = client.post(
            "/api/checkin/verify-ticket",
            json={"ticket_code": tck_code},
            headers=self.volunteer_headers
        )
        self.assertEqual(checkin_resp.status_code, 200)
        self.assertEqual(checkin_resp.json()["result"], "GREEN")

        # 4. Check in ticket again (Second time -> YELLOW "ALREADY CHECKED IN")
        checkin_dup = client.post(
            "/api/checkin/verify-ticket",
            json={"ticket_code": tck_code},
            headers=self.volunteer_headers
        )
        self.assertEqual(checkin_dup.status_code, 200)
        self.assertEqual(checkin_dup.json()["result"], "YELLOW")

    def test_05_merch_order_with_stock_locking(self):
        # Get products
        prods = client.get("/api/products", headers=self.member_headers).json()
        hoodie = next(p for p in prods if "Hoodie" in p["name"])
        variant_m = next(v for v in hoodie["variants"] if v["size"] == "M")
        initial_stock = variant_m["stock"]

        # Buy 1 Hoodie size M
        order_resp = client.post(
            "/api/orders",
            json={
                "items": [{"variant_id": variant_m["id"], "quantity": 1}]
            },
            headers=self.member_headers
        )
        self.assertEqual(order_resp.status_code, 200)
        self.assertEqual(order_resp.json()["status"], "PAID")

        # Confirm stock decremented
        updated_prods = client.get("/api/products", headers=self.member_headers).json()
        updated_hoodie = next(p for p in updated_prods if "Hoodie" in p["name"])
        updated_variant_m = next(v for v in updated_hoodie["variants"] if v["size"] == "M")
        self.assertEqual(updated_variant_m["stock"], initial_stock - 1)

    def test_06_kanban_task_reorder(self):
        fundraisers = client.get("/api/fundraisers").json()
        self.assertTrue(len(fundraisers) > 0)
        f_id = fundraisers[0]["id"]
        tasks = fundraisers[0]["tasks"]
        self.assertTrue(len(tasks) > 0)

        task = tasks[0]
        # Move to DONE
        patch_resp = client.patch(
            f"/api/tasks/{task['id']}",
            json={"status": "DONE", "position": 100},
            headers=self.volunteer_headers
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.json()["status"], "DONE")

    def test_07_expense_claim_workflow(self):
        # 1. Volunteer submits claim
        claim_resp = client.post(
            "/api/expenses",
            json={
                "description": "Poster Board and Markers",
                "amount": 35.50,
                "category": "Supplies",
                "receipt_url": "/uploads/receipt_demo.png"
            },
            headers=self.volunteer_headers
        )
        self.assertEqual(claim_resp.status_code, 200)
        claim_id = claim_resp.json()["id"]

        # 2. Treasurer reviews & marks reimbursed
        review_resp = client.patch(
            f"/api/expenses/{claim_id}/review",
            json={"status": "REIMBURSED", "review_note": "Reimbursed via direct deposit."},
            headers=self.treasurer_headers
        )
        self.assertEqual(review_resp.status_code, 200)
        self.assertEqual(review_resp.json()["status"], "REIMBURSED")

    def test_08_finance_and_dashboard(self):
        kpi_resp = client.get("/api/finance/kpi", headers=self.treasurer_headers)
        self.assertEqual(kpi_resp.status_code, 200)
        self.assertGreater(float(kpi_resp.json()["total_income"]), 0)

        breakdown_resp = client.get("/api/finance/breakdown", headers=self.treasurer_headers)
        self.assertEqual(breakdown_resp.status_code, 200)

        dash_resp = client.get("/api/dashboard/admin", headers=self.admin_headers)
        self.assertEqual(dash_resp.status_code, 200)
        self.assertGreater(dash_resp.json()["active_members"], 0)

if __name__ == "__main__":
    unittest.main()
