import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.email_log import EmailLog

class EmailService:
    @staticmethod
    def send_and_log_email(
        db: Session,
        to_email: str,
        subject: str,
        body: str,
        related_type: Optional[str] = None,
        related_id: Optional[int] = None
    ) -> EmailLog:
        # Create database log record
        log = EmailLog(
            to_email=to_email,
            subject=subject,
            body=body,
            sent_at=datetime.now(timezone.utc),
            related_type=related_type,
            related_id=related_id
        )
        db.add(log)
        db.commit()

        # Check if SMTP is configured
        if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
            try:
                msg = MIMEMultipart()
                msg['From'] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
                msg['To'] = to_email
                msg['Subject'] = subject
                msg.attach(MIMEText(body, 'plain'))

                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.send_message(msg)
                print(f"[EMAIL SENT via SMTP] To: {to_email} | Subject: {subject}")
            except Exception as e:
                print(f"[EMAIL ERROR via SMTP] To: {to_email} | Error: {e}")
        else:
            print("==================================================")
            print("[MOCK EMAIL DISPATCH]")
            print(f"To: {to_email}")
            print(f"From: {settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>")
            print(f"Subject: {subject}")
            print(f"Body:\n{body}")
            print("==================================================")

        return log

    @staticmethod
    def send_bulk_announcement(
        db_session_factory,
        recipient_emails: List[str],
        subject: str,
        body: str,
        announcement_id: int
    ):
        db = db_session_factory()
        try:
            for email in recipient_emails:
                EmailService.send_and_log_email(
                    db=db,
                    to_email=email,
                    subject=subject,
                    body=body,
                    related_type="ANNOUNCEMENT",
                    related_id=announcement_id
                )
        finally:
            db.close()

email_service = EmailService()
