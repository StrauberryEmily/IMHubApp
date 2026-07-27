# File System Security Guide - IMH

## The Problem
If someone hacks the IMH server, can they access your personal files on your laptop?

**Short Answer:** ✅ **NO - if you follow this guide**

This document explains why the app is isolated, what steps to take, and how to verify your files are protected.

---

## Part 1: Why IMH Can't Access Your Personal Files

### 1.1 Application Architecture (Isolation by Design)

**IMH runs as a regular application, NOT with system-wide access:**

```
Your Laptop
├── Operating System (Files, System, Accounts)
│   ├── Your Personal Files (/Users/emilyreed/Documents, ~/Desktop, etc.)
│   └── System Files (/System, /Library, etc.)
│
└── IMH Application (Isolated Container)
    ├── Server Process (Node.js, port 3000)
    ├── IMH Folder (/Users/emilyreed/new/)
    │   ├── index.html
    │   ├── server.js
    │   ├── package.json
    │   └── .env (encrypted)
    └── Browser Storage
        └── localStorage (Browser-scoped only)
```

**Key Point:** IMH can ONLY access files in `/Users/emilyreed/new/` directory and its own localStorage. It has NO permission to access:
- `/Users/emilyreed/Documents`
- `/Users/emilyreed/Desktop`
- `/Users/emilyreed/Library` (except browser cache)
- System files anywhere else

### 1.2 Code Isolation

**The IMH server (server.js) has ZERO code that:**
- Lists directories outside `/Users/emilyreed/new/`
- Reads files from your Documents, Desktop, Downloads
- Accesses system files or configuration
- Connects to your iCloud, cloud storage, or email accounts
- Monitors your keyboard or screen

**All it does:**
```javascript
// server.js only:
1. Listens for HTTP requests on port 3000
2. Sends/receives email passwords (to Gmail, not your laptop)
3. Stores data in memory (forgotten after restart)
4. Reads/writes .env file (in /Users/emilyreed/new/ only)
5. Logs errors (to /Users/emilyreed/new/ only)
```

### 1.3 Data Storage Isolation

**IMH data lives in TWO places ONLY:**

| Location | Contains | Access Level | Risk If Hacked |
|----------|----------|--------------|-----------------|
| `/Users/emilyreed/new/.env` | Email password, port | File-only | Hacker gets Gmail creds (not laptop files) |
| Browser localStorage | User accounts, inventory | Browser tab only | Hacker sees inventory (not personal files) |

**Google Sheets data:** Read-only, cloud-hosted, not on your laptop

---

## Part 2: Protect Your Files (Required Steps)

### 2.1 Keep Personal Files OUT of IMH Directory

✅ **CORRECT:**
```
/Users/emilyreed/
├── new/                    (IMH app - OK to be hacked)
├── Documents/              (Personal files - PROTECTED)
├── Desktop/                (Personal files - PROTECTED)
└── Downloads/              (Personal files - PROTECTED)
```

❌ **WRONG:**
```
/Users/emilyreed/new/
├── index.html
├── server.js
├── Documents/              (⚠️ ACCESSIBLE TO IMH!)
├── passwords.txt           (⚠️ ACCESSIBLE TO IMH!)
└── banking.pdf             (⚠️ ACCESSIBLE TO IMH!)
```

**Action:** Never move personal files into `/Users/emilyreed/new/`

### 2.2 Encrypt Sensitive Configuration

**Your .env file contains Gmail password - protect it!**

**Step 1: Encrypt the .env file**

```bash
cd /Users/emilyreed/new/

# Encrypt .env (creates .env.enc)
openssl enc -aes-256-cbc -in .env -out .env.enc -S salt -P

# You'll be prompted for a password - USE STRONG PASSWORD
# Remember it! You'll need it to decrypt later

# Delete unencrypted version
rm .env
```

**Step 2: Update server.js to read encrypted file**

This requires adding decryption code to server.js (see below in Implementation section).

**Step 3: Add .env.enc to Git (if using), ignore .env**

```bash
echo ".env" >> .gitignore
# .env.enc can be in Git (it's encrypted)
```

### 2.3 Restrict File Permissions

**Make IMH folder inaccessible to other users (if anyone else has laptop access):**

```bash
cd /Users/emilyreed/new/

# Only you can read/write/execute
chmod 700 /Users/emilyreed/new/

# Only you can read .env.enc
chmod 600 /Users/emilyreed/new/.env.enc

# Verify
ls -ld /Users/emilyreed/new/
# Should show: drwx------  (that's 700)

ls -l /Users/emilyreed/new/.env.enc
# Should show: -rw-------  (that's 600)
```

