# 💾 Backup & Disaster Recovery Plan

## Why Backups Matter

Ransomware, accidental deletion, or hardware failure could cause data loss. **Backups are your insurance policy.**

---

## 📊 What to Backup

### 1. **User Accounts** (Critical)
- Location: Browser localStorage
- Contains: Names, emails, hashed passwords, recovery codes
- Backup: Export JSON monthly

### 2. **Inventory Data** (Critical)
- Location: Google Sheets (automatic backup)
- Contains: All 59 inventory items
- Backup: Already backed up by Google

### 3. **Configuration Files** (Important)
- Location: `.env` file
- Contains: Gmail credentials, API keys
- **⚠️ NEVER commit to version control**

### 4. **Server Files** (Important)
- Location: `server.js`, `package.json`, `index.html`
- Contains: Application code
- Backup: Use Git repository

### 5. **Logs** (Useful)
- Location: PM2 logs
- Contains: All server activity
- Backup: Archive monthly

---

## 🔄 Backup Schedule

### Daily
```bash
# Take a screenshot of important metrics
# Manual: Daily notes of critical data changes
```

### Weekly
```bash
# Export user list
# Backup server logs
# Test recovery procedure
```

### Monthly
```bash
# Full system backup
# Test restore from backup
# Update backup documentation
# Review for completeness
```

### Quarterly
```bash
# Full disaster recovery drill
# Train team on recovery
# Update recovery procedures
# Review security
```

---

## 📥 Backup Procedures

### Backup 1: Export User Accounts

**Step 1: Access Browser Developer Tools**
```
Mac: Cmd+Option+I
Open: Console tab
```

**Step 2: Export User Data**
```javascript
// In browser console, run:
const users = JSON.parse(localStorage.getItem('imhUsers'));
const dataStr = JSON.stringify(users, null, 2);
console.log(dataStr);
// Copy the output

// Or save to file:
const dataBlob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(dataBlob);
const a = document.createElement('a');
a.href = url;
a.download = `imh-users-backup-${new Date().toISOString().split('T')[0]}.json`;
a.click();
```

**Step 3: Store Safely**
- Save to secure cloud (Dropbox, Google Drive - encrypted)
- Keep local copy
- Label with date
- Store .env file separately

### Backup 2: Export Inventory (Google Sheets)

**Step 1: Open Google Sheet**
- Go to: Stock List sheet

**Step 2: Download as CSV**
- Click: File > Download > CSV
- Save: `inventory-backup-YYYY-MM-DD.csv`

**Step 3: Create Multiple Copies**
```bash
# Organized backup folder
~/IMH-Backups/
├── users/
│   ├── users-2026-07-28.json
│   └── users-2026-07-21.json
├── inventory/
│   ├── inventory-2026-07-28.csv
│   └── inventory-2026-07-21.csv
└── config/
    └── .env.encrypted
```

### Backup 3: Code Backup (Git)

**Step 1: Initialize Git (if not done)**
```bash
cd /Users/emilyreed/new
git init
git add .
git commit -m "Initial commit: IMH v2.0-secure"
```

**Step 2: Create Remote Backup (GitHub)**
```bash
# Create repository on GitHub (private)
# Then:
git remote add origin https://github.com/YOUR-USER/imh-backup.git
git push -u origin main

# Now all code is backed up on GitHub
```

**Step 3: Verify Backup**
```bash
git status  # Should show "up to date"
git log     # Should show commit history
```

### Backup 4: Server Configuration

**Step 1: Backup .env File (Encrypted!)**
```bash
# Create encrypted backup
# Option 1: Use macOS Keychain
security add-generic-password -a imh-env -s "IMH .env" -w "$(cat .env)"

# Option 2: Print for safe storage
cat .env
# Then print and store in safe
```

