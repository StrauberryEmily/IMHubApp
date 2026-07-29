# IMH - Inventory Management Hub | Complete System Blueprint

**Last Updated:** July 29, 2026  
**Version:** 1.0 - PRODUCTION READY  
**Status:** ✅ Deployed to https://imhubapp-production.up.railway.app/

---

## 📋 TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Database Schema](#database-schema)
4. [Backend (server.js)](#backend-serverjs)
5. [Frontend (index.html)](#frontend-indexhtml)
6. [Authentication & Authorization](#authentication--authorization)
7. [Role Hierarchy & Access Control](#role-hierarchy--access-control)
8. [Data Flow & Initialization](#data-flow--initialization)
9. [Key Features Implementation](#key-features-implementation)
10. [Google Sheets Integration](#google-sheets-integration)
11. [localStorage Structure](#localstorage-structure)
12. [UI Components & Dashboard](#ui-components--dashboard)
13. [Deployment & Production](#deployment--production)
14. [Troubleshooting & Recovery](#troubleshooting--recovery)
15. [Testing Checklist](#testing-checklist)

---

## SYSTEM OVERVIEW

### Purpose
IMH is a complete inventory management system for tracking stock, deliveries, expiry dates, waste, movements, and tasks. It supports multi-user access with role-based permissions and real-time Google Sheets synchronization.

### Core Features
- **Multi-User Authentication** with password recovery
- **Role-Based Access Control** (Owner, Admin, Manager, Staff, Viewer)
- **Owner Protection** - One account (emilyjreed01@gmail.com) that cannot be removed
- **Admin Features** - Export/backup data, team management, user creation
- **Dashboard** - Inventory overview with expiry alerts, movements, waste tracking
- **Real-Time Data Sync** - Google Sheets → App synchronization every 30 seconds
- **Profile Persistence** - User settings and pictures persist across sessions
- **Ordering System** - 10 supplier shortcuts with Coming Soon banners

### Key Stakeholders
- **Owner:** Emily (emilyjreed01@gmail.com) - Full access, system administrator
- **Admins:** Can manage team members, export data, create backups
- **Managers:** Can edit inventory and deliveries
- **Staff:** Basic viewing and input
- **Viewers:** Read-only access

---

## ARCHITECTURE & TECHNOLOGY STACK

### Backend
- **Runtime:** Node.js with Express.js v4.18.2
- **Database:** SQLite3 v5.1.6 at `/Users/emilyreed/new/users.db`
- **Port:** 
  - Development: localhost:3000 (via `npm start`)
  - Production: Railway (https://imhubapp-production.up.railway.app/)
- **Security:** bcrypt v5.1.1 (10 salt rounds), express-rate-limit
- **Key Dependencies:**
  - `sqlite3`: Database access
  - `bcrypt`: Password hashing
  - `express`: Web framework
  - `express-rate-limit`: Login throttling

### Frontend
- **Type:** Single-file Vanilla JavaScript (no build tools)
- **File:** `/Users/emilyreed/new/index.html` (~4600+ lines)
- **CSS:** Embedded with CSS variables for theming
- **Libraries:**
  - Papa Parse 5.4.1 - CSV parsing from Google Sheets
  - jQuery (via CDN for AJAX)
- **Storage:** localStorage for all client-side persistence

### External Services
- **Google Sheets:** Data source with 6 tabs (Inventory, Deliveries, Expiry, Movements, Waste, Tasks)
  - Sheet ID: `1N5tJAWJDXQCHLhH51npQCZJfBQ-k2C3f6U-dEhOJkuE`
  - CSV export via Papa Parse
  - Apps Script integration (future: POST sync capability)
- **Railway:** Cloud deployment platform
  - GitHub integration: https://github.com/StrauberryEmily/IMHubApp
  - Branch: `main`
  - Auto-deploys on `git push`

### Development Workflow
```
Local → Git Commit → GitHub (main) → Railway Auto-Deploy → Production Live
         ↓
    Verified via curl/browser
```

---

## DATABASE SCHEMA

### Users Table
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    recoveryCode TEXT,
    role TEXT DEFAULT 'Staff',
    isPrimaryAdmin INTEGER DEFAULT 0,
    isOwner INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Column Purposes
| Column | Type | Purpose | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | Auto-incrementing primary key | Unique identifier |
| `email` | TEXT | User email (login credential) | Must be unique |
| `passwordHash` | TEXT | bcrypt hash of password | Never store plain text |
| `recoveryCode` | TEXT | 6-digit code for account recovery | Generated on registration |
| `role` | TEXT | User role for access control | 'Owner', 'Admin', 'Manager', 'Staff', 'Viewer' |
| `isPrimaryAdmin` | INTEGER | Legacy flag (deprecated, use isOwner) | Kept for backward compatibility |
| `isOwner` | INTEGER | 1 if user is Owner, 0 otherwise | Only emilyjreed01@gmail.com has this = 1 |
| `createdAt` | DATETIME | Account creation timestamp | Set automatically |
| `updatedAt` | DATETIME | Last account modification timestamp | Updated on changes |

### Current User Records
**emilyjreed01@gmail.com:**
- role: 'Owner'
- isOwner: 1
- isPrimaryAdmin: 1 (legacy)
- Protected from removal by any admin

### Schema Migration Logic
On app startup (`server.js` lines 133-160), the code checks if `isPrimaryAdmin` and `isOwner` columns exist. If not, it adds them automatically. This allows seamless upgrades.

---

## BACKEND (server.js)

### Architecture
Express.js server with SQLite3 database, bcrypt authentication, and role-based access control.

### Key Endpoints

#### 1. **POST /api/register** (Lines 307-365)
**Purpose:** Create new user account

**Request:**
```javascript
{
    email: "user@example.com",
    password: "SecurePass123"  // Must be 8+ chars, 1 number, 1 uppercase
}
```

**Response (201):**
```javascript
{
    email: "user@example.com",
    recoveryCode: "123456",
    role: "Staff"  // Default role
}
```

**Validation:**
- Email format must be valid (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- Password must be 8+ characters
- Password must contain at least 1 number
- Password must contain at least 1 uppercase letter
- Duplicate email prevention

**Process:**
1. Validate email and password
2. Hash password with bcrypt (10 salt rounds)
3. Generate 6-digit recovery code
4. Store in database with role='Staff' by default
5. Return recovery code and role to client

---

#### 2. **POST /api/setup-admin** (Lines 375-420)
**Purpose:** Grant Admin/Owner role to users (OWNER-ONLY operation)

**Request:**
```javascript
{
    email: "newadmin@example.com",
    setupKey: "ADMIN_SETUP_2024"  // Secret key for security
}
```

**Response (200):**
```javascript
{
    email: "newadmin@example.com",
    role: "Admin",        // or "Owner" if email is emilyjreed01@gmail.com
    isOwner: 0,           // 1 if Owner, 0 if Admin
    isPrimaryAdmin: 1     // Legacy flag
}
```

**Security:**
- Requires secret key: `'ADMIN_SETUP_2024'`
- Only emilyjreed01@gmail.com gets isOwner=1
- All others get role='Admin', isOwner=0
- Must be called from client after user approves role change

**Special Cases:**
- If email is `emilyjreed01@gmail.com`: Sets role='Owner', isOwner=1, isPrimaryAdmin=1
- If email is different: Sets role='Admin', isOwner=0, isPrimaryAdmin=1

**Called By:**
- `syncAdminToBackend()` in frontend when team member is added as Admin
- Must be called AFTER user is registered (user must exist in database)

---

#### 3. **POST /api/login** (Lines 425-475)
**Purpose:** Authenticate user and return role/permissions

**Request:**
```javascript
{
    email: "emilyjreed01@gmail.com",
    password: "UserPassword123"
}
```

**Response (200):**
```javascript
{
    email: "emilyjreed01@gmail.com",
    role: "Owner",
    isOwner: 1,
    isPrimaryAdmin: 1,
    recoveryCode: "123456"
}
```

**Process:**
1. Find user by email in database
2. Compare provided password with stored hash using bcrypt
3. If match: Return user data with role flags
4. If mismatch: Return 401 Unauthorized

**Critical:** This is where role and isOwner flags are transferred from database to frontend. Frontend stores these in localStorage on first login.

**Rate Limiting:**
- Throttled via express-rate-limit
- Prevents brute force attacks

---

### Database Helper Functions

#### `sanitizeInput(input)` (Lines 1-20)
Escapes SQL injection attempts. Called on all user inputs before database queries.

#### Database Initialization
On `server.js` startup:
1. Opens SQLite3 connection to `users.db`
2. Creates `users` table if not exists (lines 133-160)
3. Migrates schema: Adds `isPrimaryAdmin` column if missing
4. Migrates schema: Adds `isOwner` column if missing
5. Logs "✅ Database initialized"

---

### Server Startup
```bash
npm start  # Runs: node server.js
```

Server listens on port 8080 (production via Railway) or 3000 (development).

Static file serving: Serves `/index.html` at root, all CSS/JS embedded in single file.

---

## FRONTEND (index.html)

### Architecture
Single 4600+ line Vanilla JavaScript application with:
- 8 main tabs (Dashboard, Stock, Deliveries, Movement, Expiry, Waste, Tasks, Ordering, Settings)
- Role-based UI enforcement
- Real-time data synchronization
- localStorage-based persistence

### Global Variables (Line 2347+)

```javascript
// User identification
let currentUserName = '',
    currentUserEmail = '',
    currentUserRole = 'Staff',
    currentUserLocation = 'All Locations';

// Role flags
let isOwner = 0;  // 1 if logged in as Owner, 0 otherwise

// Data storage
let inventory = [],
    expiryDates = [],
    movements = [],
    waste = [],
    tasks = [],
    allUsers = {},
    currentPage = 'dashboard';

// Theme
let isDarkTheme = false;

// External config
const SHEET_ID = '1N5tJAWJDXQCHLhH51npQCZJfBQ-k2C3f6U-dEhOJkuE';
const APPS_SCRIPT_URL = null;  // Future: Apps Script for POST sync
```

### Key Functions

#### **handleLogin()** (Lines 2510-2540)
**Purpose:** Authenticate user and initialize session

**Flow:**
1. Get email and password from login form
2. POST to `/api/login` endpoint
3. If success (200):
   - Extract role, isOwner, isPrimaryAdmin from response
   - Store in localStorage: userRole, isOwner, isPrimaryAdmin
   - Store email: currentUser, currentUserEmail
   - Call `checkAuth()` to hide login screen
   - Call `initializeApp()` to load dashboard
4. If failure (401): Show error alert

**Critical Storage:**
```javascript
localStorage.setItem('userRole', data.role);
localStorage.setItem('isOwner', data.isOwner);
localStorage.setItem('isPrimaryAdmin', data.isPrimaryAdmin);
localStorage.setItem('currentUser', email);
```

**Recovery Code:**
- Received from server, stored in `user` object
- Displayed in Settings for account recovery

---

#### **isOwner()** (Line ~2520)
**Purpose:** Check if current user is Owner

**Logic:**
```javascript
function isOwner() {
    return isOwner === 1 || localStorage.getItem('isOwner') === '1';
}
```

**Returns:** true if user has OWNER role, false otherwise

**Used By:**
- Team member protection (prevent editing/deletion)
- Owner-level permission checks
- UI displays (👑 OWNER badge)

---

#### **isAdmin()** (Line ~2525)
**Purpose:** Check if user has admin-level access

**Logic:**
```javascript
function isAdmin() {
    return isOwner === 1 || 
           currentUserRole === 'Owner' || 
           currentUserRole === 'Admin' || 
           localStorage.getItem('isOwner') === '1' ||
           localStorage.getItem('userRole') === 'Admin';
}
```

**Returns:** true if Owner OR Admin, false otherwise

**Used By:**
- `checkAdminAccess()` function
- `enforceAdminUI()` to hide/disable non-admin features
- Export, backup, team management functions

**Role Hierarchy:**
- Owner > Admin > Manager > Staff > Viewer

---

#### **checkAdminAccess(actionName)** (Line 2699)
**Purpose:** Gate admin-only functions

**Implementation:**
```javascript
function checkAdminAccess(actionName) {
    if (!isAdmin()) {
        alert(`${actionName} is restricted to Administrators only`);
        return false;
    }
    return true;
}
```

**Returns:** true if user is admin, false and shows alert otherwise

**Called Before:**
- Export operations
- Backup creation
- Team member management
- User creation
- Any admin-level action

---

#### **checkAuth()** (Line ~2550)
**Purpose:** Verify user is logged in

**Process:**
1. Check localStorage for `currentUser` (email)
2. If missing: Show login screen, hide app
3. If present: Hide login screen, show app
4. Check localStorage for `userRole` and `isOwner`

**Called On:**
- Page load (refreshes)
- After successful login
- Before loading dashboard

---

#### **initializeApp()** (Lines 3291-3360)
**Purpose:** Initialize app on login, load all user data

**Key Steps:**
1. Load user profile (name, job title, email) from localStorage
2. Load user role with priority: (server stored) → (user object) → 'Staff' default
3. Load isOwner flag from localStorage
4. Update all UI displays (sidebar name, header, etc.)
5. Load all dashboard data via `loadAllData()`
6. Load theme preference via `loadTheme()`
7. Load profile picture via `loadProfileData()`
8. Initialize location selectors
9. Load team members list
10. Enforce role-based UI via `enforceAdminUI()`
11. Set auto-refresh timers:
    - `loadAllData()` every 30 seconds
    - Expiry countdown every 60 seconds

**Critical Variables Set:**
- `currentUserRole` - User's access level
- `isOwner` - 1 if Owner, 0 otherwise
- `currentUserLocation` - Default location filter

---

#### **enforceAdminUI()** (Line ~2710)
**Purpose:** Show/hide/disable non-admin features based on role

**Behavior:**
- Elements with `data-admin-only` attribute are hidden for non-admins
- Admin buttons are disabled with `cursor: not-allowed`
- Admin sections appear/disappear dynamically
- Called after login and on role changes

**Elements with `data-admin-only`:**
- Export buttons
- Backup buttons
- Team member management section
- User creation section
- Admin settings panels

---

#### **loadAllData()** (Line ~2450)
**Purpose:** Fetch and parse all data from Google Sheets

**Process (Every 30 Seconds):**
1. Fetch 6 CSV files from Google Sheets (via Papa Parse)
2. Parse each CSV into arrays:
   - `inventory[]` - Stock items
   - `expiryDates[]` - Items with expiry tracking
   - `movements[]` - Inventory movements
   - `waste[]` - Waste records
   - `tasks[]` - Task list
   - User data from Settings tab
3. Filter by current location if selected
4. Update dashboard displays
5. Recalculate expiry metrics
6. Log completion to console

**Data Sources:**
```javascript
// Google Sheets CSV Export URLs
const inventoryUrl = 'https://docs.google.com/spreadsheets/d/.../export?gid=0&format=csv';
const deliveryUrl = 'https://docs.google.com/spreadsheets/d/.../export?gid=549302222&format=csv';
// ... etc for 6 tabs
```

---

#### **updateExpiryMetrics()** (Line ~1200)
**Purpose:** Calculate expiry status counts for dashboard widget

**Filters:**
- Only items WITH expiry dates (excludes empty/null dates)
- Categorizes by days remaining:
  - **Expired:** 0 or less days
  - **Today:** 0 days
  - **This Week:** 1-7 days
  - **This Month:** 8-30 days

**Output:** Updates global `expiryMetrics` object
```javascript
{
    expired: count,
    today: count,
    sevenDay: count,
    thirtyDay: count
}
```

**Used By:** Dashboard expiry widgets

---

#### **updateExpiryAlertWidget()** (Line ~1250)
**Purpose:** Render "⚠️ EXPIRY ALERT" widget with color coding

**Display:**
- Red header: "⚠️ EXPIRY ALERT"
- Red text: Count of expired items
- Orange text: Count of items expiring today
- Yellow text: Count of items expiring within 7 days
- Clickable links to Expiry tab

**Color Scheme:**
- Red (#ff4444): Expired
- Orange (#ff9800): Expiring today
- Yellow (#ffbb33): Expiring within 7 days

---

#### **updateExpiredItemsWidget()** (Line ~1300)
**Purpose:** Render "Expired & Expiring Soon" widget with actual items

**Content:**
- Lists top 10 expired/expiring items
- For each item: Name, Quantity, Location, Days Remaining
- Red text for expired items
- Orange text for items expiring today
- Yellow text for items expiring within 7 days
- Clickable to navigate to Expiry tab

**Replaces:** Old "Movements Today" placeholder widget

---

#### **loadTeamMembers()** (Lines 2845+)
**Purpose:** Display team members with roles and protection indicators

**Rendering:**
- Fetches `allUsers` from localStorage
- For each team member:
  - Shows name, email, role, location
  - **If Owner (emilyjreed01@gmail.com):**
    - Shows 👑 OWNER badge
    - Shows red border
    - Shows "⚠️ PROTECTED - Has full access & cannot be removed"
    - Edit and Delete buttons DISABLED (`disabled` attribute, `cursor: not-allowed`)
  - **If Admin:**
    - Shows blue Edit/Delete buttons (enabled)
  - **If other roles:**
    - Shows colored role badges

**Key Protection:**
```javascript
const isOwnerAccount = email === 'emilyjreed01@gmail.com';
// Disable buttons
button.disabled = isOwnerAccount;
button.style.cursor = isOwnerAccount ? 'not-allowed' : 'pointer';
```

---

#### **editTeamMember(email)** (Lines 2885+)
**Purpose:** Edit team member role (Owner protected)

**Validation:**
1. Check `checkAdminAccess('Editing team members')`
2. If email === 'emilyjreed01@gmail.com': Show alert, return
   - "👑 Cannot modify OWNER account.\n\nThis account has full system access and is permanently protected."
3. Prompt for new role: Admin, Manager, Staff, Viewer
4. Update `allUsers` in localStorage
5. If changed to Admin: Call `syncAdminToBackend(email, true)`
6. Refresh display via `loadTeamMembers()`

---

#### **deleteTeamMember(email)** (Lines 2910+)
**Purpose:** Delete team member (Owner protected)

**Validation:**
1. Check `checkAdminAccess('Deleting team members')`
2. If email === 'emilyjreed01@gmail.com': Show alert, return
   - "👑 Cannot delete OWNER account.\n\nThis account is the system owner and is permanently protected."
3. Confirm deletion: `confirm('Delete {email} from team?')`
4. Remove from `allUsers` in localStorage
5. Refresh display via `loadTeamMembers()`

---

#### **syncAdminToBackend(email, isAdmin)** (Lines 2930+)
**Purpose:** Sync Admin role to backend database

**Process:**
1. Call `/api/setup-admin` endpoint
2. POST with email and setupKey='ADMIN_SETUP_2024'
3. If success: Log "Admin synced" to console
4. If failure: Log error, continue (local change persists)
5. On next login: User gets Admin role from database

**Critical:**
- This creates the backend record so role persists across login/logout
- Must be called after team member registers
- Called from `addTeamMember()` and `editTeamMember()`

---

#### **addTeamMember()** (Lines 2845+)
**Purpose:** Add new team member to system

**Process:**
1. Prompt for name, email, role, location
2. Validate inputs (email format, etc.)
3. Create user object:
   ```javascript
   {
       name: "Jane Doe",
       email: "jane@example.com",
       role: "Admin",
       location: "Main Store",
       recoveryCode: generateRecoveryCode()
   }
   ```
4. Add to `allUsers` in localStorage
5. If role is Admin: Call `syncAdminToBackend(email, true)`
6. Show success alert: "✅ Team member added!\n👤 {email} now has Admin access"
7. Refresh team members list

**Note:** This stores locally first, then syncs role to backend. User must register account separately via `/api/register`.

---

#### **saveProfileSettings()** (Lines 2679-2690)
**Purpose:** Save profile data (name, job title) with dual-key strategy

**Process:**
1. Get values from Settings form inputs
2. Store with BOTH key names for backward compatibility:
   ```javascript
   // Name
   localStorage.setItem('currentUserName', name);
   localStorage.setItem('userName', name);
   
   // Job Title
   localStorage.setItem('currentUserJobTitle', title);
   localStorage.setItem('userJobTitle', title);
   ```
3. Show success alert: "✅ Profile saved!"
4. Call `loadProfileData()` to refresh display

**Dual-Key Strategy:** Ensures profile persists even if code references different key names.

---

#### **loadProfileData()** (Lines 4740-4770)
**Purpose:** Load and display profile picture and settings

**Process:**
1. Check localStorage for profile picture (base64 encoded)
2. Check for user name with fallback chain:
   - `currentUserName` (preferred)
   - `userName` (legacy)
   - Default to current user email
3. Load profile data to ALL element variants:
   - `profilePicImg`
   - `topProfileImg`
   - `largeProfileImg`
   - `topProfileText` (initials)
   - `profilePicText` (initials)
4. Calculate initials from name
5. Display profile picture or initials in avatar

**Fallback Chain:**
- Ensures profile displays even if key names changed historically

---

#### **exportSelectedData()** (Lines 4330-4395)
**Purpose:** Export selected data categories to JSON (Admin-only)

**Features:**
- Check `checkAdminAccess('Exporting data')`
- Read 7 checkboxes:
  1. Inventory
  2. Deliveries
  3. Expiry
  4. Movements
  5. Waste
  6. Tasks
  7. User Settings
- Build JSON object with selected data
- Download as `IMH-export-[DATE].json`
- Alert: "✅ Export completed! File will not merge with existing data on import."

**File Format:**
```javascript
{
    timestamp: "2026-07-29 14:30:00",
    categories: {
        inventory: [...],
        deliveries: [...],
        expiry: [...],
        movements: [...],
        waste: [...],
        tasks: [...],
        userSettings: {...}
    }
}
```

---

#### **exportAllDataBackup()** (Lines 4397-4425)
**Purpose:** Complete backup of all localStorage data (Admin-only)

**Process:**
1. Check `checkAdminAccess('Creating backups')`
2. Serialize ALL localStorage keys to JSON
3. Download as `IMH-backup-[DATE].json`
4. Alert: "✅ Backup created! All data saved securely."

**Contains:** All inventory, user data, settings, profile info, role data

---

#### **importAllData()** (Lines 3104-3118)
**Purpose:** Import exported data (NO MERGE - Replace Mode)

**Critical Behavior:**
```javascript
// OLD (deprecated): Had merge/deduplication logic
// NEW: Simple replace with no merge
localStorage.setItem(key, value);
```

**Process:**
1. File input dialog to select JSON file
2. Parse JSON
3. For each key-value pair: `localStorage.setItem(key, value)`
4. Overwrite existing data completely
5. Refresh page
6. Alert: "✅ Import complete! Your data has been restored."

**No Merge:** Ensures imported data doesn't unexpectedly combine with existing data

---

### UI Components

#### Dashboard Tabs
1. **Dashboard** - Overview with expiry alerts, widgets
2. **Stock** - Inventory list with add/edit/delete
3. **Deliveries** - Incoming shipments
4. **Movement** - Inventory transactions
5. **Expiry** - Items with expiry dates (sorted by urgency)
6. **Waste** - Discarded items
7. **Tasks** - Task management
8. **Ordering** - Supplier shortcuts (10 suppliers)
9. **Settings** - Profile, export, team management, theme

#### Key UI Elements

**⚠️ EXPIRY ALERT Widget**
- Location: Dashboard, top right
- Color: Red header with icon
- Shows: Expired count (red), Today count (orange), 7-day count (yellow)
- Clickable: Links to Expiry tab

**Expired & Expiring Soon Widget**
- Location: Dashboard, left panel
- Replaced: Old "Movements Today" placeholder
- Shows: Top 10 items with name, qty, location, days remaining
- Color-coded: Red (expired), Orange (today), Yellow (soon)

**Ordering Sidebar Dropdown**
- Location: Left sidebar under "Locations"
- Items: 10 suppliers with emoji
  1. 🥤 Coca Cola
  2. 🥤 Schweppes
  3. 🦁 Lion
  4. 🏪 Bunkers
  5. ☕ Vittoria Coffee
  6. 🍵 Dilmah Tea
  7. 📦 BidFood
  8. ☕ Santos
  9. 🌱 SpringHill Farm
  10. ✈️ Qantas Items
- Each shows "Coming Soon" banner with supplier name
- Future: External ordering links

**Team Members Section (Settings Tab)**
- For each team member:
  - Name, email, role, location
  - If Owner (emilyjreed01@gmail.com):
    - 👑 OWNER badge
    - Red border
    - "⚠️ PROTECTED" message
    - Edit/Delete buttons DISABLED
  - Edit and Delete buttons (enabled for non-owners)

**Export & Backup Section (Settings Tab)**
- Admin-only (data-admin-only attribute)
- 7 checkboxes for data categories
- "Export Selected Data" button
- "Complete Backup" button
- Non-admins see warning, buttons disabled

---

### Page Navigation
```javascript
function showTab(tabName) {
    currentPage = tabName;
    // Hide all tabs
    document.querySelectorAll('[data-page]').forEach(el => el.style.display = 'none');
    // Show selected tab
    document.querySelector(`[data-page="${tabName}"]`).style.display = 'block';
    // Update tab styling
    updateActiveTab();
}
```

---

## AUTHENTICATION & AUTHORIZATION

### Login Flow

```
┌─────────────────┐
│  User enters    │
│  email/password │
└────────┬────────┘
         │
         ↓
┌─────────────────────────┐
│  POST /api/login        │
│  (email, password)      │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│  Server:                │
│  - Find user by email   │
│  - bcrypt.compare()     │
│  - Get role, isOwner    │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │          │
    ↓          ↓
  401        200
  │          │
  │          ↓
  │      ┌─────────────────────────┐
  │      │ Return:                 │
  │      │ - role (from DB)        │
  │      │ - isOwner (from DB)     │
  │      │ - recoveryCode          │
  │      └────────┬────────────────┘
  │               │
  │               ↓
  │      ┌─────────────────────────┐
  │      │ Frontend:               │
  │      │ - localStorage.setItem  │
  │      │   ('userRole', role)    │
  │      │   ('isOwner', isOwner)  │
  │      │   ('currentUser', email)│
  │      └────────┬────────────────┘
  │               │
  │               ↓
  │      ┌─────────────────────────┐
  │      │ checkAuth() → show app  │
  │      │ initializeApp()         │
  │      └────────┬────────────────┘
  │               │
  │               ↓
  │      ┌─────────────────────────┐
  │      │ User logged in          │
  │      │ Can access app          │
  │      └─────────────────────────┘
  │
  └──→ Show error alert
```

### Registration Flow

```
┌─────────────────┐
│  User fills     │
│  registration   │
│  form           │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────┐
│  Validate:                  │
│  - Email format             │
│  - Password 8+ chars        │
│  - Password has number      │
│  - Password has uppercase   │
└────────┬────────────────────┘
         │
    ┌────┴────┐
    │          │
    ✓          ✗
    │          │
    │          └─→ Show error
    │
    ↓
┌─────────────────────────────┐
│  POST /api/register         │
│  (email, password)          │
└────────┬────────────────────┘
         │
         ↓
┌─────────────────────────────┐
│  Server:                    │
│  - bcrypt.hash(password)    │
│  - Generate 6-digit code    │
│  - INSERT users table       │
│  - role defaults to 'Staff' │
└────────┬────────────────────┘
         │
    ┌────┴────┐
    │          │
    ✓          ✗
    │          │
    │          └─→ 400 error
    │             (duplicate email)
    │
    ↓
┌─────────────────────────────┐
│  Return to Frontend:        │
│  - recoveryCode             │
│  - Show success             │
│  - Prompt login             │
└─────────────────────────────┘
```

### Admin Role Assignment Flow

```
┌─────────────────────┐
│  Existing user      │
│  (already has       │
│   account)          │
└────────┬────────────┘
         │
         ↓
┌──────────────────────────┐
│  Owner clicks "Add Admin"│
│  Selects email           │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────────────┐
│  Frontend:                       │
│  - Store in allUsers (local)     │
│  - syncAdminToBackend(email)     │
└────────┬───────────────────────────┘
         │
         ↓
┌──────────────────────────────────┐
│  POST /api/setup-admin           │
│  { email, setupKey }             │
└────────┬───────────────────────────┘
         │
         ↓
┌──────────────────────────────────┐
│  Server checks:                  │
│  - setupKey === 'ADMIN_SETUP_2024'
│  - User exists in database       │
└────────┬───────────────────────────┘
         │
    ┌────┴────┐
    │          │
    ✓          ✗
    │          │
    │          └─→ 401 error
    │
    ↓
┌──────────────────────────────────┐
│  If email is emilyjreed01@gmail: │
│  - UPDATE role='Owner'           │
│  - UPDATE isOwner=1              │
│  Else:                           │
│  - UPDATE role='Admin'           │
│  - UPDATE isOwner=0              │
└────────┬───────────────────────────┘
         │
         ↓
┌──────────────────────────────────┐
│  Return role & isOwner flag      │
└────────┬───────────────────────────┘
         │
         ↓
┌──────────────────────────────────┐
│  On next login:                  │
│  /api/login returns new role     │
│  Frontend stores in localStorage │
│  Full admin access granted       │
└──────────────────────────────────┘
```

---

## ROLE HIERARCHY & ACCESS CONTROL

### Role Definitions

| Role | Level | Capabilities |
|------|-------|--------------|
| **Owner** | 5 (Highest) | Full access to everything, cannot be removed, set as emilyjreed01@gmail.com only |
| **Admin** | 4 | Export data, backup, create users, manage team, edit all data |
| **Manager** | 3 | Edit inventory, manage deliveries (not yet fully implemented) |
| **Staff** | 2 | Basic input, view inventory, record movements |
| **Viewer** | 1 (Lowest) | Read-only access, no editing |

### Access Control Implementation

#### isAdmin() Function
Checks if user has Admin or Owner role:
```javascript
function isAdmin() {
    return isOwner === 1 || 
           currentUserRole === 'Owner' || 
           currentUserRole === 'Admin' || 
           localStorage.getItem('isOwner') === '1' ||
           localStorage.getItem('userRole') === 'Admin';
}
```

#### checkAdminAccess(actionName) Function
Gate for admin operations:
```javascript
function checkAdminAccess(actionName) {
    if (!isAdmin()) {
        alert(`${actionName} is restricted to Administrators only`);
        return false;
    }
    return true;
}
```

#### enforceAdminUI() Function
Shows/hides admin features based on role:
```javascript
// Hide admin-only elements
document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.style.display = isAdmin() ? 'block' : 'none';
});

// Disable buttons for non-admins
document.querySelectorAll('[data-admin-button]').forEach(btn => {
    btn.disabled = !isAdmin();
    btn.style.cursor = isAdmin() ? 'pointer' : 'not-allowed';
});
```

### Owner Protection

#### Database Level
- Only `emilyjreed01@gmail.com` has `isOwner=1`
- Cannot be changed via /api/setup-admin unless calling with setupKey

#### Frontend Level
- `isOwner()` function identifies Owner
- `editTeamMember()` prevents modification of Owner account
- `deleteTeamMember()` prevents deletion of Owner account
- UI shows "👑 OWNER" badge and "⚠️ PROTECTED" message
- Edit/Delete buttons disabled with visual feedback

#### Visual Protection
- Red border around Owner account card
- Red gradient background
- 👑 OWNER badge (prominent)
- Red text in messages
- Disabled buttons appear grayed out with `cursor: not-allowed`

---

## DATA FLOW & INITIALIZATION

### Page Load Sequence

```
1. Browser loads http://localhost:3000 or production URL
   ↓
2. index.html loads, all CSS/JS embedded
   ↓
3. window.onload = checkAuth()
   ↓
4a. If NOT logged in:
    - Show login form
    - Hide app
    - Wait for login click
    ↓
4b. If logged in (localStorage has 'currentUser'):
    - Hide login form
    - Show app
    - Call initializeApp()
    ↓
5. initializeApp():
   - Load profile (name, job title, email)
   - Load role from localStorage with fallback
   - Load isOwner flag
   - Update all UI displays
   - Call loadAllData() (fetch from Google Sheets)
   - Call loadTheme()
   - Call loadProfileData()
   - Call enforceAdminUI() (show/hide admin features)
   - Set auto-refresh timers
   ↓
6. loadAllData() (every 30 seconds):
   - Fetch 6 CSV files from Google Sheets
   - Parse with Papa Parse
   - Update global arrays
   - Update dashboard displays
   - Calculate expiry metrics
   ↓
7. setInterval(loadAllData, 30000)
   - Auto-refreshes inventory every 30 seconds
   ↓
8. setInterval(updateExpiryMetrics, 60000)
   - Recalculates expiry counts every minute
```

### Login to Dashboard Sequence

```
User clicks "Login"
   ↓
handleLogin()
   ├─ Validate form
   ├─ POST /api/login (email, password)
   ├─ Server responds with:
   │  ├─ role
   │  ├─ isOwner
   │  ├─ isPrimaryAdmin
   │  └─ recoveryCode
   ├─ Store in localStorage:
   │  ├─ userRole = data.role
   │  ├─ isOwner = data.isOwner
   │  ├─ isPrimaryAdmin = data.isPrimaryAdmin
   │  ├─ currentUser = email
   │  ├─ currentUserEmail = email
   │  └─ recoveryCode in user object
   ├─ checkAuth()
   │  └─ Hide login, show app
   ├─ initializeApp()
   │  ├─ Load profile data
   │  ├─ Update UI displays
   │  ├─ Load all data from Sheets
   │  ├─ Set isOwner variable
   │  ├─ Set currentUserRole variable
   │  └─ Call enforceAdminUI()
   └─ Dashboard appears
      ├─ If owner/admin: See export/backup buttons
      ├─ If manager: See edit inventory buttons
      ├─ If staff: See basic input buttons
      └─ If viewer: See read-only view
```

### Data Update Sequence (Every 30 Seconds)

```
setInterval(loadAllData, 30000)
   ↓
loadAllData()
   ├─ Fetch from Google Sheets:
   │  ├─ Inventory CSV (gid=0)
   │  ├─ Deliveries CSV (gid=549302222)
   │  ├─ Expiry CSV (gid=xxx)
   │  ├─ Movements CSV (gid=xxx)
   │  ├─ Waste CSV (gid=xxx)
   │  └─ Tasks CSV (gid=xxx)
   ├─ Parse each CSV with Papa Parse
   ├─ Store in global arrays:
   │  ├─ inventory[]
   │  ├─ expiryDates[]
   │  ├─ movements[]
   │  ├─ waste[]
   │  └─ tasks[]
   ├─ Filter by currentUserLocation
   └─ Update dashboard:
      ├─ Render current tab
      ├─ updateExpiryMetrics()
      │  └─ Calculate: expired, today, 7day, 30day counts
      └─ updateExpiryAlertWidget()
         └─ Render red/orange/yellow counts
```

### Logout Sequence

```
User clicks "Logout"
   ↓
handleLogout()
   ├─ Clear localStorage keys:
   │  ├─ currentUser
   │  ├─ currentUserEmail
   │  ├─ userRole
   │  ├─ isOwner
   │  ├─ isPrimaryAdmin
   │  └─ [others per user choice]
   ├─ Clear global variables:
   │  ├─ currentUserRole = 'Staff'
   │  ├─ isOwner = 0
   │  └─ currentUserName = ''
   ├─ Stop auto-refresh timers
   ├─ Call checkAuth()
   │  └─ checkAuth() hides app, shows login
   └─ User sees login form again
      (Profile picture disappears)
      (All data cleared)
      (Back to initial state)
```

---

## KEY FEATURES IMPLEMENTATION

### 1. Profile Persistence

**Problem Solved:** Profile picture and settings disappear after logout

**Solution - Dual Key Strategy:**

```javascript
// Save (saveProfileSettings)
localStorage.setItem('currentUserName', name);
localStorage.setItem('userName', name);
localStorage.setItem('currentUserJobTitle', title);
localStorage.setItem('userJobTitle', title);

// Load (initializeApp)
const userName = localStorage.getItem('currentUserName') || localStorage.getItem('userName');
const userJobTitle = localStorage.getItem('currentUserJobTitle') || localStorage.getItem('userJobTitle');

// Load profile picture (loadProfileData)
function loadProfileData() {
    const pic = localStorage.getItem('profilePic');
    if (pic) {
        document.getElementById('profilePicImg').src = pic;
        document.getElementById('topProfileImg').src = pic;
        document.getElementById('largeProfileImg').src = pic;
    }
}
```

**Why It Works:**
- Stores with both old and new key names
- Loads with fallback chain (tries preferred, falls back to legacy)
- Profile picture loaded immediately in initializeApp()
- Even if keys change in future, old data is still accessible

---

### 2. Export with No Merge

**Problem Solved:** Imported data merges unexpectedly with existing data

**Solution - Replace Logic:**

```javascript
// OLD (REMOVED): Merge logic
// for (let key in importedData) {
//     const existing = JSON.parse(localStorage.getItem(key));
//     const merged = deduplicate([...existing, ...importedData[key]]);
//     localStorage.setItem(key, JSON.stringify(merged));
// }

// NEW: Replace logic
function importAllData() {
    const file = document.getElementById('importFileInput').files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const data = JSON.parse(e.target.result);
        
        // Simple replace, no merge
        for (let [key, value] of Object.entries(data)) {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
        
        location.reload();
    };
}
```

**Why It Works:**
- Direct `localStorage.setItem()` overwrites existing data
- No deduplication logic
- Imported data replaces old data completely
- User gets clean state from backup

---

### 3. Admin-Only Export

**Problem Solved:** Export buttons visible/accessible to all users

**Solution - Multi-Layer Protection:**

**Layer 1: HTML Data Attribute**
```html
<div data-admin-only>
    <button onclick="exportSelectedData()">Export Selected Data</button>
    <button onclick="exportAllDataBackup()">Complete Backup</button>
</div>
```

**Layer 2: enforceAdminUI() Function**
```javascript
function enforceAdminUI() {
    document.querySelectorAll('[data-admin-only]').forEach(el => {
        el.style.display = isAdmin() ? 'block' : 'none';
    });
}
```

**Layer 3: Function-Level Check**
```javascript
function exportSelectedData() {
    if (!checkAdminAccess('Exporting data')) return;
    // ... export logic
}
```

**Why It Works:**
- Non-admins can't see export section (HTML hidden)
- Even if JS is bypassed, functions check access
- Multiple layers ensure security
- Graceful degradation

---

### 4. Ordering Dropdown with 10 Suppliers

**Implementation:**

```html
<select id="orderingSelect" onchange="showOrderingTab()">
    <option>Locations</option>
    <option value="coca-cola">🥤 Coca Cola</option>
    <option value="schweppes">🥤 Schweppes</option>
    <!-- ... 8 more suppliers -->
</select>
```

```javascript
function showOrderingTab() {
    const supplier = document.getElementById('orderingSelect').value;
    currentPage = 'ordering';
    showTab('ordering');
    
    // Show Coming Soon banner
    document.getElementById('orderingSupplierName').textContent = supplier;
    document.getElementById('orderingComing').style.display = 'block';
}
```

**Future Enhancement:**
- Add external links to supplier ordering systems
- Replace Coming Soon with actual order form
- Supplier names stored for analytics

---

### 5. Expiry Alert Widget

**Implementation:**

```javascript
// Step 1: Calculate metrics
function updateExpiryMetrics() {
    const items = expiryDates.filter(item => item.expiryDate);  // Only WITH dates
    
    const today = new Date();
    expiryMetrics = {
        expired: items.filter(item => {
            const days = calculateDaysUntilExpiry(item.expiryDate);
            return days < 0;
        }).length,
        today: items.filter(item => {
            const days = calculateDaysUntilExpiry(item.expiryDate);
            return days === 0;
        }).length,
        sevenDay: items.filter(item => {
            const days = calculateDaysUntilExpiry(item.expiryDate);
            return days > 0 && days <= 7;
        }).length,
        thirtyDay: items.filter(item => {
            const days = calculateDaysUntilExpiry(item.expiryDate);
            return days > 7 && days <= 30;
        }).length
    };
}

// Step 2: Render widget
function updateExpiryAlertWidget() {
    const widget = document.getElementById('expiryAlertWidget');
    widget.innerHTML = `
        <div style="background:#ff4444;color:white;padding:12px;border-radius:6px;margin-bottom:8px;">
            <strong>⚠️ EXPIRY ALERT</strong>
        </div>
        <div style="background:var(--bg);padding:12px;border-radius:6px;">
            <div style="margin:8px 0;"><span style="color:#ff4444;font-weight:700;">${expiryMetrics.expired} Expired</span></div>
            <div style="margin:8px 0;"><span style="color:#ff9800;font-weight:700;">${expiryMetrics.today} Expiring Today</span></div>
            <div style="margin:8px 0;"><span style="color:#ffbb33;font-weight:700;">${expiryMetrics.sevenDay} Expiring This Week</span></div>
        </div>
    `;
}
```

**Why It Works:**
- Filters for items WITH expiry dates only
- Color-coded by urgency (red → orange → yellow)
- Real-time updates every minute
- Prominent placement on dashboard

---

### 6. Owner Role Protection

**Implementation:**

```javascript
// Database: isOwner column
// Only emilyjreed01@gmail.com has isOwner=1

// Frontend: Identify owner
function isOwner() {
    return isOwner === 1 || localStorage.getItem('isOwner') === '1';
}

// Prevent editing
function editTeamMember(email) {
    if (email === 'emilyjreed01@gmail.com') {
        alert('👑 Cannot modify OWNER account.\n\nThis account has full system access and is permanently protected.');
        return;
    }
    // ... rest of edit logic
}

// Prevent deletion
function deleteTeamMember(email) {
    if (email === 'emilyjreed01@gmail.com') {
        alert('👑 Cannot delete OWNER account.\n\nThis account is the system owner and is permanently protected.');
        return;
    }
    // ... rest of delete logic
}

// UI display
const isOwnerAccount = email === 'emilyjreed01@gmail.com';
button.disabled = isOwnerAccount;
button.style.cursor = isOwnerAccount ? 'not-allowed' : 'pointer';
```

**Why It Works:**
- Hardcoded check for specific email
- Cannot be overridden by UI
- Database enforces it
- Backend validates on role change
- Multiple layers of protection

---

## GOOGLE SHEETS INTEGRATION

### Sheet Configuration

**Sheet ID:** `1N5tJAWJDXQCHLhH51npQCZJfBQ-k2C3f6U-dEhOJkuE`

**Tabs (Sheets):**
| Tab Name | GID | Purpose | Columns |
|----------|-----|---------|---------|
| Copy of Stock in Lounge | 0 | Main inventory | Item, Qty, Location, Price, etc. |
| Deliveries | 549302222 | Incoming shipments | Date, Supplier, Items, Qty, etc. |
| Expiry | [GID] | Items with expiry dates | Item, Qty, ExpiryDate, Location, etc. |
| Movements | [GID] | Inventory transactions | Date, Item, FromLoc, ToLoc, Qty, etc. |
| Waste | [GID] | Discarded items | Date, Item, Qty, Reason, etc. |
| Tasks | [GID] | Task management | Task, Assigned, DueDate, Status, etc. |
| Settings | [GID] | User data | Name, Email, Role, Location, etc. |

### CSV Export URLs

Each sheet is exported as CSV via Papa Parse:
```javascript
const inventoryUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?gid=0&format=csv`;
const deliveryUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?gid=549302222&format=csv`;
// ... etc for each GID
```

### Data Loading with Papa Parse

```javascript
function loadAllData() {
    Papa.parse(inventoryUrl, {
        header: true,
        download: true,
        complete: function(results) {
            inventory = results.data.filter(row => row.Item);  // Filter empty rows
            renderInventoryTab();
        },
        error: function(err) {
            console.error('Failed to load inventory:', err);
        }
    });
    
    // Repeat for each CSV...
}
```

### Real-Time Sync

- App fetches from Google Sheets every **30 seconds**
- No write-back to Sheets (Apps Script not configured)
- Data flows: Google Sheets → App (one-way)
- Manual edits in app persist to localStorage only
- For permanent changes: Update Google Sheet manually

### Future Enhancement: POST Sync

**Apps Script Deployment Ready:**
```javascript
// Apps Script would be deployed at APPS_SCRIPT_URL
function syncToSheet(data) {
    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data)
    }).then(response => response.json());
}
```

---

## localStorage STRUCTURE

### User & Authentication

```javascript
localStorage = {
    // Login & Identity
    'currentUser': 'emilyjreed01@gmail.com',
    'currentUserEmail': 'emilyjreed01@gmail.com',
    'currentUserName': 'Emily',
    'userName': 'Emily',  // Legacy key
    
    // Role & Access
    'userRole': 'Owner',
    'isOwner': '1',
    'isPrimaryAdmin': '1',
    
    // Profile
    'currentUserJobTitle': 'Manager',
    'userJobTitle': 'Manager',  // Legacy
    'profilePic': 'data:image/png;base64,...',
    
    // Settings
    'currentUserLocation': 'Main Store',
    'isDarkTheme': 'true'
};
```

### Inventory Data

```javascript
localStorage = {
    'inventory': '[{"id":"1","name":"Coca Cola","qty":50,...}]',
    'expiryDates': '[{"item":"Milk","qty":10,"date":"2026-08-15",...}]',
    'movements': '[{"date":"2026-07-29","item":"Stock","qty":5,...}]',
    'waste': '[{"date":"2026-07-29","item":"Spoiled Milk","qty":1,...}]',
    'tasks': '[{"task":"Clean fridge","assigned":"Emily",...}]'
};
```

### Team Management

```javascript
localStorage = {
    'allUsers': '{
        "emilyjreed01@gmail.com": {
            "name": "Emily",
            "email": "emilyjreed01@gmail.com",
            "role": "Owner",
            "location": "Main Store",
            "recoveryCode": "123456"
        },
        "admin@example.com": {
            "name": "Admin User",
            "email": "admin@example.com",
            "role": "Admin",
            "location": "Secondary",
            "recoveryCode": "654321"
        }
    }',
    'imhUsers': '{
        "user@example.com": {
            "name": "Staff Member",
            "role": "Staff",
            "recoveryCode": "999999"
        }
    }'
};
```

### Recovery & Backup

```javascript
localStorage = {
    'IMH-export-2026-07-29': '{ categories: {...} }',
    'IMH-backup-2026-07-29': '{ ...entire localStorage... }',
    'recoveryCode': '123456'
};
```

### Key Naming Convention

**Pattern:** `camelCase` with `current` prefix for active user data
- ✅ `currentUserName` (preferred)
- ⚠️ `userName` (legacy, kept for compatibility)
- ✅ `currentUserRole` (preferred)
- ⚠️ `userRole` (also valid)

**Loading Priority:**
1. Try preferred key name (`currentUserXxx`)
2. Fall back to legacy key name (`userXxx`)
3. Use default value if both missing

---

## UI COMPONENTS & DASHBOARD

### Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  Header: Logo | User Name | Profile Pic | Logout    │
├─────────────────────────────────────────────────────┤
│  Sidebar:                                            │
│  - Dashboard (icon)                                 │
│  - Stock (icon)                                     │
│  - Deliveries (icon)                                │
│  - Movement (icon)                                  │
│  - Expiry (icon)                                    │
│  - Waste (icon)                                     │
│  - Tasks (icon)                                     │
│  - Ordering (icon with dropdown)                    │
│  - Settings (icon)                                  │
│                                                      │
│  Locations dropdown                                 │
│  Theme toggle                                       │
├─────────────────────────────────────────────────────┤
│  Main Content Area:                                  │
│  ┌────────────────────────────────────────────────┐ │
│  │ Dashboard Tab (default)                        │ │
│  ├────────────────────────────────────────────────┤ │
│  │ Left Panel:                        Right Panel:│ │
│  │ - Expired & Expiring Soon Widget  │ ⚠️ EXPIRY  │ │
│  │   (top 10 items)                  │ ALERT      │ │
│  │                                   │ (counts)   │ │
│  │ - Recent Movements                │            │ │
│  │ - Tasks List                      │            │ │
│  │                                   │            │ │
│  └────────────────────────────────────────────────┘ │
│  [Stock] [Deliveries] [Expiry] [Waste] ...         │
│  ┌────────────────────────────────────────────────┐ │
│  │ Tab-specific content                           │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Component: ⚠️ EXPIRY ALERT Widget

**Location:** Dashboard, top-right panel

**Visual:**
```
┌──────────────────────────────────┐
│ ⚠️ EXPIRY ALERT                 │
├──────────────────────────────────┤
│ 🔴 3 Expired                     │
│ 🟠 1 Expiring Today              │
│ 🟡 5 Expiring This Week          │
└──────────────────────────────────┘
```

**Data Source:** `expiryMetrics` object (updated every minute)

**Clickable:** Each count links to Expiry tab with filter applied

---

### Component: Expired & Expiring Soon Widget

**Location:** Dashboard, left panel (replaced "Movements Today")

**Visual:**
```
┌──────────────────────────────────────────┐
│ Expired & Expiring Soon                 │
├──────────────────────────────────────────┤
│ 1. Milk (10) @ Main Store | -2 days 🔴  │
│ 2. Bread (5) @ Storage | 0 days 🟠      │
│ 3. Yogurt (8) @ Fridge | 3 days 🟡      │
│ ... (top 10 items)                       │
└──────────────────────────────────────────┘
```

**Data Source:** `expiryDates[]` sorted by days remaining

**Color Coding:**
- 🔴 Red: Expired (< 0 days)
- 🟠 Orange: Expiring today (0 days)
- 🟡 Yellow: Expiring within 7 days

---

### Component: Ordering Sidebar Dropdown

**Location:** Left sidebar under "Locations"

**Visual:**
```
Locations:  [All Locations ▼]

Ordering:
[Select Supplier ▼]
├─ 🥤 Coca Cola
├─ 🥤 Schweppes
├─ 🦁 Lion
├─ 🏪 Bunkers
├─ ☕ Vittoria Coffee
├─ 🍵 Dilmah Tea
├─ 📦 BidFood
├─ ☕ Santos
├─ 🌱 SpringHill Farm
└─ ✈️ Qantas Items

[Click supplier]
    ↓
Dashboard → Ordering Tab
┌─────────────────────────┐
│ Coming Soon: Coca Cola  │
│                         │
│ Supplier ordering       │
│ system launching soon!  │
└─────────────────────────┘
```

**Functionality:**
- Dropdown with 10 supplier options
- Each has emoji and label
- OnChange → Show "Coming Soon" banner with supplier name
- Future: Replace with actual external ordering links

---

### Component: Team Members Section (Settings Tab)

**Admin View:**
```
┌──────────────────────────────────────────────────────┐
│ Team Members                                          │
├──────────────────────────────────────────────────────┤
│ Name: Emily        👑 OWNER                          │
│ Email: emilyjreed01@gmail.com                        │
│ Role: 🔒 PRIMARY | Location: Main Store             │
│ ⚠️ PROTECTED - Has full access & cannot be removed  │
│ [Edit Disabled] [Delete Disabled]                   │
├──────────────────────────────────────────────────────┤
│ Name: Admin User                                     │
│ Email: admin@example.com                             │
│ Role: Admin | Location: Secondary                   │
│ [Edit] [Delete]                                      │
├──────────────────────────────────────────────────────┤
│ Name: Jane Doe                                       │
│ Email: jane@example.com                              │
│ Role: Staff | Location: Main Store                  │
│ [Edit] [Delete]                                      │
└──────────────────────────────────────────────────────┘
```

**Visual Protection for Owner:**
- Red 3px border (instead of 1px)
- Red gradient background
- 👑 OWNER badge (prominent)
- Red text in protection message
- "⚠️ PROTECTED - Has full access & cannot be removed"
- Edit/Delete buttons greyed out, disabled
- `cursor: not-allowed` on hover

---

### Component: Export & Backup Section (Settings Tab)

**Admin View:**
```
┌────────────────────────────────────────────┐
│ Export & Backup                             │
├────────────────────────────────────────────┤
│ ☑ Inventory                                 │
│ ☑ Deliveries                                │
│ ☑ Expiry                                    │
│ ☑ Movements                                 │
│ ☑ Waste                                     │
│ ☑ Tasks                                     │
│ ☑ User Settings                             │
│                                             │
│ [Export Selected Data] [Complete Backup]   │
└────────────────────────────────────────────┘
```

**Non-Admin View:**
```
┌────────────────────────────────────────────┐
│ Export & Backup                             │
├────────────────────────────────────────────┤
│ ⚠️ Admin access required to export data    │
│                                             │
│ [Export Selected Data] (disabled)          │
│ [Complete Backup] (disabled)               │
└────────────────────────────────────────────┘
```

**Buttons Behavior:**
- Admin: Blue, clickable, full width
- Non-admin: Grey, disabled, `cursor: not-allowed`

---

## DEPLOYMENT & PRODUCTION

### Deployment Architecture

```
GitHub Repository                Railway Platform
├── main branch                 ├── IMHubApp service
├── server.js                   ├── Auto-deployed from git
├── index.html                  ├── Node.js runtime
├── users.db                    ├── SQLite3 persistent volume
└── package.json                └── https://imhubapp-production.up.railway.app/
    ↑
    └─ Automatically deploys when pushed
```

### Production URL
**https://imhubapp-production.up.railway.app/**

### Deployment Process

**1. Make Changes Locally**
```bash
cd /Users/emilyreed/new
# Edit files
# Test locally: npm start (localhost:3000)
```

**2. Commit to Git**
```bash
git add -A
git commit -m "Feature description"
```

**3. Push to GitHub**
```bash
git push origin main
```

**4. Railway Auto-Deploy**
- Railway detects push to main branch
- Auto-rebuilds and deploys
- Usually takes 30-60 seconds
- No manual intervention needed

**5. Verify Deployment**
```bash
# Check if production is live
curl https://imhubapp-production.up.railway.app/ | head -1
# Should return: <!DOCTYPE html>
```

### Railway Configuration

**Service:** IMHubApp

**Environment:**
- Runtime: Node.js 18.x
- Port: 8080 (automatically mapped to HTTPS)
- Database: SQLite3 persistent volume at `/data/users.db`

**Build Command:** Automatic (npm start)

**Monitoring:**
- Railway dashboard: https://railway.com/project/32afda7d-5b9b-46e1-9310-7184088315de
- Build logs available
- Service health status

### Database Persistence

SQLite database file: `/data/users.db` (Railway persistent volume)
- Survives deployments
- Survives restarts
- Accessible to all running instances

### Rollback Procedure

If production breaks:
```bash
# Revert to previous commit
git revert HEAD
git push origin main
# Railway auto-deploys previous version
# Takes ~30-60 seconds
```

---

## TROUBLESHOOTING & RECOVERY

### Issue: User Locked Out

**Symptom:** User cannot login, forgot password

**Recovery:**
1. User goes to login page
2. Click "Forgot Password"
3. Enter email address
4. Show recovery code from registration
5. User enters recovery code + new password
6. Password reset, can login again

**Backend:** Recovery code stored in database, used for validation

### Issue: Profile Disappears After Logout

**Symptom:** Name and profile picture gone after logout

**Root Cause:** localStorage cleared, dual-key fallback failed

**Solution:**
1. Check localStorage has BOTH keys:
   - `currentUserName` AND `userName`
   - `currentUserJobTitle` AND `userJobTitle`
   - `profilePic` exists
2. Update `saveProfileSettings()` to use dual-key strategy
3. Update `loadProfileData()` to check both keys with fallback

**Prevention:**
- Always save with both old and new key names
- Load with fallback chain (preferred → legacy → default)

### Issue: Admin Access Not Granted

**Symptom:** User added as Admin, but no export button

**Root Cause:** Role not synced to database

**Solution:**
1. User must register account first via `/api/register`
2. Then admin calls `/api/setup-admin` with email
3. Backend checks:
   - User exists in database
   - setupKey is correct ('ADMIN_SETUP_2024')
   - Sets role='Admin' and syncs
4. On next login: `/api/login` returns new role
5. Frontend stores in localStorage
6. Admin features appear

**Debug:**
```bash
# Check SQLite database
sqlite3 /Users/emilyreed/new/users.db
SELECT email, role, isOwner FROM users;
```

### Issue: Owner Account Might Be Deleted

**Symptom:** Owner deleted by mistake, account locked out

**Protection Layers:**
1. **UI Layer:** Edit/Delete buttons disabled for emilyjreed01@gmail.com
   - Owner cannot be edited or deleted via interface
2. **Function Layer:** `editTeamMember()` and `deleteTeamMember()` check email
   - Prevents modification even if UI bypassed
3. **Future Enhancement:** Database-level constraint
   - Could add trigger to prevent deletion

**Recovery If Needed:**
1. Access server via SSH
2. Update database directly:
   ```sql
   UPDATE users SET role='Owner', isOwner=1 WHERE email='emilyjreed01@gmail.com';
   ```
3. User logs back in
4. Receives isOwner flag from `/api/login`

### Issue: Data Merges on Import

**Symptom:** Imported data combines unexpectedly with existing data

**Root Cause:** OLD merge logic in importAllData()

**Solution:** Replace logic (current implementation)
```javascript
// Current: Direct replace
localStorage.setItem(key, value);

// No deduplication
// No merging
// Complete replacement
```

### Issue: Google Sheets Not Updating

**Symptom:** App shows stale data, not syncing from Sheets

**Troubleshooting:**
1. Check network connection
2. Check Sheet ID is correct: `1N5tJAWJDXQCHLhH51npQCZJfBQ-k2C3f6U-dEhOJkuE`
3. Check GID parameters match sheet tabs
4. Check sheet is not private (must be publicly readable)
5. Check Papa Parse CSV URL:
   ```
   https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?gid={GID}&format=csv
   ```
6. Test CSV URL directly in browser
   - Should show CSV data, not HTML error

**Debug:**
```javascript
// In browser console
Papa.parse('https://docs.google.com/...', {
    header: true,
    download: true,
    complete: (results) => console.log(results),
    error: (err) => console.error(err)
});
```

---

## TESTING CHECKLIST

### Authentication Tests

- [ ] User can register with valid email and password
- [ ] Registration fails with weak password (< 8 chars)
- [ ] Registration fails with no number in password
- [ ] Registration fails with no uppercase in password
- [ ] User can login with correct credentials
- [ ] Login fails with wrong password
- [ ] Login fails with non-existent email
- [ ] Recovery code is generated and stored
- [ ] Recovery code displayed in Settings

### Profile & Persistence Tests

- [ ] User profile name persists after logout/login
- [ ] User profile job title persists after logout/login
- [ ] User profile picture persists after logout/login
- [ ] Profile settings save successfully
- [ ] Profile displays in header and sidebar
- [ ] Profile initials shown in avatar
- [ ] Dual-key localStorage check works (both key names)

### Role & Authorization Tests

- [ ] Owner account (emilyjreed01@gmail.com) has full access
- [ ] Admin account can access export/backup features
- [ ] Staff account cannot see export buttons
- [ ] Viewer account cannot see edit buttons
- [ ] Role persists after logout/login
- [ ] Role read from database on login
- [ ] isOwner flag set to 1 for Owner only
- [ ] isOwner flag set to 0 for all other roles

### Team Management Tests

- [ ] Admin can add new team member
- [ ] Team member appears in list after adding
- [ ] Owner account shows 👑 OWNER badge
- [ ] Owner account shows "⚠️ PROTECTED" message
- [ ] Owner Edit button is disabled
- [ ] Owner Delete button is disabled
- [ ] Edit button is greyed out for Owner
- [ ] Delete button is greyed out for Owner
- [ ] Non-owner accounts can be edited
- [ ] Non-owner accounts can be deleted
- [ ] Cannot edit Owner email
- [ ] Cannot delete Owner account
- [ ] Admin role added to database via /api/setup-admin
- [ ] Team member gets admin access on next login

### Export & Backup Tests

- [ ] Non-admin cannot see export section
- [ ] Admin can see export section
- [ ] Export buttons are disabled for non-admins
- [ ] Export buttons are enabled for admins
- [ ] Select individual data categories
- [ ] Export creates valid JSON file
- [ ] Export file has correct name format (IMH-export-DATE.json)
- [ ] Complete backup exports all data
- [ ] Backup file has correct name format (IMH-backup-DATE.json)
- [ ] Export file can be imported
- [ ] Imported data replaces (not merges) existing

### Dashboard Tests

- [ ] Dashboard loads on login
- [ ] ⚠️ EXPIRY ALERT widget displays
- [ ] Expired item count shown in red
- [ ] Today expiry count shown in orange
- [ ] 7-day expiry count shown in yellow
- [ ] Expired & Expiring Soon widget lists items
- [ ] Top 10 items displayed with name, qty, location
- [ ] Days remaining calculated correctly
- [ ] Widget is clickable (links to Expiry tab)
- [ ] Widget only shows items WITH expiry dates
- [ ] Widget updates every minute

### Ordering Tests

- [ ] Ordering dropdown appears in sidebar
- [ ] All 10 suppliers listed with emoji
- [ ] Selection shows "Coming Soon" banner
- [ ] Supplier name displayed in banner
- [ ] Clicking supplier navigates to Ordering tab
- [ ] Supplier name stored for future links

### Data Sync Tests

- [ ] Data loads from Google Sheets on startup
- [ ] Data auto-refreshes every 30 seconds
- [ ] Expiry metrics update every 60 seconds
- [ ] New entries from Sheets appear in app
- [ ] Deleted entries from Sheets disappear from app
- [ ] Location filter works correctly
- [ ] No merge/duplication when syncing

### Deployment Tests

- [ ] Code commits to GitHub successfully
- [ ] Railway auto-deploys on git push
- [ ] Production URL responds (curl test)
- [ ] Login works on production
- [ ] Admin features work on production
- [ ] Expiry alerts display on production
- [ ] Team management works on production
- [ ] Export/backup works on production
- [ ] Database persists across deployments
- [ ] Can revert to previous version

### Security Tests

- [ ] Password hashed with bcrypt (not plain text)
- [ ] Login throttled after failed attempts
- [ ] Recovery code not exposed in UI
- [ ] Admin endpoints require /api/setup-admin secret key
- [ ] Non-admins cannot call admin endpoints
- [ ] Owner account cannot be bypassed via UI
- [ ] Role flags validated on each request

### Edge Cases

- [ ] Very long names don't break UI
- [ ] Special characters in names handled
- [ ] Multiple users can login simultaneously
- [ ] Logout clears all sensitive data
- [ ] Refresh page doesn't lose data
- [ ] Offline mode (data from localStorage)
- [ ] Large exports don't crash browser
- [ ] Team member deletion doesn't break other users

---

## QUICK REFERENCE

### Key Files

| File | Location | Purpose |
|------|----------|---------|
| server.js | /Users/emilyreed/new/ | Backend Express, authentication |
| index.html | /Users/emilyreed/new/ | Frontend single-file app |
| users.db | /Users/emilyreed/new/ | SQLite database |
| package.json | /Users/emilyreed/new/ | Dependencies (express, sqlite3, bcrypt) |
| BLUEPRINT.md | /Users/emilyreed/new/ | This documentation |

### Key Commands

```bash
# Development
npm start                      # Run server on localhost:3000
curl http://localhost:3000     # Test server

# Git
git add -A                     # Stage changes
git commit -m "message"        # Commit
git push origin main           # Push to GitHub (auto-deploys)

# Database
sqlite3 /Users/emilyreed/new/users.db
SELECT * FROM users;           # View all users
UPDATE users SET role='Admin' WHERE email='...';  # Edit role

# Deployment
railway up --service IMHubApp  # Manual deploy to Railway
```

### Key URLs

- **Development:** http://localhost:3000/
- **Production:** https://imhubapp-production.up.railway.app/
- **GitHub:** https://github.com/StrauberryEmily/IMHubApp
- **Railway Dashboard:** https://railway.com/project/32afda7d-5b9b-46e1-9310-7184088315de
- **Google Sheet:** https://docs.google.com/spreadsheets/d/1N5tJAWJDXQCHLhH51npQCZJfBQ-k2C3f6U-dEhOJkuE

### Key Constants

```javascript
SHEET_ID = '1N5tJAWJDXQCHLhH51npQCZJfBQ-k2C3f6U-dEhOJkuE';
setupKey = 'ADMIN_SETUP_2024';              // /api/setup-admin secret
ownerEmail = 'emilyjreed01@gmail.com';      // Only account with isOwner=1
bcryptRounds = 10;                         // Password hash strength
autoRefreshInterval = 30000;               // Data fetch interval (ms)
expiryUpdateInterval = 60000;              // Metrics update interval (ms)
```

### Role Access Matrix

| Action | Owner | Admin | Manager | Staff | Viewer |
|--------|-------|-------|---------|-------|--------|
| View Inventory | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit Inventory | ✅ | ✅ | ✅ | ✅ | ❌ |
| Record Movement | ✅ | ✅ | ✅ | ✅ | ❌ |
| Export Data | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Backup | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign Roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Account | ✅ | ❌ | ❌ | ❌ | ❌ |
| Full System Access | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## DOCUMENT HISTORY

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-07-29 | 1.0 | Emily | Initial blueprint: Complete system documentation |

---

## NOTES FOR FUTURE DEVELOPMENT

1. **Permissions Management Tab** - Create Settings tab for managing role permissions per user
2. **External Ordering Links** - Replace "Coming Soon" with actual supplier links
3. **Apps Script Integration** - Enable write-back to Google Sheets for permanent data sync
4. **Database Constraints** - Add SQL triggers to prevent Owner account deletion
5. **Audit Logging** - Track who made what changes and when
6. **Email Notifications** - Alert on expiry items or critical events
7. **Mobile App** - React Native version for iOS/Android
8. **Two-Factor Authentication** - Add security layer for admin accounts
9. **Role Customization** - Allow custom roles with mix-and-match permissions
10. **Data Encryption** - Encrypt sensitive fields in database

---

**END OF BLUEPRINT DOCUMENT**

This document contains everything needed to understand, modify, deploy, and recreate the IMH system. Print or archive for reference.