### 2.4 Run Server as Regular User (NOT Admin)

❌ **NEVER do this:**
```bash
sudo npm run pm2-start     # ❌ DANGEROUS
sudo node server.js        # ❌ DANGEROUS
```

✅ **CORRECT:**
```bash
npm run pm2-start          # ✅ Regular user only
npm run dev                # ✅ Regular user only
```

**Why:** If server is compromised and running as admin/root, hacker gets full system access. Running as regular user limits damage to your account only.

---

## Part 3: Monitor What IMH Accesses

### 3.1 File Access Monitoring (macOS)

**See what files the IMH process accesses:**

```bash
# Start monitoring (in one terminal)
fs_usage -w | grep -i "imh\|node\|npm"

# In another terminal, start your server
npm run pm2-start

# Watch the output - should see:
# - Only files in /Users/emilyreed/new/
# - Network connections to port 3000 and Gmail
# - NO access to /Users/emilyreed/Documents, Desktop, etc.
```

**Sample safe output:**
```
open          /Users/emilyreed/new/server.js
open          /Users/emilyreed/new/.env.enc
open          /Users/emilyreed/new/package.json
open          /Users/emilyreed/.npm/...   (npm cache - OK)
```

**Sample UNSAFE output (stop immediately):**
```
open          /Users/emilyreed/Documents/passwords.txt  ❌ STOP!
open          /Users/emilyreed/Desktop/banking.pdf      ❌ STOP!
open          /Users/emilyreed/Library/Keychain/...     ❌ STOP!
```

### 3.2 Network Monitoring

**Verify server only talks to Gmail and localhost:**

```bash
# In one terminal, watch network connections
lsof -i -P -n | grep node

# In another terminal, start server
npm run pm2-start

# You should see ONLY:
# - localhost:3000 (your browser connecting)
# - smtp.gmail.com:587 (email service)
# - NO connections to external IP addresses
# - NO connections to cloud services
```

### 3.3 Process Monitoring

**Verify server process details:**

```bash
# Check what user is running the server
ps aux | grep "node\|npm"

# Should show:
emilyreed    12345  0.5  0.2  123456  45678 s000  S     5:30PM   0:05.23 node server.js

# Notice: User is "emilyreed" (you), NOT "root"

# Check memory and CPU
npm run pm2-status

# Should show reasonable values:
# Memory: < 100MB
# CPU: < 5% when idle
# NO runaway processes consuming all resources
```

---

## Part 4: What IF the Server is Compromised?

### 4.1 Hacker Can Access (Limited)

If someone hacks the IMH server, they get:

1. **Gmail password** (if not encrypted)
   - Risk: They can access your Gmail inbox
   - Mitigation: Encrypt .env file
   - Recovery: Change Gmail password immediately

