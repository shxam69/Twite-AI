<<<<<<< HEAD
﻿# Mini Attendance Management System

> **Status: UNDER ACTIVE DEVELOPMENT (Foundation & Architecture Phase)**  
> Built as a Junior Software Engineer Technical Assessment project focusing on simplicity, modularity, and clean code principles.

---

## 📖 Project Description

The **Mini Attendance Management System** is a lightweight, full-stack web application designed to track employee attendance, manage personnel records, and provide real-time dashboard analytics.

This repository contains the clean initial architectural foundation:
- Modular Node.js / Express backend with health monitoring
- Normalized MySQL relational database schema with referential integrity and indexes
- Modern React + Vite frontend styled with Tailwind CSS, React Router, and a centralized Axios client

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React.js, Vite, JavaScript (ES6+), Tailwind CSS, React Router DOM, Axios |
| **Backend** | Node.js, Express.js, JavaScript, RESTful APIs |
| **Database** | MySQL (with `mysql2` connection pooling) |
| **Security & Auth** | JWT (JSON Web Tokens), `bcryptjs` (Password hashing) |

---

## 📁 Project Structure

```text
attendance-management-system/
│
├── frontend/                     # React + Vite Client
│   ├── src/
│   │   ├── components/           # Reusable UI components (Navbar, etc.)
│   │   ├── layouts/              # Master layouts (MainLayout with outlet)
│   │   ├── pages/                # Route pages (Login, Dashboard, Employees, Attendance)
│   │   ├── services/             # Centralized Axios API client & endpoints
│   │   ├── context/              # Context providers (future auth state)
│   │   ├── hooks/                # Custom React hooks
│   │   ├── utils/                # Frontend helper utilities
│   │   ├── App.jsx               # Client router setup
│   │   ├── index.css             # Tailwind CSS imports and global styles
│   │   └── main.jsx              # Vite React entrypoint
│   ├── index.html
│   ├── vite.config.js            # Vite + Tailwind plugin config
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
│
├── backend/                      # Express REST API Server
│   ├── src/
│   │   ├── config/               # Database pool and environment config
│   │   │   └── db.js
│   │   ├── controllers/          # Route controller handlers (future steps)
│   │   ├── routes/               # API route definitions
│   │   │   └── healthRoutes.js
│   │   ├── services/             # Core business logic (future steps)
│   │   ├── middleware/           # Error handling & authentication middleware
│   │   │   └── errorHandler.js
│   │   ├── scripts/              # Seed scripts (seedAdmin.js)
│   │   │   └── seedAdmin.js
│   │   ├── utils/                # Shared utilities
│   │   ├── app.js                # Express app initialization & middleware
│   │   └── server.js             # Server entrypoint and port listener
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
│
├── database/
│   └── schema.sql                # Complete relational schema (users, employees, attendance)
│
├── README.md                     # Project documentation & setup guide
└── .gitignore                    # Root gitignore
```

---

## ⚙️ Prerequisites

Make sure the following tools are installed on your machine:
- **Node.js** (v18.x or later)
- **npm** (v9.x or later)
- **MySQL Server** (v8.0 or later)

---

## 🚀 Step-by-Step Setup Guide

### 1. Database Setup (MySQL)

1. Open your MySQL client or CLI:
   ```bash
   mysql -u root -p
   ```
2. Execute the schema script located at `database/schema.sql`:
   ```sql
   SOURCE C:/attendance-management-system/database/schema.sql;
   ```
   *Alternatively in Windows PowerShell:*
   ```powershell
   Get-Content database/schema.sql | mysql -u root -p
   ```
   This will create the `attendance_management` database with tables:
   - `users` (id, username, password hash, role, timestamps)
   - `employees` (id, employee_id, name, email, mobile, department, designation, status, timestamps)
   - `attendance` (id, employee_id, attendance_date, check_in, check_out, status, timestamps)

---

### 2. Backend Setup

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` configuration from the example template:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` with your MySQL credentials:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=attendance_management
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=24h
   ```
5. *(Optional)* Seed the initial admin account (hashes password with bcrypt):
   ```bash
   npm run seed:admin
   ```
6. Start the backend development server:
   ```bash
   npm run dev
   ```
   Server will run at: `http://localhost:5000`  
   Health check endpoint: `http://localhost:5000/api/health`

---

### 3. Frontend Setup

1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the environment:
   ```bash
   cp .env.example .env
   ```
   Ensure `VITE_API_BASE_URL` points to your backend:
   ```env
   VITE_API_BASE_URL=http://localhost:5000
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Frontend will run at: `http://localhost:5173`

---

## 🧪 Verification & Health Check

1. **Verify Backend Status**:
   - `GET http://localhost:5000/` -> returns API running status
   - `GET http://localhost:5000/api/health` -> returns server uptime, timestamp, and database connectivity check
2. **Verify Frontend Build**:
   ```bash
   cd frontend
   npm run build
   ```
3. **Verify Routing & Shell**:
   - Navigate to `http://localhost:5173/dashboard` to view the status dashboard with live backend health indicator.
   - Navigate through `/employees`, `/attendance`, and `/login` via the navigation bar.

---

## 🗺️ Implementation Roadmap

- [x] **Phase 1: Project Architecture & Foundation (Current)**
- [ ] **Phase 2: Authentication Module (JWT login, register, role-based protection)**
- [ ] **Phase 3: Employee Management Module (Add, View, Update, Delete with validation)**
- [ ] **Phase 4: Attendance Management Module (Daily Check-in, Check-out, Status calculation)**
- [ ] **Phase 5: Analytics Dashboard (Live statistics, metrics, daily summary)**
=======
# Twite-AI
Twite AI Company Technical Assignment Task
>>>>>>> origin/main
