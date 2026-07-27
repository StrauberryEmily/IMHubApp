# Quick Start: Secure Your Files Right Now

## Do This Today (15 minutes)

### Step 1: Encrypt Your .env File (5 minutes)

```bash
cd /Users/emilyreed/new/

# Encrypt the file (choose a STRONG password you'll remember)
openssl enc -aes-256-cbc -in .env -out .env.enc -S salt -P

# Enter a strong password when prompted (example):
# MyStrongPass123!@# (remember this!)

# Remove the unencrypted version
rm .env

# Verify it worked
ls -la *.enc
# Should show: -rw-r--r-- .env.enc
```

**Save your encryption password:** Write it down in a safe place (NOT on your laptop)

### Step 2: Fix File Permissions (3 minutes)

```bash
# Make IMH folder only accessible to you
chmod 700 /Users/emilyreed/new/

# Make .env.enc file only readable by you
chmod 600 /Users/emilyreed/new/.env.enc

# Verify
ls -ld /Users/emilyreed/new/
# Should show: drwx------ (that's 700)

ls -l /Users/emilyreed/new/.env.enc
# Should show: -rw------- (that's 600)
```

### Step 3: Verify Your Personal Files Are Safe (3 minutes)

```bash
# Create a test file
echo "test" > ~/Documents/test-security.txt

# Try to read it from Node.js (should FAIL - that's good!)
node -e "
const fs = require('fs');
try {
  const data = fs.readFileSync('/Users/emilyreed/Documents/test-security.txt');
  console.log('❌ PROBLEM: Can read personal files!');
} catch (e) {
  console.log('✅ GOOD: Cannot read personal files (protected)');
}
"

# Clean up
rm ~/Documents/test-security.txt
```

### Step 4: Verify Server Runs as Your User (2 minutes)

```bash
# Start server
npm run pm2-start

# Check who's running it
ps aux | grep "node"

# You should see: emilyreed (your name), NOT root
# If it says "root" - STOP and contact support!

# Stop server
npm run pm2-stop
```

---

## ✅ You're Done!

Your system is now protected:
- ✅ Gmail password encrypted in .env.enc
- ✅ Folder permissions locked down (only you can access)
- ✅ Personal files isolated from the app
- ✅ Server running as regular user (not admin)

**In case of hack:** Only inventory data and Gmail creds at risk, NOT personal files.

---

## Troubleshooting

### Problem: "openssl: command not found"
```bash
# Install openssl
brew install openssl
# Then try again
```

### Problem: "Permission denied" when running chmod
```bash
# Make sure you're in the right directory
cd /Users/emilyreed/new/
pwd  # Should show /Users/emilyreed/new

# Then try chmod again
chmod 700 .
```

### Problem: "Cannot find module..." after encrypting .env
Your server.js can't decrypt .env.enc yet. See "Update server.js" below.

---

## Update Server to Use Encrypted .env

Edit `server.js` and add this at the top (before other code):

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

// Decrypt .env.enc if .env doesn't exist
if (!fs.existsSync(path.join(__dirname, '.env'))) {
    try {
        // This will prompt for password when you start server
        // Or set ENV_PASSWORD environment variable
        const envPassword = process.env.ENV_PASSWORD || '';
        if (envPassword) {
            execSync(
                `openssl enc -aes-256-cbc -d -in .env.enc -out .env -pass pass:${envPassword}`,
                { cwd: __dirname }
            );
        } else {
            console.log('\n⚠️  .env file not found and ENV_PASSWORD not set');
            console.log('Please decrypt manually:');
            console.log('  cd /Users/emilyreed/new');
            console.log('  openssl enc -aes-256-cbc -d -in .env.enc -out .env');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Failed to decrypt .env.enc:', error.message);
        process.exit(1);
    }
}
```

**Then start server with password:**
```bash
ENV_PASSWORD="YourPassword123" npm run pm2-start
```

Or decrypt manually once:
```bash
cd /Users/emilyreed/new/
openssl enc -aes-256-cbc -d -in .env.enc -out .env
# Enter password when prompted
npm run pm2-start
```

---

**Setup complete! Your files are now secured.** 🔒
