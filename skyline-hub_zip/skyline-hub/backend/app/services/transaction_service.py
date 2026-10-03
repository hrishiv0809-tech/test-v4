from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from app.models.transaction import Transaction, TransactionType, TransactionSource

class TransactionService:
    @staticmethod
    def record_transaction(
        db: Session,
        type: TransactionType,
        source: TransactionSource,
        amount: Decimal,
        description: str,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        created_by_id: Optional[int] = None,
        date: Optional[datetime] = None
    ) -> Transaction:
        if date is None:
            date = datetime.now(timezone.utc)
        
        tx = Transaction(
            type=type,
            source=source,
            amount=amount,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
            created_by_id=created_by_id,
            date=date
        )
        db.add(tx)
        return tx

transaction_service = TransactionService()
