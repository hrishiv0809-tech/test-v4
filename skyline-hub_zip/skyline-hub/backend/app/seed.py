from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
import uuid
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership, MembershipStatus
from app.models.event import Event, EventStatus
from app.models.ticket import Ticket, TicketStatus
from app.models.announcement import Announcement, AnnouncementCategory
from app.models.subscriber import MailingListSubscriber
from app.models.email_log import EmailLog
from app.models.product import Product, ProductVariant, ProductSize
from app.models.order import Order, OrderItem, OrderStatus
from app.models.fundraiser import Fundraiser, FundraiserStatus
from app.models.task import FundraiserTask, TaskStatus, TaskPriority
from app.models.expense import ExpenseClaim, ExpenseStatus
from app.models.transaction import Transaction, TransactionType, TransactionSource

def seed_database():
    print("[SEED] Starting database seeding...")
    db: Session = SessionLocal()
    try:
        # Clear existing data safely
        db.query(OrderItem).delete()
        db.query(Order).delete()
        db.query(ProductVariant).delete()
        db.query(Product).delete()
        db.query(FundraiserTask).delete()
        db.query(Fundraiser).delete()
        db.query(ExpenseClaim).delete()
        db.query(Ticket).delete()
        db.query(Event).delete()
        db.query(Announcement).delete()
        db.query(MailingListSubscriber).delete()
        db.query(EmailLog).delete()
        db.query(Membership).delete()
        db.query(MembershipPlan).delete()
        db.query(Transaction).delete()
        db.query(User).delete()
        db.commit()

        # 1. Membership Plans
        plan_standard = MembershipPlan(
            name="Standard Annual",
            price=Decimal("20.00"),
            duration_months=12,
            ticket_discount_percent=20,
            merch_discount_percent=10,
            benefits="Access to all general meetings, voting rights in club elections, 20% off event tickets, 10% off club merchandise."
        )
        plan_premium = MembershipPlan(
            name="Premium Annual",
            price=Decimal("35.00"),
            duration_months=12,
            ticket_discount_percent=40,
            merch_discount_percent=20,
            benefits="All Standard benefits plus 40% off event tickets, 20% off merchandise, priority seating, exclusive swag bag, and access to the annual awards banquet."
        )
        db.add_all([plan_standard, plan_premium])
        db.flush()

        # 2. Key Demo Users
        now = datetime.now(timezone.utc)
        today = date.today()
        academic_end = date(today.year if today.month <= 5 else today.year + 1, 5, 31)

        admin = User(
            name="Arjun Sharma (President)",
            email="admin@skyline.edu",
            password_hash=get_password_hash("admin123"),
            phone="555-0100",
            student_id="SKY-ADM-01",
            role=UserRole.ADMIN,
            created_at=now - timedelta(days=120)
        )
        treasurer = User(
            name="Priya Mehta (Treasurer)",
            email="treasurer@skyline.edu",
            password_hash=get_password_hash("treasurer123"),
            phone="555-0101",
            student_id="SKY-TRS-02",
            role=UserRole.TREASURER,
            created_at=now - timedelta(days=120)
        )
        volunteer = User(
            name="Rohan Verma (Volunteer Lead)",
            email="volunteer@skyline.edu",
            password_hash=get_password_hash("volunteer123"),
            phone="555-0102",
            student_id="SKY-VOL-03",
            role=UserRole.VOLUNTEER,
            created_at=now - timedelta(days=100)
        )
        demo_member = User(
            name="Sneha Patel (Active Member)",
            email="member@skyline.edu",
            password_hash=get_password_hash("member123"),
            phone="555-0103",
            student_id="SKY-MEM-04",
            role=UserRole.MEMBER,
            created_at=now - timedelta(days=90)
        )
        db.add_all([admin, treasurer, volunteer, demo_member])
        db.flush()

        # Active Premium Membership for demo member
        demo_membership = Membership(
            user_id=demo_member.id,
            plan_id=plan_premium.id,
            status=MembershipStatus.ACTIVE,
            start_date=today - timedelta(days=90),
            end_date=academic_end,
            dues_paid=True,
            amount_paid=plan_premium.price,
            member_code="SKY-PREM-8899",
            renewal_reminder_sent=False
        )
        db.add(demo_membership)

        # 3. Create ~25 additional members with mixed statuses
        sample_names = [
            ("Aarav Singh", "aarav@skyline.edu", "ACTIVE", 60),
            ("Kavya Nair", "kavya@skyline.edu", "ACTIVE", 45),
            ("Vikram Reddy", "vikram@skyline.edu", "ACTIVE", 30),
            ("Ananya Iyer", "ananya@skyline.edu", "ACTIVE", 80),
            ("Rahul Gupta", "rahul@skyline.edu", "ACTIVE", 75),
            ("Pooja Desai", "pooja@skyline.edu", "ACTIVE", 10),
            ("Karan Malhotra", "karan@skyline.edu", "ACTIVE", 20),
            ("Divya Pillai", "divya@skyline.edu", "EXPIRING_30", 15), # Expiring soon
            ("Ishaan Bose", "ishaan@skyline.edu", "EXPIRING_30", 12),
            ("Neha Joshi", "neha@skyline.edu", "EXPIRING_30", 25),
            ("Riya Kapoor", "riya@skyline.edu", "EXPIRING_30", 5),
            ("Aditya Rao", "aditya@skyline.edu", "EXPIRED", -10), # Expired
            ("Shreya Mishra", "shreya@skyline.edu", "EXPIRED", -30),
            ("Arnav Choudhary", "arnav@skyline.edu", "EXPIRED", -60),
            ("Tanvi Bhatt", "tanvi@skyline.edu", "EXPIRED", -45),
            ("Mihir Saxena", "mihir@skyline.edu", "PENDING", None), # Pending payment
            ("Prachi Srivastava", "prachi@skyline.edu", "PENDING", None),
            ("Siddharth Kumar", "siddharth@skyline.edu", "ACTIVE", 15),
            ("Nandini Agarwal", "nandini@skyline.edu", "ACTIVE", 40),
            ("Yash Pandey", "yash@skyline.edu", "ACTIVE", 55),
            ("Diya Chatterjee", "diya@skyline.edu", "ACTIVE", 70),
            ("Pranav Menon", "pranav@skyline.edu", "ACTIVE", 100),
            ("Sakshi Tiwari", "sakshi@skyline.edu", "ACTIVE", 25),
            ("Harsh Tripathi", "harsh@skyline.edu", "PENDING", None),
            ("Meera Krishnamurthy", "meera@skyline.edu", "ACTIVE", 90),
        ]

        for i, (name, email, st, days_offset) in enumerate(sample_names, start=10):
            u = User(
                name=name,
                email=email,
                password_hash=get_password_hash("password123"),
                phone=f"555-01{i:02d}",
                student_id=f"SKY-2025-{i:03d}",
                role=UserRole.MEMBER,
                created_at=now - timedelta(days=60 + i)
            )
            db.add(u)
            db.flush()

            assigned_plan = plan_standard if i % 2 == 0 else plan_premium
            code = f"SKY-{u.id:04d}-{uuid.uuid4().hex[:4].upper()}"

            if st == "ACTIVE":
                m = Membership(
                    user_id=u.id,
                    plan_id=assigned_plan.id,
                    status=MembershipStatus.ACTIVE,
                    start_date=today - timedelta(days=days_offset),
                    end_date=academic_end,
                    dues_paid=True,
                    amount_paid=assigned_plan.price,
                    member_code=code
                )
            elif st == "EXPIRING_30":
                m = Membership(
                    user_id=u.id,
                    plan_id=assigned_plan.id,
                    status=MembershipStatus.ACTIVE,
                    start_date=today - timedelta(days=330),
                    end_date=today + timedelta(days=days_offset),
                    dues_paid=True,
                    amount_paid=assigned_plan.price,
                    member_code=code,
                    renewal_reminder_sent=False
                )
            elif st == "EXPIRED":
                m = Membership(
                    user_id=u.id,
                    plan_id=assigned_plan.id,
                    status=MembershipStatus.EXPIRED,
                    start_date=today - timedelta(days=380),
                    end_date=today + timedelta(days=days_offset),
                    dues_paid=True,
                    amount_paid=assigned_plan.price,
                    member_code=code
                )
            else: # PENDING
                m = Membership(
                    user_id=u.id,
                    plan_id=assigned_plan.id,
                    status=MembershipStatus.PENDING_PAYMENT,
                    dues_paid=False,
                    amount_paid=Decimal("0.00"),
                    member_code=code
                )
            db.add(m)

        db.flush()

        # 4. Events
        event_gala = Event(
            title="Spring Gala 2025",
            description="The flagship Skyline annual gala celebration featuring live music, fine dining, student organization awards, and a guest keynote speech.",
            location="Grand Ballroom, Student Union 3rd Floor",
            start_date=now + timedelta(days=14, hours=6),
            end_date=now + timedelta(days=14, hours=11),
            image_url="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80",
            capacity=200,
            member_price=Decimal("15.00"),
            non_member_price=Decimal("30.00"),
            status=EventStatus.PUBLISHED
        )

        event_fall = Event(
            title="Fall Welcome Bash 2024",
            description="Kick off the academic year with fellow students, fun yard games, club booths, and free BBQ.",
            location="Skyline Quadrangle",
            start_date=now - timedelta(days=120),
            end_date=now - timedelta(days=120, hours=-5),
            image_url="https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80",
            capacity=150,
            member_price=Decimal("10.00"),
            non_member_price=Decimal("20.00"),
            status=EventStatus.COMPLETED
        )

        event_summit = Event(
            title="Skyline Leadership & Networking Summit",
            description="An interactive workshop with industry mentors and alumni on leadership, public speaking, and career progression.",
            location="Auditorium B, Engineering Complex",
            start_date=now + timedelta(days=28, hours=2),
            end_date=now + timedelta(days=28, hours=6),
            image_url="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80",
            capacity=80,
            member_price=Decimal("5.00"),
            non_member_price=Decimal("15.00"),
            status=EventStatus.PUBLISHED
        )

        event_hack = Event(
            title="HackSkyline 24-Hour Hackathon",
            description="24 hours of innovation, coding, design, workshops, and pizza! Over ,000 in prizes across 4 challenge tracks.",
            location="Innovation Hub, Tech Building",
            start_date=now + timedelta(days=45),
            end_date=now + timedelta(days=46),
            image_url="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
            capacity=100,
            member_price=Decimal("0.00"),
            non_member_price=Decimal("10.00"),
            status=EventStatus.PUBLISHED
        )
        db.add_all([event_gala, event_fall, event_summit, event_hack])
        db.flush()

        # Seed Gala tickets (~120 sold, some checked in)
        for t_idx in range(1, 121):
            is_mem = (t_idx % 3 != 0)
            status_val = TicketStatus.CHECKED_IN if t_idx <= 15 else TicketStatus.VALID
            check_time = (now - timedelta(hours=1)) if status_val == TicketStatus.CHECKED_IN else None
            price = event_gala.member_price if is_mem else event_gala.non_member_price
            
            t = Ticket(
                event_id=event_gala.id,
                user_id=demo_member.id if t_idx == 1 else None,
                buyer_name=f"Attendee {t_idx}" if t_idx != 1 else demo_member.name,
                buyer_email=f"attendee{t_idx}@skyline.edu" if t_idx != 1 else demo_member.email,
                price_paid=price,
                is_member_price=is_mem,
                ticket_code=f"TCK-GALA-{t_idx:04d}",
                status=status_val,
                checked_in_at=check_time,
                checked_in_by_id=volunteer.id if check_time else None,
                created_at=now - timedelta(days=t_idx % 10)
            )
            db.add(t)

        # 5. Products & Variants
        prod_hoodie = Product(
            name="Skyline Signature Fleece Hoodie",
            description="Heavyweight ultra-soft fleece hoodie featuring the embroidered Skyline Student Association crest and tailored ribbed cuffs.",
            image_url="https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80",
            base_price=Decimal("40.00"),
            active=True
        )
        prod_tshirt = Product(
            name="Skyline Classic Cotton T-Shirt",
            description="100% ring-spun organic cotton crewneck tee with modern purple/amber branding.",
            image_url="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
            base_price=Decimal("18.00"),
            active=True
        )
        prod_bottle = Product(
            name="Skyline Vacuum Insulated Water Bottle",
            description="32oz double-wall insulated stainless steel water bottle keeping drinks ice cold for 24 hours.",
            image_url="https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80",
            base_price=Decimal("22.00"),
            active=True
        )
        db.add_all([prod_hoodie, prod_tshirt, prod_bottle])
        db.flush()

        # Variants
        sizes = [ProductSize.XS, ProductSize.S, ProductSize.M, ProductSize.L, ProductSize.XL, ProductSize.XXL]
        hoodie_stocks = [10, 8, 3, 15, 12, 0] # M has low stock (3), XXL is out of stock (0)
        for s, st in zip(sizes, hoodie_stocks):
            db.add(ProductVariant(product_id=prod_hoodie.id, size=s, stock=st))

        tshirt_stocks = [15, 20, 25, 18, 10, 4] # XXL low stock
        for s, st in zip(sizes, tshirt_stocks):
            db.add(ProductVariant(product_id=prod_tshirt.id, size=s, stock=st))

        for s, st in [(ProductSize.S, 30), (ProductSize.M, 25)]:
            db.add(ProductVariant(product_id=prod_bottle.id, size=s, stock=st))
        
        db.flush()

        # 6. Orders
        variant_m_hoodie = db.query(ProductVariant).filter(ProductVariant.product_id == prod_hoodie.id, ProductVariant.size == ProductSize.M).first()
        order_1 = Order(
            user_id=demo_member.id,
            status=OrderStatus.PAID,
            subtotal=Decimal("40.00"),
            discount=Decimal("8.00"), # 20% discount for Premium
            total=Decimal("32.00"),
            created_at=now - timedelta(days=5)
        )
        db.add(order_1)
        db.flush()
        db.add(OrderItem(order_id=order_1.id, variant_id=variant_m_hoodie.id, quantity=1, unit_price=Decimal("40.00")))

        # 7. Fundraiser & Kanban Tasks
        fundraiser = Fundraiser(
            title="Spring Bake Sale & Charity Auction",
            description="Fundraising event on the main quad to sponsor Skyline scholarship funds and regional conference travel.",
            goal_amount=Decimal("2500.00"),
            raised_amount=Decimal("1650.00"),
            event_date=today + timedelta(days=10),
            status=FundraiserStatus.ACTIVE
        )
        db.add(fundraiser)
        db.flush()

        tasks_data = [
            ("Reserve Quad Tables & Canopies", "Submit facility reservation with student union", volunteer.id, today - timedelta(days=2), TaskStatus.DONE, TaskPriority.HIGH, 0),
            ("Design Social Media Graphics & Banners", "Create promotional visuals for Instagram and flyers", admin.id, today - timedelta(days=1), TaskStatus.DONE, TaskPriority.MEDIUM, 1),
            ("Solicit Baked Goods Donations from Members", "Distribute sign-up sheet to member roster", volunteer.id, today + timedelta(days=1), TaskStatus.IN_PROGRESS, TaskPriority.HIGH, 2),
            ("Purchase Paper Plates, Napkins & Utensils", "Buy bulk recyclable supplies from warehouse store", treasurer.id, today + timedelta(days=2), TaskStatus.IN_PROGRESS, TaskPriority.MEDIUM, 3),
            ("Set Up Square / Cash Register Box", "Prepare change float and card reader hardware", treasurer.id, today + timedelta(days=4), TaskStatus.TODO, TaskPriority.HIGH, 4),
            ("Schedule Volunteer Shift Roster", "Assign 2 volunteers per 1-hour shift block", volunteer.id, today - timedelta(days=1), TaskStatus.TODO, TaskPriority.HIGH, 5), # Overdue task!
            ("Collect Silent Auction Baskets", "Pick up donated items from local merchant sponsors", admin.id, today + timedelta(days=6), TaskStatus.TODO, TaskPriority.MEDIUM, 6),
            ("Print QR Code Menus & Price Signs", "Laminate pricing sheets for table display", volunteer.id, today + timedelta(days=7), TaskStatus.TODO, TaskPriority.LOW, 7),
            ("Coordinate Day-of Logistics & Music", "Borrow sound speaker from campus audio department", volunteer.id, today + timedelta(days=8), TaskStatus.TODO, TaskPriority.LOW, 8),
            ("Post-Event Financial Reconciliation", "Deposit cash proceeds and log final balance", treasurer.id, today + timedelta(days=11), TaskStatus.TODO, TaskPriority.HIGH, 9),
        ]

        for title, desc, aid, ddate, stat, prio, pos in tasks_data:
            db.add(FundraiserTask(
                fundraiser_id=fundraiser.id,
                title=title,
                description=desc,
                assignee_id=aid,
                due_date=ddate,
                status=stat,
                priority=prio,
                position=pos
            ))

        # 8. Expense Claims
        claim_1 = ExpenseClaim(
            submitted_by_id=volunteer.id,
            fundraiser_id=fundraiser.id,
            description="Bake Sale Decoration, Tablecloths and Balloons",
            amount=Decimal("64.50"),
            category="Decorations",
            receipt_url="/uploads/receipt_bakesale_decor.png",
            status=ExpenseStatus.REIMBURSED,
            reviewed_by_id=treasurer.id,
            review_note="Approved and reimbursed via direct transfer.",
            created_at=now - timedelta(days=6),
            reimbursed_at=now - timedelta(days=4)
        )
        claim_2 = ExpenseClaim(
            submitted_by_id=volunteer.id,
            event_id=event_gala.id,
            description="Gala Centerpiece Florals and Ribbon",
            amount=Decimal("142.80"),
            category="Event Supplies",
            receipt_url="/uploads/receipt_gala_flowers.png",
            status=ExpenseStatus.APPROVED,
            reviewed_by_id=treasurer.id,
            review_note="Approved. Queued for next batch payout.",
            created_at=now - timedelta(days=3)
        )
        claim_3 = ExpenseClaim(
            submitted_by_id=admin.id,
            event_id=event_gala.id,
            description="Audio Equipment Cable Adapter & Extension Cord",
            amount=Decimal("28.95"),
            category="Equipment",
            receipt_url="/uploads/receipt_cable_adapter.png",
            status=ExpenseStatus.SUBMITTED,
            created_at=now - timedelta(days=1)
        )
        claim_4 = ExpenseClaim(
            submitted_by_id=demo_member.id,
            description="Personal Travel Parking Ticket",
            amount=Decimal("45.00"),
            category="Travel",
            receipt_url="/uploads/receipt_parking.png",
            status=ExpenseStatus.REJECTED,
            reviewed_by_id=treasurer.id,
            review_note="Personal parking tickets cannot be reimbursed per association bylaws.",
            created_at=now - timedelta(days=10)
        )
        db.add_all([claim_1, claim_2, claim_3, claim_4])

        # 9. Announcements
        announcements_data = [
            ("General Body Meeting & Spring Election Overview", "Join us this Thursday at 6:00 PM in the Student Union Auditorium for our monthly GBM. We will discuss upcoming leadership elections, budget allocation, and volunteer committee sign-ups.", AnnouncementCategory.MEETING, now - timedelta(days=3), 28),
            ("Spring Gala Ticket Early Bird Deadline Approaching", "A reminder that discounted member pricing for the Spring Gala 2025 will close soon. Please secure your tickets early as seating capacity in the Grand Ballroom is strictly limited.", AnnouncementCategory.DEADLINE, now - timedelta(days=7), 35),
            ("Room Change for Python & AI Workshop", "Please note that today's AI coding workshop has been moved from Room 204 to the larger Innovation Lab in the Tech Building (Room 410) to accommodate everyone.", AnnouncementCategory.CHANGE_OF_PLAN, now - timedelta(days=12), 22),
            ("Skyline Hoodies and Merch Now Available in Store!", "Check out the official Skyline store! Premium embroidered fleece hoodies and organic cotton tees are now in stock with special automatic member discounts at checkout.", AnnouncementCategory.GENERAL, now - timedelta(days=18), 40),
            ("Congratulations to our Hackathon Champions!", "Big shoutout to Team Skyline Cyber for taking 1st place in the Tri-University Hackathon last weekend! Their smart campus navigation project won top honors.", AnnouncementCategory.GENERAL, now - timedelta(days=25), 50),
            ("Executive Board Office Hours Schedule Announced", "President Arjun Sharma and Treasurer Priya Mehta will hold weekly drop-in office hours every Tuesday and Thursday from 2 PM to 4 PM in Union Room 102.", AnnouncementCategory.GENERAL, now - timedelta(days=40), 30),
        ]

        for title, body, cat, pub_at, rec_cnt in announcements_data:
            db.add(Announcement(
                title=title,
                body=body,
                category=cat,
                author_id=admin.id,
                published_at=pub_at,
                email_sent=True,
                recipient_count=rec_cnt
            ))

        # 10. Subscribers & Email Logs
        db.add(MailingListSubscriber(email="alumni-chair@skyline.edu", name="Skyline Alumni Network", subscribed=True))
        db.add(MailingListSubscriber(email="dean-student-affairs@skyline.edu", name="Dean Office", subscribed=True))
        db.add(MailingListSubscriber(email="campus-news@skyline.edu", name="Daily Campus Chronicle", subscribed=True))

        db.add(EmailLog(to_email="member@skyline.edu", subject="Welcome to Skyline Hub", body="Welcome to Skyline Student Association!", sent_at=now - timedelta(days=90), related_type="AUTH"))
        db.add(EmailLog(to_email="member@skyline.edu", subject="Your Ticket for Spring Gala 2025", body="Here is your ticket code TCK-GALA-0001", sent_at=now - timedelta(days=10), related_type="TICKET"))

        # 11. Transactions spanning 4 months for rich financial analytics
        # Month -3
        db.add(Transaction(type=TransactionType.INCOME, source=TransactionSource.DUES, amount=Decimal("480.00"), description="Fall Membership Dues Batch 1", date=now - timedelta(days=110), created_by_id=treasurer.id))
        db.add(Transaction(type=TransactionType.INCOME, source=TransactionSource.TICKET, amount=Decimal("1650.00"), description="Fall Welcome Bash Ticket Sales", date=now - timedelta(days=120), created_by_id=treasurer.id))
        db.add(Transaction(type=TransactionType.EXPENSE, source=TransactionSource.OTHER, amount=Decimal("620.00"), description="Fall Welcome Bash Catering & Sound", date=now - timedelta(days=119), created_by_id=treasurer.id))

        # Month -2
        db.add(Transaction(type=TransactionType.INCOME, source=TransactionSource.DUES, amount=Decimal("350.00"), description="Late Fall Membership Registrations", date=now - timedelta(days=80), created_by_id=treasurer.id))
        db.add(Transaction(type=TransactionType.INCOME, source=TransactionSource.DONATION, amount=Decimal("500.00"), description="Alumni Council Sponsorship Grant", date=now - timedelta(days=75), created_by_id=treasurer.id))
        db.add(Transaction(type=TransactionType.EXPENSE, source=TransactionSource.MERCH, amount=Decimal("850.00"), description="Bulk Apparel Inventory Order (Hoodies & Tees)", date=now - timedelta(days=70), created_by_id=treasurer.id))

        # Month -1
        db.add(Transaction(type=TransactionType.INCOME, source=TransactionSource.MERCH, amount=Decimal("420.00"), description="Club Store Merchandise Sales", date=now - timedelta(days=40), created_by_id=treasurer.id))
        db.add(Transaction(type=TransactionType.INCOME, source=TransactionSource.DUES, amount=Decimal("260.00"), description="Spring Semester Dues Additions", date=now - timedelta(days=35), created_by_id=treasurer.id))
        db.add(Transaction(type=TransactionType.EXPENSE, source=TransactionSource.OTHER, amount=Decimal("180.00"), description="Web Hosting, Domain & Server Maintenance", date=now - timedelta(days=30), created_by_id=treasurer.id))

        # Current Month
        db.add(Transaction(type=TransactionType.INCOME, source=TransactionSource.TICKET, amount=Decimal("2150.00"), description="Spring Gala 2025 Early Bird Ticket Sales", date=now - timedelta(days=12), created_by_id=treasurer.id))
        db.add(Transaction(type=TransactionType.INCOME, source=TransactionSource.FUNDRAISER, amount=Decimal("1650.00"), description="Spring Bake Sale Quad Proceeds", date=now - timedelta(days=8), created_by_id=treasurer.id))
        db.add(Transaction(type=TransactionType.INCOME, source=TransactionSource.MERCH, amount=Decimal("288.00"), description="Spring Merch Store Orders", date=now - timedelta(days=4), created_by_id=treasurer.id))
        db.add(Transaction(type=TransactionType.EXPENSE, source=TransactionSource.REIMBURSEMENT, amount=Decimal("64.50"), description="Reimbursement: Rohan Verma (Bake Sale Decor)", date=now - timedelta(days=4), created_by_id=treasurer.id))

        db.commit()
        print("[SEED] Database successfully seeded with realistic demo data!")
    except Exception as e:
        db.rollback()
        print(f"[SEED ERROR] {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
