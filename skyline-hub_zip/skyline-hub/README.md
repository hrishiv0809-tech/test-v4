# Skyline Hub - Student Organization Management System

Unified Student Organization Management System for the **Skyline Student Association**, built with FastAPI, MySQL 8, SQLAlchemy 2.0, Alembic, Pydantic v2, and APScheduler.

---

## ?? Tech Stack

- **Framework**: FastAPI (Python 3.11+)
- **ORM & Database**: SQLAlchemy 2.0 (typed Mapped[] style), MySQL 8 (PyMySQL driver)
- **Migrations**: Alembic
- **Validation**: Pydantic v2 & Pydantic-Settings
- **Security & Auth**: JWT (PyJWT), bcrypt password hashing, Role-Based Access Control (ADMIN, TREASURER, VOLUNTEER, MEMBER)
- **QR Codes**: qrcode + Pillow (PNG & base64 data URLs)
- **Scheduler**: APScheduler (Daily membership renewal reminders and automated lapsed expiration)
- **Financial Ledger**: Centralized single-source-of-truth transaction service
- **Concurrency**: Row locking with SELECT ... FOR UPDATE for ticket purchases, stock deductions, and check-ins

---

## ?? Demo Accounts

| Role | Email | Password | Description |
|---|---|---|---|
| **ADMIN** | dmin@skyline.edu | dmin123 | Full access to all modules, quick-add, event management, announcements broadcast |
| **TREASURER** | 	reasurer@skyline.edu | 	reasurer123 | Finance KPI dashboard, SQL aggregations, expense claim reimbursement, transaction ledger |
| **VOLUNTEER** | olunteer@skyline.edu | olunteer123 | Door check-in scanner/search, fundraiser task management, expense submission |
| **MEMBER** | member@skyline.edu | member123 | Active Premium member, digital QR card, member-discounted ticket & merch purchases |

---

## ??? Quick Start

### 1. MySQL Database

Ensure MySQL 8 is running on port 3306 or 3307. You can also run with Docker Compose:
`ash
docker compose up -d
`

### 2. Backend Setup

`ash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
`

### 3. API Documentation

Visit http://localhost:8000/docs for interactive Swagger UI docs.