**Step 2: Document Server Setup**
```bash
# Create setup documentation
cat > /Users/emilyreed/IMH-Backups/SERVER-SETUP.txt << 'EOF'
IMH SERVER SETUP GUIDE
======================

1. Install Node.js (v16+)
2. Run: npm install
3. Create .env file with:
   - EMAIL_USER=your-gmail
   - EMAIL_PASSWORD=app-password
   - PORT=3000
4. Start: npm run pm2-start
5. Verify: npm run pm2-status

Critical Files:
- server.js
- index.html
- package.json
- .env (NEVER commit to Git!)

Passwords/Codes:
- Admin email: emilyjreed01@gmail.com
- Admin password: [STORED SEPARATELY]
- Recovery codes: [STORED IN SAFE]
EOF
```

### Backup 5: PM2 State

**Step 1: Save PM2 State**
```bash
pm2 save
```

**Step 2: Backup PM2 Config**
```bash
cp ~/.pm2/dump.pm2 ~/IMH-Backups/pm2-dump.pm2
```

---

## 🔄 Recovery Procedures

### Scenario 1: User Accidentally Deletes Account

**Step 1: Check Backup**
```javascript
// Load user from backup JSON file
const backupUsers = [YOUR BACKUP JSON];
const deletedUser = backupUsers['email@example.com'];
```

**Step 2: Restore User**
```javascript
// In browser console:
const users = JSON.parse(localStorage.getItem('imhUsers'));
users['email@example.com'] = deletedUser;
localStorage.setItem('imhUsers', JSON.stringify(users));
```

**Step 3: Verify**
- User can log in with old password
- All data restored

### Scenario 2: Inventory Data Corrupted

**Step 1: Check Google Sheets (Primary Backup)**
- Google Sheets has version history
- Right-click: "Show version history"
- Restore previous version

**Step 2: If Google Sheets also Corrupted**
- Download backup CSV from computer
- Re-upload data to Google Sheets
- System reads from CSV

**Step 3: Sync Data**
```
1. Open IMH app
2. Wait 30 seconds for auto-refresh
3. All data restored from backup
```

### Scenario 3: Server Won't Start

**Step 1: Check Error Logs**
```bash
npm run pm2-logs
# Look for error messages
```

**Step 2: Restore from Code Backup**
```bash
# Check Git history
git log

# Revert to last known good version
git reset --hard HEAD~1

# Try starting again
npm run pm2-start
```

**Step 3: Restore from File Backup**
```bash
# If Git doesn't work, restore from file
cp ~/IMH-Backups/server.js ./server.js
npm install
npm run pm2-start
```

### Scenario 4: Complete System Failure

**Step 1: Recover Files**
```bash
# Restore entire project from backup
cp -r ~/IMH-Backups/imh-complete/ /Users/emilyreed/new/
```

**Step 2: Reinstall Dependencies**
```bash
cd /Users/emilyreed/new
npm install
```

**Step 3: Restore Configuration**
```bash
# Restore .env from secure location
# (Stored separately from other files)
nano .env
# Paste saved credentials
```

**Step 4: Restore User Data**
```javascript
// In browser console:
const backup = [LOAD FROM BACKUP JSON];
localStorage.setItem('imhUsers', JSON.stringify(backup));
```

**Step 5: Restart Server**
```bash
npm run pm2-start
npm run pm2-status
```

---

## 🗄️ Storage Options

### Option 1: Local Computer
**Pros:**
- ✅ Easy to access
- ✅ Full control
- ✅ No internet needed

**Cons:**
- ❌ If computer fails, backups gone
- ❌ Not fire-proof

**Use for:**
- Secondary backup
- Working copies

### Option 2: External Hard Drive
**Pros:**
- ✅ Portable
- ✅ Large capacity
- ✅ Encrypted options

**Cons:**
- ❌ Can fail
- ❌ Can be lost/stolen

**Use for:**
- Weekly backups
- Off-site storage

**Setup:**
```bash
# Mount external drive
# Copy backups
cp -r ~/IMH-Backups /Volumes/ExternalDrive/

# Eject drive
# Store in safe location
```

### Option 3: Cloud Storage (Encrypted)
**Pros:**
- ✅ Always available
- ✅ Multiple locations
- ✅ Version history
- ✅ Can encrypt

**Cons:**
- ⚠️ Internet dependent
- ⚠️ Trust cloud provider

**Use for:**
- Primary backup
- Easy recovery

