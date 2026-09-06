# Twite AI Technologies — Mini Attendance Management System

> **Junior Software Engineer Technical Assessment Project**  
> Full-Stack Production Enterprise Attendance Management System with Dynamic Rotating QR Verification, GPS Geofencing, Employee Self-Registration, Leave Portal, Attendance Corrections, Audit Events, CSV Analytics, OpenAPI Swagger Specs, and Docker Containerization.

---

8: ## 📋 Table of Contents
9: 1. [System Architecture](#1-system-architecture)
10: 2. [Tech Stack](#2-tech-stack)
11: 3. [Production Deployment (Render)](#3-production-deployment-render)
12: 4. [Setup & Installation Instructions](#4-setup--installation-instructions)
13: 5. [Environment Variables](#5-environment-variables)
14: 6. [Database Schema & Migrations](#6-database-schema--migrations)
15: 7. [API Documentation & Swagger UI](#7-api-documentation--swagger-ui)
16: 8. [Security Model & RBAC Rules](#8-security-model--rbac-rules)
17: 9. [Dynamic Rotating QR Code & GPS Geofencing (Phase 8C)](#9-dynamic-rotating-qr-code--gps-geofencing-phase-8c)
18: 10. [Physical Android Phone LAN Testing Walkthrough](#10-physical-android-phone-lan-testing-walkthrough)
19: 11. [Leave Request & Approval System (Phase A)](#11-leave-request--approval-system-phase-a)
20: 12. [Attendance Remarks & Corrections (Phase B & C)](#12-attendance-remarks--corrections-phase-b--c)
21: 13. [Audit Event Timeline & Event Logs (Phase D)](#13-audit-event-timeline--event-logs-phase-d)
22: 14. [Admin Action Notifications Center (Phase E)](#14-admin-action-notifications-center-phase-e)
23: 15. [Dashboard Analytics & Currently In Office Features (Phase F & H)](#15-dashboard-analytics--currently-in-office-features-phase-f--h)
24: 16. [Report Export to CSV (Phase I)](#16-report-export-to-csv-phase-i)
25: 17. [Docker Deployment Guide (Phase M)](#17-docker-deployment-guide-phase-m)
26: 18. [Automated Test Suites & Verification Commands (Phase K)](#18-automated-test-suites--verification-commands-phase-k)
27: 19. [Known Limitations & Future Enhancements (Phase N)](#19-known-limitations--future-enhancements-phase-n)

---

## 3. Production Deployment (Render)

The system is fully configured for continuous deployment on **Render** (or any cloud hosting platform).

### 1. Backend Render Service Setup
- **Service Type**: Web Service
- **Environment**: Node.js
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`
- **Public URL**: `https://<BACKEND-RENDER-URL>`

### 2. Frontend Render Static Site Setup
- **Service Type**: Static Site
- **Environment**: Static
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **SPA Routing Rewrite Rule**:
  - Source: `/*`
  - Destination: `/index.html`
  - Action: Rewrite (200)

---

### 3. Render Required Environment Variables

#### BACKEND ENVIRONMENT VARIABLES
Configure these in Render Web Service Dashboard (Environment tab):

```env
# Server Binding (Render automatically assigns PORT)
PORT=10000
NODE_ENV=production

# Public Backend Domain (Used for Swagger URLs & OAuth links)
BACKEND_PUBLIC_URL=https://<YOUR-BACKEND-RENDER-URL>.onrender.com

# Database Connection (MySQL 8 / Aiven / PlanetScale / Render Database)
DB_HOST=<YOUR_DB_HOST>
DB_PORT=3306
DB_USER=<YOUR_DB_USER>
DB_PASSWORD=<YOUR_DB_PASSWORD>
DB_NAME=<YOUR_DB_NAME>
# OR single connection URI:
# DATABASE_URL=mysql://user:pass@host:3306/dbname

# JWT Authentication
JWT_SECRET=<RANDOM_HIGH_ENTROPY_64_CHAR_SECRET>
JWT_EXPIRES_IN=1d

# CORS & Trusted Frontend Origins
ALLOWED_ORIGINS=https://<YOUR-FRONTEND-RENDER-URL>.onrender.com
FRONTEND_URL=https://<YOUR-FRONTEND-RENDER-URL>.onrender.com

# Note: Attendance & Geofence policies (workplace_latitude, workplace_longitude,
# workplace_radius_meters, qr_validity_seconds, etc.) are managed dynamically via
# the attendance_policies database table and Admin UI, NOT via environment variables.
```

> [!NOTE]
> **Database Initialization & Migrations**: Database schema creation and initial seeding (`node backend/src/scripts/migrateFinal.js` and `seedAdmin.js`) are a **deliberate one-time manual production setup operation**. They must NOT be configured as Render's automated build or start command.

#### FRONTEND ENVIRONMENT VARIABLES
Configure this in Render Static Site Dashboard:

```env
# Production API Base URL pointing to deployed Render Express Backend
VITE_API_BASE_URL=https://<YOUR-BACKEND-RENDER-URL>.onrender.com/api
```

---

### 4. Production API Root & Endpoints

- **Production API Base**: `https://<BACKEND-RENDER-URL>/api`
- **Swagger / OpenAPI UI**: `https://<BACKEND-RENDER-URL>/api/docs`
- **Public Health Check**: `https://<BACKEND-RENDER-URL>/api/health`

---

### 5. Local vs Production Environment Differences

| Feature | Local Development | Render Production |
| :--- | :--- | :--- |
| **API Base URL** | `/api` (proxied via Vite) or `http://localhost:5000/api` | `https://<BACKEND-RENDER-URL>/api` (from `VITE_API_BASE_URL`) |
| **HTTPS Certificates** | `mkcert` self-signed certs in `certs/` for LAN mobile QR camera access | Render Managed SSL (automatic Let's Encrypt HTTPS) |
| **Server Port** | Fixed `5000` | Dynamic `process.env.PORT` (e.g. 10000) binding to `0.0.0.0` |
| **CORS** | Permits `localhost:5173`, `127.0.0.1:5173` | Restricted to `ALLOWED_ORIGINS` / `FRONTEND_URL` |
| **SPA Routing** | Handled natively by Vite dev server | Configured via `render.yaml` rewrite `/* -> /index.html` |

---

### 6. Testing the Deployed Application

1. **Verify Health Endpoint**:
   Open `https://<BACKEND-RENDER-URL>/api/health` in your browser. Expected response: `{"status":"ok","database":{"connected":true...}}`.
2. **Verify Swagger Documentation**:
   Open `https://<BACKEND-RENDER-URL>/api/docs`. Test authorization using the **Authorize** button with `Bearer <JWT_TOKEN>`.
3. **Verify Frontend SPA Navigation & Refresh**:
   Log in at `https://<FRONTEND-RENDER-URL>/login`. Navigate to `/dashboard`, `/employees`, `/attendance`, `/leaves`, `/attendance/corrections`, `/qr-display`. Hard refresh (`Ctrl+F5` / `Cmd+R`) on any route to confirm 200 SPA rewrite fallback works without 404 errors.
4. **Verify Attendance Flow**:
   Test manual check-in/out, leave application submission, correction request workflow, and dynamic QR scanner on mobile browser.

---

## 1. System Architecture

The application adopts a **Backend-Authoritative 3-Tier Architecture**:

```text
       ┌────────────────────────────────────────────────────────┐
       │                 CLIENT LAYER (FRONTEND)               │
       │  React 18 (Vite) + Tailwind CSS + React Router v6      │
       │  - Admin Desktop Browser / Dedicated QR Display Portal  │
       │  - Mobile Employee PWA / Native Browser over LAN HTTPS  │
       └───────────────────────────┬────────────────────────────┘
                                   │ HTTPS / REST API
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │              APPLICATION SERVER (BACKEND)              │
       │  Node.js (v20+) + Express.js REST API Server          │
       │  - JWT Bearer Authentication & RBAC Enforcer           │
       │  - SHA-256 Dynamic QR Rotation Engine                  │
       │  - Haversine Distance Workplace GPS Validator           │
       │  - Transactional Approval Engine (ACID Guarantees)    │
       │  - Audit Event Recorder & Notification Aggregator       │
       │  - Swagger / OpenAPI Docs Provider (/api/docs)         │
       └───────────────────────────┬────────────────────────────┘
                                   │ Connection Pool (mysql2)
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                DATABASE LAYER (MYSQL 8.0)              │
       │  MySQL 8.0 Relational Database Engine                 │
       │  - users, employees, attendance, attendance_events      │
       │  - qr_challenges, qr_challenge_uses, help_requests     │
       │  - attendance_policies, leave_requests, corrections   │
       └────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

- **Frontend**: React.js 18, Vite, Tailwind CSS, Axios, React Router DOM v6, html5-qrcode.
- **Backend**: Node.js, Express.js, JWT (`jsonwebtoken`), `bcryptjs`, `cors`, `swagger-ui-express`, `swagger-jsdoc`.
- **Database**: MySQL 8.0 with `mysql2` connection pooling & parameterized queries.
- **DevOps & Containers**: Docker, Docker Compose, Nginx.

---

## 3. Setup & Installation Instructions

### Prerequisites
- Node.js v18+ and npm v9+
- MySQL Server v8.0 running on port 3306

### Local Setup Steps

1. **Clone repository and install dependencies**:
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

2. **Database Migration**:
   ```bash
   # Run schema & migration scripts
   node backend/src/scripts/migrateFinal.js
   node backend/src/scripts/seedAdmin.js
   ```

3. **Start Backend Server**:
   ```bash
   cd backend
   npm run dev
   ```
   *Backend runs at: `http://localhost:5000` (Swagger UI at `/api/docs`)*

4. **Start Frontend Server**:
   ```bash
   cd frontend
   npm run dev
   ```
   *Frontend runs at: `http://localhost:5173`*

---

## 4. Environment Variables

Configuration template (`backend/.env.example`):

```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root_password
DB_NAME=attendance_management
JWT_SECRET=dev_attendance_jwt_secret_key_2026
JWT_EXPIRES_IN=8h
ALLOWED_ORIGINS=http://localhost:5173,https://localhost:5173
FRONTEND_URL=http://localhost:5173
```

---

## 5. Database Schema & Migrations

The MySQL database schema contains 9 normalized tables:
- `users`: Credentials, BCrypt hash, user role (`admin` | `employee`), linked `employee_id`.
- `employees`: Core workforce records (`employee_id`, name, email, department, designation, status).
- `attendance`: Daily attendance logs (date, check_in, check_out, status, verification_method, remarks).
- `attendance_events`: Immutable audit timeline (event_type, verification_method, sanitized metadata JSON).
- `attendance_policies`: Dynamic workplace policy key/value store.
- `qr_challenges`: Dynamic QR rotation state (`token_hash`, `expires_at`, `challenge_id`).
- `qr_challenge_uses`: Per-employee QR single-use tracking.
- `leave_requests`: Employee leave applications (`leave_type`, dates, status `PENDING` | `APPROVED` | `REJECTED`).
- `attendance_correction_requests`: Check-in time dispute requests with transactional approval workflow.

---

## 6. API Documentation & Swagger UI

Full interactive OpenAPI 3.0 documentation is hosted directly at:
👉 **`GET /api/docs`** (`http://localhost:5000/api/docs`)

Key Endpoints Summary:
- `POST /api/auth/login` — Login user & issue JWT
- `GET /api/dashboard/stats` — Admin analytics & 7-day trend
- `GET /api/dashboard/notifications/counts` — Unified Admin action notification counts
- `POST /api/attendance/qr/generate` — Generate active rotating QR code (Admin)
- `POST /api/attendance/qr/check-in` — Mobile QR check-in with GPS geofencing
- `GET /api/leave-requests` — List leave requests (`/my` for employee, `/` for admin)
- `POST /api/attendance/corrections` — Submit attendance correction request
- `GET /api/attendance/events` — Paginated audit log timeline
- `GET /api/attendance/export` — Download attendance report as CSV

---

## 7. Security Model & RBAC Rules

1. **JWT Authentication**: Tokens are validated on every request. Client user identity is derived **strictly from JWT payload** (`req.user.employee_id`). Client-provided `employee_id` parameters in request bodies are ignored.
2. **Role-Based Access Control (RBAC)**:
   - `admin`: Full management access to employees, QR display terminal, settings, approvals, CSV export, and audit logs.
   - `employee`: Access restricted strictly to personal dashboard, QR scanning, leave applications, correction requests, and personal history.
3. **No Credential / Token Leakage**: QR challenge raw tokens are never saved to database or logged in audit metadata. Only SHA-256 hashes are persisted.

---

## 8. Dynamic Rotating QR Code & GPS Geofencing (Phase 8C)

- **Rotation Engine**: Admin displays QR code that auto-rotates every 30 seconds.
- **Shared Active Challenge**: Multiple different employees can check in using the same active QR challenge during its 30s window.
- **Per-Employee Replay Protection**: Each employee can use a specific QR challenge ID at most once (`qr_challenge_uses` constraint).
- **Backend-Authoritative GPS Validation**: Mobile client sends device latitude/longitude. Server computes Haversine distance against configured workplace coordinates. Check-in is rejected if distance exceeds `workplace_radius_meters`.

---

## 9. Physical Android Phone LAN Testing Walkthrough

To perform a physical test with an Android phone scanning the Admin desktop screen:

1. **Start Vite with Host Access**:
   ```bash
   cd frontend
   npm run dev -- --host
   ```
2. **Locate PC's LAN IP**: Run `ipconfig` (e.g. `192.168.1.50`).
3. **Open Mobile Browser**:
   - Access `http://192.168.1.50:5173` on Android phone.
   - Log in as Employee (`emp_user1` / `EmpPass@123`).
4. **Open QR Display Portal on Desktop**: Log in as Admin on PC and open `/qr-display`.
5. **Scan & Verify**: Click **Scan QR & Check In** on phone, allow camera permission, scan desktop QR code. Verification & GPS distance check execute instantly!

---

## 10. Leave Request & Approval System (Phase A)

- Employees apply for leave specifying `leave_type` (`CASUAL`, `SICK`, `ANNUAL`, `UNPAID`), dates, and reason.
- Admin receives notification badge and reviews request in `/leaves` portal.
- Admin can Approve or Reject with optional comment.

---

## 11. Attendance Remarks & Corrections (Phase B & C)

- **Remarks**: Admins can add or edit custom remarks on any attendance record (e.g. "On-site client meeting").
- **Corrections**: Employees facing missing check-in timestamps submit correction requests.
- **Transactional Approval**: When Admin approves a correction request, the database executes an ACID transaction updating the attendance record status and check-in time while recording an `ADMIN_ATTENDANCE_UPDATE` audit event.

---

## 12. Audit Event Timeline & Event Logs (Phase D)

Accessible at `/admin/audit-log`:
- Interactive timeline table listing all system attendance events (`CHECK_IN`, `CHECK_OUT`, `CHECK_IN_FAILED`, `ADMIN_ATTENDANCE_UPDATE`).
- Displays sanitized event metadata (verification method, GPS distance in meters, user agent, IP address) without exposing raw secret tokens.

---

## 13. Admin Action Notifications Center (Phase E)

Unified bell icon dropdown in top Header:
- Real-time aggregated count of pending items:
  - 🆘 Open Help Requests
  - 🌴 Pending Leave Applications
  - ✏️ Pending Attendance Corrections
- One-click navigation directly to respective admin management portals.

---

## 14. Dashboard Analytics & Currently In Office Features (Phase F & H)

- **Visual KPI Stat Cards**: Active Employees, Present Today, Currently In Office, Absent Today, Attendance Rate %.
- **7-Day Attendance Trend**: Interactive bar chart displaying daily present count trends over past week.
- **Currently In Office List**: Real-time list of employees checked in today who have not checked out yet.
- **Department Breakdown**: Employee count and attendance share per department.

---

## 15. Report Export to CSV (Phase I)

Admin can download attendance reports formatted as CSV (`GET /api/attendance/export`):
- Respects active search and date filters (`start_date`, `end_date`, `status`).
- Triggers automatic browser file download (`attendance_report_YYYY-MM-DD.csv`).

---

## 16. Docker Deployment Guide (Phase M)

Run the entire full-stack application (MySQL 8, Node.js Backend, Nginx Frontend) with one command:

```bash
docker-compose up --build -d
```

- **Frontend App**: `http://localhost`
- **Backend REST API**: `http://localhost:5000`
- **MySQL Database**: `localhost:3306`

To stop container services:
```bash
docker-compose down
```

---

## 17. Automated Test Suites & Verification Commands (Phase K)

Run all 6 comprehensive automated test suites:

```bash
cd backend

# Phase 6 Regression Test (Auth & RBAC Rules)
node src/scripts/testPhase6.js

# Phase 7 Regression Test (Invitation & Registration)
node src/scripts/testPhase7.js

# Phase 7.5 Regression Test (Tenant Isolation & Dashboard)
node src/scripts/testPhase7.5.js

# Phase 8B Regression Test (Audit Events & Policies)
node src/scripts/testPhase8b.js

# Phase 8C Regression Test (Rotating QR & Geofencing)
node src/scripts/testPhase8c.js

# Phase 9 Automated Test Suite (Leaves, Corrections, Analytics, CSV, Swagger)
node src/scripts/testPhase9.js
```

Frontend Production Build Validation:
```bash
cd frontend
cmd /c npm run build
```

---

## 18. Known Limitations & Future Enhancements (Phase N)

- **Future Biometric Integration**: WebAuthn / FIDO2 fingerprint or facial recognition check-in support.
- **Push Notifications**: Web Push / FCM notifications for instant leave approval alerts.
- **PWA Offline Sync**: Service Worker queueing for offline check-in when internet connection drops temporarily.
