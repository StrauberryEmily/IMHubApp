# 📥 Node.js Installation Guide

## Why Node.js?
The backend server for email password reset requires Node.js. It provides:
- Secure password hashing (bcrypt)
- Email sending (Nodemailer)
- Rate limiting (prevents brute-force attacks)
- Input validation & sanitization

---

## Installation

### Option 1: Using Homebrew (Recommended for Mac)

1. **Install Homebrew** (if you don't have it):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Node.js:**
   ```bash
   brew install node
   ```

3. **Verify installation:**
   ```bash
   node -v    # Should show v18.x.x or higher
   npm -v     # Should show 9.x.x or higher
   ```

### Option 2: Direct Download from nodejs.org

1. Visit https://nodejs.org
2. Download **LTS (Long-Term Support)** version
3. Run the installer
4. Follow the installation wizard
5. Verify:
   ```bash
   node -v
   npm -v
   ```

### Option 3: Using nvm (Node Version Manager)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js LTS
nvm install --lts

# Use the installed version
nvm use --lts

# Verify
node -v
npm -v
```

---

## After Installation

### 1. Navigate to Your Project
```bash
cd /Users/emilyreed/new
```

### 2. Install Dependencies
```bash
npm install
```

This installs:
- `express` - Web server framework
- `nodemailer` - Email sending
- `bcrypt` - Password hashing (✨ NEW - Security!)
- `express-rate-limit` - Brute-force protection (✨ NEW - Security!)
- `cors` - Cross-origin protection
- `dotenv` - Environment variables

### 3. Create .env File
```bash
cp .env.example .env
```

Edit `.env` and add:
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
PORT=3000
```

### 4. Start the Server
```bash
npm start
```

Should show:
```
🔒 IMH Server running securely on port 3000
📧 Email service configured: YES
⚙️  Rate limiting enabled for login and password reset
```

---

## Troubleshooting

### "npm: command not found"
- Node.js isn't installed yet
- Follow the installation steps above

### "Port 3000 already in use"
```bash
# Use a different port
PORT=3001 npm start

# Or kill the process using port 3000
lsof -i :3000
kill -9 <PID>
```

### "bcrypt installation failed"
- This requires compiling native code
- Make sure you have Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```
- Then run: `npm install` again

### Slow npm install
- This is normal for bcrypt (compiling native code)
- Wait 2-5 minutes for it to complete
- Don't interrupt the process

---

## Version Check

```bash
# Check Node.js version
node -v

# Check npm version
npm -v

# Check installed packages
npm list
```

---

## Updating Dependencies

Every month, update your dependencies:

```bash
cd /Users/emilyreed/new

# Update all packages
npm update

# Check for security issues
npm audit

# Fix security issues automatically
npm audit fix
```

---

## Uninstalling (if needed)

### Mac with Homebrew
```bash
brew uninstall node
```

### Mac with .pkg installer
1. Open System Information
2. Find and uninstall Node.js
3. Delete npm: `sudo rm -rf /usr/local/lib/node_modules/`

---

## Quick Reference

```bash
# Start server
npm start

# Development (with auto-restart)
npm run dev

# Install a package
npm install package-name

# Check for updates
npm outdated

# Update everything
npm update

# List installed packages
npm list

# Run security audit
npm audit
```

---

**Need Help?** Check these resources:
- https://nodejs.org/en/docs/
- https://docs.npmjs.com/
- Server logs in terminal for errors
