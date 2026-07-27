# IMH - Inventory Management Hub
## Complete Setup Guide with Email Password Reset

This is a secure Inventory Management System with user authentication, profile management, and password reset functionality.

---

## 📋 Table of Contents
1. [Features](#features)
2. [Installation](#installation)
3. [Frontend Setup](#frontend-setup)
4. [Backend Setup (for Email)](#backend-setup-for-email)
5. [User Guide](#user-guide)
6. [Security Notes](#security-notes)

---

## ✨ Features

### Authentication & Security
- ✅ User Registration with secure password requirements (8+ chars, 1 number, 1 uppercase)
- ✅ Login/Logout system with rate limiting (5 attempts per 15 minutes)
- ✅ Password hashing with bcrypt (military-grade encryption)
- ✅ Password strength validation
- ✅ 6-digit Recovery Code (auto-generated per user)
- ✅ Password Reset via Recovery Code
- ✅ Email notifications for password resets (optional backend)
- ✅ Email change functionality with password verification
- ✅ Password change with current password verification
- ✅ Input validation & sanitization (prevents injection attacks)
- ✅ CORS protection & security headers
- ✅ Rate limiting to prevent brute-force attacks

### User Profile
- ✅ Profile photo upload
- ✅ Cover photo upload
- ✅ Full name and job title editing
- ✅ 5 color theme selector (Pink, Purple, Green, Blue, Coral)
- ✅ Persistent theme preference

### Dashboard Features
- ✅ Local time display with dynamic greeting (Good Morning/Afternoon/Evening)
- ✅ 16-column inventory data from Google Sheets
- ✅ Click-to-edit cells with dropdown support
- ✅ Local data persistence
- ✅ Real-time inventory health metrics
- ✅ Activity log with timestamps
- ✅ Task management
- ✅ Delivery tracking
- ✅ Expiry date monitoring

### Data Management
- ✅ Integration with Google Sheets (read-only CSV export)
- ✅ Local storage for all edits
- ✅ Auto-refresh every 30 seconds
- ✅ Multiple data views (Stock, Orders, Deliveries, Expiry, Waste, Reports, Tasks)

---

## 🚀 Installation

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Node.js 14+ (for backend email functionality - optional)
- Gmail account (for email password resets - optional)

### Quick Start (Frontend Only)

1. **Open the Dashboard**
   - Simply open `index.html` in your browser
   - Create an account with your email and password
   - Log in to access the dashboard

2. **File Location**
   ```
   /Users/emilyreed/new/index.html
   ```

---

## 🖥️ Frontend Setup

The frontend is a single self-contained HTML file. No installation needed!

1. Open `index.html` in your browser
2. Create a new account or log in
3. Your data is saved locally in your browser

### Account Creation
- Email: Any email address (for account identification)
- Password: Must have 8+ characters, 1 number, 1 uppercase letter
- Role: Choose "Regular User" or "Admin"

### Features Available
- Dashboard with inventory metrics
- Profile settings with customization
- Color theme selector
- Password management
- Recovery code (save this!)

---

## 📧 Backend Setup (for Email Password Resets)

This is **optional**. You can use password resets with just the recovery code, or set up email functionality.

### Step 1: Install Dependencies

```bash
cd /Users/emilyreed/new
npm install
```

This installs:
- Express.js (web framework)
- Nodemailer (email sending)
- CORS (cross-origin requests)
- dotenv (environment variables)

### Step 2: Configure Gmail

1. Go to https://myaccount.google.com/apppasswords
2. Sign in to your Gmail account
3. Select "Mail" and "Windows Computer" (or your OS)
4. Google will generate a **16-character password** (with spaces)
5. Copy this password

### Step 3: Create .env File

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Gmail credentials:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
   PORT=3000
   ```

### Step 4: Start the Server

```bash
npm start
```

You should see:
```
IMH Password Reset Server running on http://localhost:3000
```

### Step 5: Test the Server

```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{"status":"Server is running","timestamp":"2026-07-28T..."}
```

---

## 📚 User Guide

### Creating an Account

1. Click **"Create one"** on the login page
2. Enter your **full name**
3. Enter your **email address** (used for login and password reset)
4. Create a **secure password**:
   - At least 8 characters
   - At least 1 number (0-9)
   - At least 1 uppercase letter (A-Z)
5. Confirm your password
6. Select your **role**:
   - **Regular User**: Can view inventory
   - **Admin**: Can manage inventory and place orders
7. Click **"Create Account"**

### Logging In

1. Enter your **email address**
2. Enter your **password**
3. Click **"Sign In"**

### Managing Your Account

#### View/Edit Profile
1. Click your profile in the topbar (top-right)
2. Click **"👤 Profile Settings"**
3. Update:
   - Full Name
   - Job Title
   - Profile Photo (click on the photo)
   - Cover Photo
   - Color Theme (5 options)

#### Change Email
1. Go to **Profile Settings**
2. Scroll to **Account Security**
3. Click **"Change"** next to Email Address
4. Enter your **new email** and **current password**
5. Click **"Confirm"**

#### Change Password
1. Go to **Profile Settings**
2. Scroll to **Account Security**
3. Click **"🔒 Change Password"**
4. Enter your **current password**
5. Enter your **new password** (must meet requirements)
6. Confirm the new password
7. Click **"Change Password"**

#### Save Recovery Code
1. Go to **Profile Settings**
2. Scroll to **Account Security**
3. Find your **Recovery Code** (6 digits)
4. Click **"📋 Copy"** to copy it
5. **Save it somewhere safe** (write it down, save to notes)
6. You'll need this if you forget your password

### Password Reset Process

#### Option 1: Using Recovery Code (No Internet Needed)
1. Click **"Forgot password?"** on login page
2. Enter your **email**
3. Click **"Get Recovery Code"**
4. Enter your **6-digit recovery code**
5. Enter your **new password** (must meet requirements)
6. Confirm the new password
7. Click **"Reset Password"**

#### Option 2: Using Email (Requires Backend Server)
1. Click **"Forgot password?"** on login page
2. Enter your **email**
3. Click **"Get Recovery Code"**
4. Check your **email inbox** for the recovery code
5. Enter the code and create a new password
6. Click **"Reset Password"**

### Using the Dashboard

#### Time Display
- Current local time shows in the top-left
- Greeting changes based on time:
  - 🌅 Good morning (before 12 PM)
  - ☀️ Good afternoon (12 PM - 6 PM)
  - 🌙 Good evening (after 6 PM)

#### Inventory Management
- Click on any data cell to edit it
- Changes are saved automatically to your browser
- Data persists across page reloads

#### Navigation
- Use the sidebar to navigate to different sections
- Click locations dropdown to see all areas
- Dashboard shows real-time metrics

#### Themes
- 5 color themes available
- Your choice is saved automatically
- Changes apply immediately

---

## 🔐 Security & Privacy (v2.0 Enhanced)

### ✅ Security Improvements
- **Rate Limiting**: Maximum 5 login attempts per 15 minutes (prevents brute-force)
- **Bcrypt Hashing**: Military-grade password encryption
- **Input Validation**: All data sanitized to prevent injection attacks
- **CORS Protection**: Server only accepts requests from trusted sources
- **Security Headers**: Prevents clickjacking, XSS, and MIME sniffing attacks
- **Timeout Protection**: Password reset tokens expire after 1 hour

### Data Storage
- All user data stored in **browser's local storage** (your device)
- Data is NOT sent to external servers (except email password reset emails)
- Each browser/device has separate user accounts
- Recovery codes stored securely in your account

### Password Security
- **Requirements**: 8+ characters, 1 number, 1 uppercase letter
- **Hashing**: bcrypt with salt (cryptographically secure)
- **Verification**: Current password required to change email or password
- **Recovery**: 6-digit recovery codes (unique per user)

### Recovery Code Security
- ⚠️ **SAVE IMMEDIATELY**: Copy and store in safe place
- Never shared via email or API responses
- Unique to your account
- Required for password reset if you forget

### What We Protect
✅ Passwords - Hashed with bcrypt
✅ Emails - Validated and sanitized
✅ Recovery codes - Secure generation
✅ Sessions - Rate-limited authentication
✅ Data - Input validation on all fields

### What You Control
- Your password (8+ chars, 1 number, 1 uppercase)
- Your profile information
- Your theme preferences
- Your recovery code location

### Email Security (Backend Only)
- Emails sent via Gmail's secure SMTP
- Password reset links expire after 1 hour
- No passwords ever sent via email
- Recovery codes sent in email for reference only

### What We DON'T Collect
- ❌ Credit card information
- ❌ Location data
- ❌ Browsing history
- ❌ Unnecessary personal information
- ❌ Marketing data

### Production Deployment
For production use, we recommend:
1. ✅ Already implemented: Bcrypt, rate limiting, input validation
2. Consider adding: Database encryption, 2-factor authentication
3. Deploy with: HTTPS/SSL certificate (required)
4. Monitor: Failed login attempts, suspicious activity

### For Complete Security Details
See [SECURITY.md](SECURITY.md) - Comprehensive security guide
See [SECURITY-CHECKLIST.md](SECURITY-CHECKLIST.md) - Setup & maintenance checklist

---

## 🔧 Troubleshooting

### Forgot Your Password?
- Use your **6-digit recovery code** to reset it
- If you don't have your code, contact your administrator

### Email Not Working?
1. Check that the backend server is running: `npm start`
2. Verify `.env` file has correct Gmail credentials
3. Check that your Gmail account has App Passwords enabled
4. Wait 30 seconds and try again (rate limiting)

### Can't Log In?
- Verify your **email** and **password** are correct
- Check for typos in your email address
- Try resetting your password using the recovery code

### Theme Not Saving?
- Check that browser cookies/local storage are enabled
- Try clearing browser cache and logging in again

### Data Not Persisting?
- Enable local storage in your browser settings
- Check that you have enough disk space
- Try using a different browser

---

## 📞 Support

For issues or feature requests, check your system:

### Health Check Command
```bash
curl http://localhost:3000/api/health
```

If server is running, you'll see the status.

---

## 📝 File Structure

```
/Users/emilyreed/new/
├── index.html              # Main dashboard (single file)
├── server.js               # Backend for email (optional)
├── package.json            # Node dependencies
├── .env.example            # Email configuration template
└── README.md               # This file
```

---

## 🎉 You're All Set!

Your IMH Dashboard is now:
- ✅ Fully functional with authentication
- ✅ Ready for data management
- ✅ Optionally set up for email password resets
- ✅ Secure with password requirements
- ✅ Customizable with themes and profiles

**Open `index.html` in your browser and start managing your inventory!**

---

## Version History

- **v1.0.0** - Initial release with authentication, profiles, and email support
