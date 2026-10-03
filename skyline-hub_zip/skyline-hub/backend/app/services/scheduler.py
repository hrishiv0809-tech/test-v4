from datetime import date, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from app.db.session import SessionLocal
from app.models.membership import Membership, MembershipStatus
from app.services.email_service import email_service

def process_renewal_reminders_and_expirations():
    db = SessionLocal()
    try:
        today = date.today()
        upcoming_30_days = today + timedelta(days=30)

        # 1. Send reminders to members expiring in <= 30 days who haven't received reminder
        expiring_memberships = db.query(Membership).filter(
            Membership.status == MembershipStatus.ACTIVE,
            Membership.end_date <= upcoming_30_days,
            Membership.end_date >= today,
            Membership.renewal_reminder_sent == False
        ).all()

        for m in expiring_memberships:
            if m.user and m.user.email:
                subject = "Skyline Student Association - Membership Renewal Reminder"
                body = (
                    f"Hello {m.user.name},\n\n"
                    f"Your Skyline Student Association membership is scheduled to expire on {m.end_date}.\n"
                    f"Please log in to your account to renew your membership and continue enjoying member discounts and benefits.\n\n"
                    f"Best regards,\nSkyline Student Association"
                )
                email_service.send_and_log_email(
                    db=db,
                    to_email=m.user.email,
                    subject=subject,
                    body=body,
                    related_type="MEMBERSHIP_RENEWAL",
                    related_id=m.id
                )
                m.renewal_reminder_sent = True
        
        # 2. Auto-expire memberships past end_date
        lapsed_memberships = db.query(Membership).filter(
            Membership.status == MembershipStatus.ACTIVE,
            Membership.end_date < today
        ).all()

        for lm in lapsed_memberships:
            lm.status = MembershipStatus.EXPIRED
        
        db.commit()
        print(f"[SCHEDULER] Ran renewal checks: {len(expiring_memberships)} reminders sent, {len(lapsed_memberships)} memberships expired.")
    except Exception as e:
        db.rollback()
        print(f"[SCHEDULER ERROR] {e}")
    finally:
        db.close()

scheduler = BackgroundScheduler()

def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(
            process_renewal_reminders_and_expirations,
            'interval',
            hours=24,
            id='daily_membership_check',
            replace_existing=True
        )
        scheduler.start()
        print("[SCHEDULER] Daily background scheduler started.")

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[SCHEDULER] Background scheduler stopped.")
