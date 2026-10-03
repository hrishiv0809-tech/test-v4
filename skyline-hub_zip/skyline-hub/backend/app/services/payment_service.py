from decimal import Decimal
from typing import Dict, Any

class PaymentService:
    @staticmethod
    def process_mock_payment(
        amount: Decimal,
        description: str,
        customer_email: str
    ) -> Dict[str, Any]:
        # Structure ready for Stripe checkout or mock success
        return {
            "success": True,
            "transaction_id": f"txn_mock_{int(amount * 100)}",
            "amount": float(amount),
            "currency": "USD",
            "status": "PAID"
        }

payment_service = PaymentService()