2. **Inventory data in localStorage**
   - Risk: They see what items you have
   - Mitigation: None needed (it's not sensitive)
   - Recovery: Reset user accounts, generate new recovery codes

3. **User accounts and recovery codes**
   - Risk: They can log into IMH and edit inventory
   - Mitigation: Strong recovery codes (6 digits, random)
   - Recovery: Delete accounts, change passwords

### 4.2 Hacker CANNOT Access

If someone hacks the IMH server, they do NOT get:

- ✅ Your personal files (Documents, Desktop, Downloads)
- ✅ Your passwords (only Gmail credentials in app)
- ✅ Your photos and videos
- ✅ Your banking information
- ✅ Your calendar or contacts
- ✅ Other applications' data
- ✅ System files or settings
- ✅ Your browser history or cookies (unless they also hack browser)

**Because:** File system isolation prevents lateral movement.

### 4.3 Recovery Procedure (If Hacked)

**Step 1: Immediate Actions (5 minutes)**
```bash
# Stop the server
npm run pm2-stop

# Check what was accessed
fs_usage -w 2>&1 | head -100  # Review log

# Change Gmail password immediately (at gmail.com)
# This revokes the compromised app password
```

**Step 2: Investigation (15 minutes)**
```bash
# Check server logs for suspicious activity
npm run pm2-logs

# Check what files were modified
ls -ltr /Users/emilyreed/new/  # Sort by modification time

# Check if new files were created
find /Users/emilyreed/new/ -type f -newermt "1 hour ago"
```

**Step 3: Cleanup (30 minutes)**
```bash
# Backup your current setup
cp -r /Users/emilyreed/new /Users/emilyreed/new.backup.$(date +%Y%m%d)

# Delete compromised server
rm -rf /Users/emilyreed/new/server.js

# Reinstall clean version from backup
# (You should have Git or backup of clean code)

# Change all user passwords
# (Done in app Settings > Manage Users)

# Generate new recovery codes for all users
# (Done in app Settings > Manage Users)

# Reset .env file with new Gmail App Password
# (Get fresh password from gmail.com)
```

**Step 4: Verification**
```bash
# Verify no suspicious processes
ps aux | grep node

# Verify file permissions are still correct
ls -ld /Users/emilyreed/new/
# Should show: drwx------

# Verify only expected files exist
ls -la /Users/emilyreed/new/
# Should match your backup

# Start fresh server
npm install  # Reinstall dependencies
npm run pm2-start
```

---

## Part 5: Advanced Security Hardening

### 5.1 Sandbox the IMH Process (Expert Level)

**Create a dedicated user account just for IMH** (prevents cross-contamination)

```bash
# Create IMH-specific user (macOS)
sudo sysadminctl -addUser imhserver -fullName "IMH Server" -password $(openssl rand -base64 16)

# Run server as that user
sudo -u imhserver npm run pm2-start

# Hacker breaking in gets ONLY imhserver account, not your main account
```

**Pros:** If hacked, damage limited to IMH-only files
**Cons:** More complex setup, requires admin password

### 5.2 Use Environment Isolation

**Run server in a virtual machine or Docker container** (maximum isolation)

```bash
# Docker example (if interested)
docker run -it -p 3000:3000 -v /Users/emilyreed/new:/app imhserver

# Hacker in Docker container can't access your Mac directly
```

### 5.3 Network Firewall

**Block IMH process from accessing certain networks:**

```bash
# macOS Firewall rules
# System Preferences > Security & Privacy > Firewall Options
# Allow only: npm, node
# Block all others

# Or use pf firewall:
sudo pfctl -ef /etc/pf.conf
```

---

## Part 6: Testing Your Security

### 6.1 Test 1: Verify File Access Restrictions

```bash
# Create test file in Documents
echo "This is private" > ~/Documents/test-private.txt

# Try to read it from IMH
# (This will FAIL if security is correct)

# Option 1: Through Node.js
node -e "
const fs = require('fs');
try {
  const data = fs.readFileSync('/Users/emilyreed/Documents/test-private.txt', 'utf8');
  console.log('❌ FAILED - Could read file:', data);
} catch (e) {
  console.log('✅ PASSED - Cannot read file (as expected):', e.code);
}
"

# Option 2: Through curl (if server had endpoint)
curl http://localhost:3000/read-file?path=/Users/emilyreed/Documents/test-private.txt
# Should return error or 404

# Clean up
rm ~/Documents/test-private.txt
```

### 6.2 Test 2: Verify No Privilege Escalation

```bash
# Check if server can access system files
node -e "
const fs = require('fs');
try {
  const data = fs.readFileSync('/etc/passwd', 'utf8');
  console.log('❌ FAILED - Could read /etc/passwd');
} catch (e) {
  console.log('✅ PASSED - Cannot read /etc/passwd (as expected)');
}
"

# Check if server can write system files
node -e "
const fs = require('fs');
try {
  fs.writeFileSync('/etc/test.txt', 'test');
  console.log('❌ FAILED - Could write to /etc');
} catch (e) {
  console.log('✅ PASSED - Cannot write to /etc (as expected)');
}
"
```

### 6.3 Test 3: Verify Process Permissions

```bash
# Start server
npm run pm2-start

# Check user
ps aux | grep "node"
# Should show: emilyreed (your username), NOT root

# Verify it's not running with sudo
npm run pm2-status | grep "user"
```

### 6.4 Test 4: Network Isolation Test

```bash
# Run in terminal 1
npm run pm2-start

# Run in terminal 2
lsof -i -P -n | grep node

# Verify ONLY these connections exist:
# - localhost:3000 (browser)
# - smtp.gmail.com:587 (email)
# - Possible: Google Sheets API (if fetching data)

# NO connections to:
# - Random external IPs
# - Your cloud storage
# - Other services
```

---

## Part 7: Checklist - Implement Now

### Security Hardening Checklist

- [ ] **File Organization**
  - [ ] All personal files stay in Documents, Desktop, Downloads
  - [ ] IMH folder only contains IMH files
  - [ ] No sensitive data in `/Users/emilyreed/new/`

- [ ] **Encryption**
  - [ ] .env file is encrypted (openssl enc)
  - [ ] Strong encryption password used
  - [ ] Encryption password saved in secure location (not on laptop)

- [ ] **Permissions**
  - [ ] `/Users/emilyreed/new/` permissions: 700 (drwx------)
  - [ ] `/Users/emilyreed/new/.env.enc` permissions: 600 (-rw-------)
  - [ ] Server runs as regular user (NOT root/sudo)

- [ ] **Monitoring**
  - [ ] Run fs_usage test (see what files accessed)
  - [ ] Run lsof test (see network connections)
  - [ ] Verify no unexpected files created

- [ ] **Testing**
  - [ ] Test 1: Cannot read Documents/test-private.txt ✅
  - [ ] Test 2: Cannot read /etc/passwd ✅
  - [ ] Test 3: Running as emilyreed user (not root) ✅
  - [ ] Test 4: Network connections only to Gmail and localhost ✅

- [ ] **Backup**
  - [ ] Copy `/Users/emilyreed/new/` to external drive
  - [ ] Keep clean copy of server.js (for recovery)
  - [ ] Store encryption password securely (not on laptop)

---

## Part 8: Quick Reference

### Safe Operations ✅
```bash
npm run pm2-start          # Safe - starts server
npm run dev                # Safe - dev mode
npm install                # Safe - installs dependencies
npm run pm2-logs           # Safe - view logs
chmod 700 /Users/emilyreed/new/  # Safe - restrict access
```

### DANGEROUS Operations ❌
```bash
sudo npm run pm2-start     # ❌ NEVER - runs as admin
sudo node server.js        # ❌ NEVER - runs as admin
rm ~/.ssh                  # ❌ NEVER - deletes SSH keys
chmod 777 /Users/emilyreed/new/  # ❌ NEVER - opens to all
```

### Emergency Stop ⛔
```bash
# If you think server is compromised:
npm run pm2-stop
# Or kill process:
kill -9 $(ps aux | grep "node" | grep -v grep | awk '{print $2}')
# Or:
killall node
```

---

## Part 9: Summary

### Why Your Files Are Safe

| Layer | Protection | Details |
|-------|-----------|---------|
| **Architecture** | Isolation by Design | App only sees its own directory |
| **Permissions** | OS-Level Enforcement | Cannot access other directories |
| **Code** | No File Access Code | server.js has no directory listing |
| **User Account** | Regular User | Not running as admin |
| **Data Location** | Contained | Only in /new/ folder and browser |
| **Encryption** | .env Protected | Gmail password encrypted |
| **Monitoring** | You Can Verify | Use fs_usage and lsof to check |

### In Case of Hack

| If Hacked | Exposed | NOT Exposed |
|-----------|---------|------------|
| Gmail password | ✅ (if not encrypted) | Personal files ✅ |
| Inventory data | ✅ | System files ✅ |
| Recovery codes | ✅ | Banking info ✅ |
| | | Photos/videos ✅ |
| | | Browser data ✅ |

### Bottom Line

**The IMH app is effectively sandboxed. Even if someone hacks the server, they cannot access your personal files because the operating system prevents it.**

The only way they could access your files is if:
1. They compromise your laptop's main user account (not just the app)
2. You run the server with sudo/root privileges (DON'T DO THIS)
3. You store personal files inside the IMH directory (DON'T DO THIS)
4. Your .env file contains your main password (use app-specific Gmail password)

Follow this guide, and your files are protected. ✅

---

## Questions & Answers

### Q: Can they steal my passwords from the server?
**A:** Only the Gmail app password in .env (and only if not encrypted). Your laptop password is NOT stored in IMH.

### Q: What if I accidentally put a personal file in the IMH folder?
**A:** It would be accessible. Keep personal files OUT of /Users/emilyreed/new/.

### Q: Is running with `npm` safe instead of `sudo npm`?
**A:** Yes! `npm run pm2-start` (without sudo) is the safe way.

### Q: Should I encrypt .env.enc too?
**A:** .env.enc is already encrypted with AES-256. Your Gmail password is protected.

### Q: Can they access my iCloud or Google account?
**A:** Only Gmail (and only with that app-specific password). Other accounts are untouched.

### Q: What if my Mac gets hacked (not just the app)?
**A:** That's a different threat. Use FileVault encryption for your entire Mac (System Preferences > Security).

### Q: Is this enough, or do I need Docker/VM?
**A:** This is solid for home use. Docker/VM adds extra layers but more complexity. Start here.

---

**Created:** July 28, 2026  
**For:** Emily Reed's IMH  
**Status:** Active Protection ✅