**Setup:**
```bash
# Option A: Google Drive (personal)
# Create folder: "IMH Backups"
# Upload: users.json, inventory.csv, .env (encrypted)

# Option B: Dropbox
# Create folder: "IMH Backups"
# Enable file versioning
# Upload backup files

# Option C: ProtonDrive (encrypted)
# Maximum privacy option
# End-to-end encryption built-in
```

---

## 🔐 Encryption for Sensitive Backups

### Encrypt .env File

**Step 1: Create Encrypted Copy**
```bash
# Using OpenSSL (built into Mac)
openssl enc -aes-256-cbc -salt -in .env -out .env.encrypted

# You'll be prompted for password
# Enter secure password (different from everything else)
```

**Step 2: Store Encrypted File**
```bash
# Now safe to upload to cloud
cp .env.encrypted ~/IMH-Backups/
# Upload to Google Drive or Dropbox
```

**Step 3: Decrypt When Needed**
```bash
openssl enc -aes-256-cbc -d -in .env.encrypted -out .env.recovered
# Enter the password you set
# Now you have .env file
```

---

## ✅ Backup Verification Checklist

### Weekly Verification
- [ ] Backup file exists
- [ ] File size seems reasonable
- [ ] Recently modified timestamp
- [ ] Can read the backup

### Monthly Verification
- [ ] Test restore process
- [ ] Verify data is readable
- [ ] Check for completeness
- [ ] Update documentation

### Quarterly Verification
- [ ] Full disaster recovery drill
- [ ] Test all 5 backup types
- [ ] Measure recovery time
- [ ] Train team members

---

## 📋 Backup Checklist Template

```markdown
# IMH Backup Checklist - [DATE]

## Daily
- [ ] System running normally
- [ ] No error messages
- [ ] Inventory data accessible

## Weekly
- [ ] Users exported to JSON
  - [ ] File named: users-YYYY-MM-DD.json
  - [ ] Verified: Can open and read
  - [ ] Stored: ~/IMH-Backups/users/
  
- [ ] Inventory CSV downloaded
  - [ ] From: Google Sheets
  - [ ] File named: inventory-YYYY-MM-DD.csv
  - [ ] Verified: All items present
  - [ ] Stored: ~/IMH-Backups/inventory/
  
- [ ] Server logs reviewed
  - [ ] No errors or warnings
  - [ ] No suspicious activity
  - [ ] Stored: ~/IMH-Backups/logs/

## Monthly
- [ ] Full backup created
  - [ ] Users: ✓
  - [ ] Inventory: ✓
  - [ ] Code: ✓
  - [ ] Config: ✓
  
- [ ] Test recovery
  - [ ] Restore from users backup: ✓
  - [ ] Restore from inventory CSV: ✓
  - [ ] Restore code from Git: ✓
  - [ ] Recovery time: ___ minutes
  
- [ ] Document any issues
  - [ ] Issues found: ___
  - [ ] Fixes applied: ___
  - [ ] Procedures updated: ✓

## Notes
[Any additional notes or observations]
```

---

## 🆘 Recovery Time Objectives (RTO)

Target recovery times:

```
Scenario                          RTO        Process
────────────────────────────────────────────────────
Single file corruption           < 10 min    Restore from backup
User data loss                   < 30 min    Import users JSON
Server crash                     < 2 min     PM2 auto-restart
Full system failure              < 1 hour    Complete restore
ransomware infection             < 2 hours   Restore clean system
```

---

## 🎯 Summary

Your backup strategy should be:

1. **Google Sheets** - Primary inventory backup (automatic)
2. **Browser localStorage** - User data (daily export)
3. **Local computer** - Configuration files
4. **Git repository** - Code version control
5. **External drive** - Off-site backup (monthly)
6. **Cloud storage** - Redundant backup (encrypted)

**Recovery plan:**
- Test monthly
- Document procedures
- Train team members
- Keep backups secure

**Result:** Even if disaster strikes, you can recover in hours, not days! 💪

---

**See also:** RANSOMWARE-PROTECTION.md, SECURITY.md
