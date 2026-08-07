const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// ============= ENCRYPTION HANDLING =============
// Decrypt .env.enc if .env doesn't exist
const envPath = path.join(__dirname, '.env');
const encEnvPath = path.join(__dirname, '.env.enc');

if (!fs.existsSync(envPath) && fs.existsSync(encEnvPath)) {
    try {
        const envPassword = process.env.ENV_PASSWORD;
        if (!envPassword) {
            console.error('\n❌ ERROR: .env.enc found but ENV_PASSWORD not set');
            console.error('To decrypt, run one of these:');
            console.error('  Option 1: ENV_PASSWORD="YourPassword" npm run pm2-start');
            console.error('  Option 2: Decrypt manually first:');
            console.error('    openssl enc -aes-256-cbc -d -in .env.enc -out .env');
            process.exit(1);
        }
        
        // Decrypt using openssl
        const result = spawnSync('openssl', [
            'enc', '-aes-256-cbc', '-d', 
            '-in', encEnvPath, 
            '-out', envPath,
            '-pass', `pass:${envPassword}`
        ], { encoding: 'utf8' });
        
        if (result.error || result.status !== 0) {
            console.error('❌ Decryption failed. Check your password.');
            process.exit(1);
        }
        
        console.log('✅ Successfully decrypted .env.enc');
    } catch (error) {
        console.error('❌ Failed to decrypt .env.enc:', error.message);
        process.exit(1);
    }
}

require('dotenv').config();

const app = express();

// Security middleware - strict CORS (only allow your app domain)
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'file://',  // for local file:// development
    'https://imhubapp-production.up.railway.app',
    process.env.APP_URL || 'http://localhost:3000'
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security headers with Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["*"],
            scriptSrc: ["*", "'unsafe-inline'"],
            styleSrc: ["*", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["*", "data:"],
            connectSrc: ["*"],
            mediaSrc: ["*"],
            frameSrc: ["*"],
        },
    },
}));

// Additional security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

app.use(bodyParser.json({ limit: '10mb' }));

// Rate limiting - prevent brute force attacks
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many login attempts. Please try again in 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
});

const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: 'Too many password reset requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Password validation function
function validatePassword(password) {
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasMinLength = password.length >= 8;
    return hasUpper && hasNumber && hasMinLength;
}

// ============= DATABASE INITIALIZATION =============
const OWNER_EMAIL = 'emilyjreed01@gmail.com';
const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err);
        process.exit(1);
    }
    console.log('✅ Database connected at', dbPath);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        recoveryCode TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => { if (err) console.error('users table error:', err); });

    db.run(`CREATE TABLE IF NOT EXISTS approved_emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        approvedBy TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => { if (err) console.error('approved_emails table error:', err); });

    db.run(`CREATE TABLE IF NOT EXISTS signup_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        fullName TEXT,
        attemptCount INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending',
        lastError TEXT,
        lastAttemptAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => { if (err) console.error('signup_attempts table error:', err); });

    db.run(`CREATE TABLE IF NOT EXISTS recovery_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        recoveryCode TEXT NOT NULL,
        expiresAt DATETIME NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email) REFERENCES users(email)
    )`, (err) => { if (err) console.error('recovery_tokens table error:', err); });

    // Seed owner account if OWNER_PASSWORD env var is set and account doesn't exist
    const ownerPassword = process.env.OWNER_PASSWORD;
    if (ownerPassword) {
        db.get('SELECT id FROM users WHERE email = ?', [OWNER_EMAIL], async (err, row) => {
            if (!row) {
                const hash = await bcrypt.hash(ownerPassword, 10);
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                db.run('INSERT INTO users (email, passwordHash, recoveryCode) VALUES (?, ?, ?)',
                    [OWNER_EMAIL, hash, code],
                    (e) => { if (!e) console.log('✅ Owner account seeded'); });
                db.run('INSERT OR IGNORE INTO approved_emails (email, approvedBy) VALUES (?, ?)',
                    [OWNER_EMAIL, 'system'], () => {});
            }
        });
    }
});
// Email sending via Resend API (SMTP is blocked by most cloud hosts)
async function sendEmail({ to, from, replyTo, subject, html }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not set in environment variables');

    const payload = { from, to, reply_to: replyTo, subject, html };
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || JSON.stringify(data));
    return data;
}

// Generate a random reset token
function generateResetToken() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Endpoint to send password reset email
app.post('/api/send-reset-email', emailLimiter, async (req, res) => {
    const email = sanitizeInput(req.body.email || '').toLowerCase();
    const recoveryCode = sanitizeInput(req.body.recoveryCode || '');

    // Validation
    if (!email || !recoveryCode || !/^[0-9]{6}$/.test(recoveryCode)) {
        return res.status(400).json({ error: 'Invalid email or recovery code format' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    try {
        // Generate a reset token that expires in 1 hour
        const resetToken = require('crypto').randomBytes(32).toString('hex');
        const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour

        // Store the token temporarily (do NOT store recovery code here for security)
        passwordResetTokens[resetToken] = {
            email: email,
            expiresAt: expiresAt
        };

        // Email HTML template (recovery code displayed below)
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; background: #f5f5f5; }
                    .container { background: white; max-width: 500px; margin: 20px auto; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .header { color: #ff4d94; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
                    .content { color: #333; line-height: 1.6; }
                    .code-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 3px; text-align: center; color: #856404; }
                    .button { background: #ff4d94; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
                    .warning { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; color: #721c24; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">◇ IMH Password Reset</div>
                    
                    <div class="content">
                        <p>Hello,</p>
                        <p>We received a request to reset your password for your IMH Inventory Management Hub account.</p>
                        
                        <p><strong>Your 6-Digit Recovery Code:</strong></p>
                        <div class="code-box">${recoveryCode}</div>
                        
                        <p><strong>⚠️ Security Warning:</strong> Never share this code with anyone. IMH staff will never ask for it.</p>
                        
                        <p>This code will expire in 1 hour. If you didn't request this, ignore this email and your account remains secure.</p>
                        
                        <p><strong>Steps to reset your password:</strong></p>
                        <ol>
                            <li>Open IMH Dashboard</li>
                            <li>Click "Forgot password?" on login</li>
                            <li>Enter your email</li>
                            <li>Enter this recovery code</li>
                            <li>Create a new password (8+ chars, 1 number, 1 uppercase)</li>
                        </ol>
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated security email. Do not reply to this message.</p>
                        <p>IMH Inventory Management Hub • Password Reset</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Send email
        await transporter.sendMail({
            from: process.env.EMAIL_USER || 'noreply@imh.com',
            to: email,
            subject: '🔒 IMH Password Reset - Recovery Code Inside',
            html: htmlContent
        });

        res.json({ 
            success: true, 
            message: 'Password reset email sent! Check your inbox for the recovery code.',
            resetToken: resetToken 
        });

    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: 'Failed to send email. Server error.' });
    }
});

// Endpoint to verify reset token
app.post('/api/verify-reset-token', (req, res) => {
    const { token } = req.body;

    if (!token || !passwordResetTokens[token]) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const resetData = passwordResetTokens[token];
    
    // Check if token has expired
    if (Date.now() > resetData.expiresAt) {
        delete passwordResetTokens[token];
        return res.status(400).json({ error: 'Reset token has expired. Request a new one.' });
    }

    res.json({ 
        success: true, 
        email: resetData.email,
        token: token
    });
});

// ============= AUTHENTICATION ENDPOINTS =============

// Helper to sanitize input
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>\"']/g, '');
}

function generateRecoveryCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Verify owner credentials (used by approval endpoints)
async function verifyOwner(requesterEmail, requesterPassword) {
    return new Promise((resolve) => {
        if ((requesterEmail || '').toLowerCase() !== OWNER_EMAIL) return resolve(false);
        db.get('SELECT passwordHash FROM users WHERE email = ?', [OWNER_EMAIL], async (err, row) => {
            if (err || !row) return resolve(false);
            const ok = await bcrypt.compare(requesterPassword || '', row.passwordHash);
            resolve(ok);
        });
    });
}

// User Registration — requires pre-approved email (owner is always allowed)
app.post('/api/register', loginLimiter, async (req, res) => {
    try {
        const email = sanitizeInput(req.body.email || '').toLowerCase();
        const password = req.body.password || '';
        const fullName = sanitizeInput(req.body.fullName || '');

        if (!email || !password || !fullName) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        if (password.length < 8 || !/\d/.test(password) || !/[A-Z]/.test(password)) {
            return res.status(400).json({ error: 'Password must be 8+ characters with 1 number and 1 uppercase letter' });
        }

        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existing) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (existing) return res.status(400).json({ error: 'Email already registered' });

            // Owner always allowed; everyone else needs pre-approval
            if (email !== OWNER_EMAIL) {
                const approved = await new Promise((resolve) => {
                    db.get('SELECT id FROM approved_emails WHERE email = ?', [email], (e, row) => resolve(!!row));
                });
                if (!approved) {
                    // Log the attempt
                    db.run(`INSERT INTO signup_attempts (email, fullName, attemptCount, status, lastError, lastAttemptAt)
                        VALUES (?, ?, 1, 'pending', 'Not pre-approved', CURRENT_TIMESTAMP)
                        ON CONFLICT(email) DO UPDATE SET
                            attemptCount = attemptCount + 1,
                            fullName = excluded.fullName,
                            lastAttemptAt = CURRENT_TIMESTAMP`,
                        [email, fullName], () => {});
                    return res.status(403).json({ error: 'This email has not been approved for registration. Contact the owner.' });
                }
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const recoveryCode = generateRecoveryCode();

            db.run('INSERT INTO users (email, passwordHash, recoveryCode) VALUES (?, ?, ?)',
                [email, passwordHash, recoveryCode],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Failed to create account' });
                    // Mark attempt as registered if exists
                    db.run("UPDATE signup_attempts SET status='registered' WHERE email=?", [email], () => {});
                    res.json({
                        success: true,
                        message: 'Account created successfully',
                        recoveryCode: recoveryCode,
                        email: email,
                        fullName: fullName
                    });
                }
            );
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User Login
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const email = sanitizeInput(req.body.email || '').toLowerCase();
        const password = req.body.password || '';

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Find user in database
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!user) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            // Verify password
            const passwordMatch = await bcrypt.compare(password, user.passwordHash);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            // Login successful
            res.json({
                success: true,
                message: 'Login successful',
                email: user.email,
                recoveryCode: user.recoveryCode.toString()
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Start password recovery - verify email exists and return hint
app.post('/api/password-recovery/start', loginLimiter, (req, res) => {
    const email = sanitizeInput(req.body.email || '').toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    db.get('SELECT email FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'No account found with that email' });
        res.json({ success: true, message: 'Enter your 6-digit recovery code to reset your password.' });
    });
});

// Reset password using recovery code
app.post('/api/password-recovery/reset', loginLimiter, async (req, res) => {
    const email = sanitizeInput(req.body.email || '').toLowerCase();
    const recoveryCode = sanitizeInput(req.body.recoveryCode || '');
    const newPassword = req.body.newPassword || '';

    if (!email || !recoveryCode || !newPassword) {
        return res.status(400).json({ error: 'Email, recovery code, and new password are required' });
    }
    if (!/^[0-9]{6}$/.test(recoveryCode)) {
        return res.status(400).json({ error: 'Recovery code must be 6 digits' });
    }
    if (newPassword.length < 8 || !/\d/.test(newPassword) || !/[A-Z]/.test(newPassword)) {
        return res.status(400).json({ error: 'Password must be 8+ characters with 1 number and 1 uppercase letter' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'No account found with that email' });
        if (String(user.recoveryCode) !== String(recoveryCode)) {
            return res.status(401).json({ error: 'Invalid recovery code' });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        const newRecoveryCode = Math.floor(100000 + Math.random() * 900000).toString();

        db.run('UPDATE users SET passwordHash = ?, recoveryCode = ? WHERE email = ?',
            [newHash, newRecoveryCode, email],
            (err) => {
                if (err) return res.status(500).json({ error: 'Failed to reset password' });
                res.json({ success: true, recoveryCode: newRecoveryCode });
            }
        );
    });
});

// ============= APPROVAL ENDPOINTS =============

// List approved emails
app.post('/api/approvals/list', async (req, res) => {
    const { requesterEmail, requesterPassword } = req.body || {};
    if (!await verifyOwner(requesterEmail, requesterPassword)) return res.status(401).json({ error: 'Invalid owner credentials' });
    db.all('SELECT email, approvedBy, createdAt FROM approved_emails ORDER BY createdAt DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ approvals: rows || [] });
    });
});

// List signup attempts
app.post('/api/approvals/attempts', async (req, res) => {
    const { requesterEmail, requesterPassword } = req.body || {};
    if (!await verifyOwner(requesterEmail, requesterPassword)) return res.status(401).json({ error: 'Invalid owner credentials' });
    db.all('SELECT * FROM signup_attempts ORDER BY lastAttemptAt DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ attempts: rows || [] });
    });
});

// Approve a signup attempt (adds to approved_emails)
app.post('/api/approvals/attempts/approve', async (req, res) => {
    const { requesterEmail, requesterPassword, email } = req.body || {};
    if (!await verifyOwner(requesterEmail, requesterPassword)) return res.status(401).json({ error: 'Invalid owner credentials' });
    const target = sanitizeInput(email || '').toLowerCase();
    if (!target) return res.status(400).json({ error: 'Email required' });
    db.run('INSERT OR IGNORE INTO approved_emails (email, approvedBy) VALUES (?, ?)', [target, OWNER_EMAIL], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        db.run("UPDATE signup_attempts SET status='approved' WHERE email=?", [target], () => {});
        res.json({ success: true });
    });
});

// Deny a signup attempt
app.post('/api/approvals/attempts/deny', async (req, res) => {
    const { requesterEmail, requesterPassword, email, reason } = req.body || {};
    if (!await verifyOwner(requesterEmail, requesterPassword)) return res.status(401).json({ error: 'Invalid owner credentials' });
    const target = sanitizeInput(email || '').toLowerCase();
    if (!target) return res.status(400).json({ error: 'Email required' });
    db.run("UPDATE signup_attempts SET status='denied', lastError=? WHERE email=?", [sanitizeInput(reason || 'Denied'), target], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// Pre-approve an email
app.post('/api/approvals/add', async (req, res) => {
    const { requesterEmail, requesterPassword, email } = req.body || {};
    if (!await verifyOwner(requesterEmail, requesterPassword)) return res.status(401).json({ error: 'Invalid owner credentials' });
    const target = sanitizeInput(email || '').toLowerCase();
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return res.status(400).json({ error: 'Valid email required' });
    db.run('INSERT OR IGNORE INTO approved_emails (email, approvedBy) VALUES (?, ?)', [target, OWNER_EMAIL], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// Remove approval
app.post('/api/approvals/remove', async (req, res) => {
    const { requesterEmail, requesterPassword, email } = req.body || {};
    if (!await verifyOwner(requesterEmail, requesterPassword)) return res.status(401).json({ error: 'Invalid owner credentials' });
    const target = sanitizeInput(email || '').toLowerCase();
    if (target === OWNER_EMAIL) return res.status(400).json({ error: 'Cannot remove owner approval' });
    db.run('DELETE FROM approved_emails WHERE email = ?', [target], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// ============= SUPPLIER PROFILES =============
const multer = require('multer');
const uploadStorage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS supplier_profiles (
        supplierId TEXT PRIMARY KEY,
        logoUrl TEXT,
        portalUrl TEXT,
        externalUrl TEXT,
        importantNotes TEXT,
        quickInfo TEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => { if (err) console.error('supplier_profiles table error:', err); });
});

// GET all supplier profiles
app.get('/api/suppliers/profiles', (req, res) => {
    db.all('SELECT * FROM supplier_profiles', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ profiles: (rows || []).map(r => ({ ...r, quickInfo: r.quickInfo ? JSON.parse(r.quickInfo) : {} })) });
    });
});

// POST update a supplier profile (text fields)
app.post('/api/suppliers/profile/update', async (req, res) => {
    const { supplierId, requesterEmail, requesterPassword, logoUrl, portalUrl, externalUrl, importantNotes, quickInfo } = req.body || {};
    if (!supplierId) return res.status(400).json({ error: 'supplierId required' });
    if (!await verifyOwner(requesterEmail, requesterPassword) && (requesterEmail || '').toLowerCase() !== OWNER_EMAIL) {
        const isAdmin = await new Promise(resolve => {
            db.get('SELECT email FROM users WHERE email = ?', [(requesterEmail || '').toLowerCase()], async (err, row) => {
                if (!row) return resolve(false);
                const pw = await bcrypt.compare(requesterPassword || '', (await new Promise(r2 => db.get('SELECT passwordHash FROM users WHERE email=?', [row.email], (e, u) => r2(u?.passwordHash || '')))));
                resolve(pw);
            });
        });
        if (!isAdmin) return res.status(401).json({ error: 'Invalid credentials' });
    }
    const quickInfoStr = quickInfo ? JSON.stringify(quickInfo) : null;
    db.run(`INSERT INTO supplier_profiles (supplierId, logoUrl, portalUrl, externalUrl, importantNotes, quickInfo, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(supplierId) DO UPDATE SET
            logoUrl = COALESCE(excluded.logoUrl, logoUrl),
            portalUrl = COALESCE(excluded.portalUrl, portalUrl),
            externalUrl = COALESCE(excluded.externalUrl, externalUrl),
            importantNotes = COALESCE(excluded.importantNotes, importantNotes),
            quickInfo = COALESCE(excluded.quickInfo, quickInfo),
            updatedAt = CURRENT_TIMESTAMP`,
        [supplierId, logoUrl || null, portalUrl || null, externalUrl || null, importantNotes || null, quickInfoStr],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            db.get('SELECT * FROM supplier_profiles WHERE supplierId = ?', [supplierId], (e, row) => {
                const profile = row ? { ...row, quickInfo: row.quickInfo ? JSON.parse(row.quickInfo) : {} } : { supplierId };
                res.json({ success: true, profile });
            });
        }
    );
});

// POST upload supplier logo (multipart)
app.post('/api/suppliers/logo/upload', uploadStorage.single('logo'), async (req, res) => {
    const { supplierId, requesterEmail, requesterPassword } = req.body || {};
    if (!supplierId || !req.file) return res.status(400).json({ error: 'supplierId and logo file required' });
    const validOwner = await verifyOwner(requesterEmail, requesterPassword);
    if (!validOwner) {
        const validUser = await new Promise(resolve => {
            db.get('SELECT passwordHash FROM users WHERE email = ?', [(requesterEmail || '').toLowerCase()], async (err, row) => {
                if (!row) return resolve(false);
                resolve(await bcrypt.compare(requesterPassword || '', row.passwordHash));
            });
        });
        if (!validUser) return res.status(401).json({ error: 'Invalid credentials' });
    }
    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    db.run(`INSERT INTO supplier_profiles (supplierId, logoUrl, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(supplierId) DO UPDATE SET logoUrl = excluded.logoUrl, updatedAt = CURRENT_TIMESTAMP`,
        [supplierId, b64],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            db.get('SELECT * FROM supplier_profiles WHERE supplierId = ?', [supplierId], (e, row) => {
                const profile = row ? { ...row, quickInfo: row.quickInfo ? JSON.parse(row.quickInfo) : {} } : { supplierId, logoUrl: b64 };
                res.json({ success: true, profile });
            });
        }
    );
});

// Tupou order request email
app.post('/api/orders/tupou-request', emailLimiter, async (req, res) => {
    const { requesterEmail, requesterName, recipientEmail, orderNumber, supplier, items, dateOrdered, expectedDelivery, notes } = req.body || {};

    if (!requesterEmail || !supplier || !items) {
        return res.status(400).json({ error: 'Missing required order details' });
    }

    const sendTo = recipientEmail || process.env.TUPOU_EMAIL || process.env.EMAIL_USER;
    if (!sendTo) {
        return res.status(500).json({ error: 'Tupou email address not configured. Set TUPOU_EMAIL in environment variables.' });
    }

    const displayName = requesterName || requesterEmail;

    const itemRows = (Array.isArray(items) ? items : [items]).map(i =>
        `<tr><td style="padding:8px;border:1px solid #eee;">${i.item || i}</td><td style="padding:8px;border:1px solid #eee;">${i.quantity || ''}</td><td style="padding:8px;border:1px solid #eee;">${i.purchaseUnit || ''}</td></tr>`
    ).join('');

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:#ff4d94;padding:16px 20px;border-radius:8px 8px 0 0;">
                <h1 style="color:white;margin:0;font-size:20px;">◇ IMH Order Request</h1>
            </div>
            <div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
                <p>Hi Tupou,</p>
                <p>A new order request has been submitted by <strong>${displayName}</strong>.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                    <tr style="background:#f5f5f5;">
                        <th style="padding:8px;border:1px solid #eee;text-align:left;">Order #</th>
                        <td style="padding:8px;border:1px solid #eee;">${orderNumber || 'N/A'}</td>
                    </tr>
                    <tr>
                        <th style="padding:8px;border:1px solid #eee;text-align:left;">Supplier</th>
                        <td style="padding:8px;border:1px solid #eee;">${supplier}</td>
                    </tr>
                    <tr style="background:#f5f5f5;">
                        <th style="padding:8px;border:1px solid #eee;text-align:left;">Date Ordered</th>
                        <td style="padding:8px;border:1px solid #eee;">${dateOrdered || 'N/A'}</td>
                    </tr>
                    <tr>
                        <th style="padding:8px;border:1px solid #eee;text-align:left;">Expected Delivery</th>
                        <td style="padding:8px;border:1px solid #eee;">${expectedDelivery || 'N/A'}</td>
                    </tr>
                    ${notes ? `<tr style="background:#f5f5f5;"><th style="padding:8px;border:1px solid #eee;text-align:left;">Notes</th><td style="padding:8px;border:1px solid #eee;">${notes}</td></tr>` : ''}
                </table>
                <h3 style="margin-bottom:8px;">Items Requested</h3>
                <table style="width:100%;border-collapse:collapse;">
                    <tr style="background:#ff4d94;color:white;">
                        <th style="padding:8px;border:1px solid #eee;text-align:left;">Item</th>
                        <th style="padding:8px;border:1px solid #eee;text-align:left;">Quantity</th>
                        <th style="padding:8px;border:1px solid #eee;text-align:left;">Unit</th>
                    </tr>
                    ${itemRows}
                </table>
                <p style="margin-top:20px;color:#666;font-size:13px;">Please reply to this email or contact <a href="mailto:${requesterEmail}">${requesterEmail}</a> to confirm the order.</p>
                <p style="color:#666;font-size:12px;border-top:1px solid #eee;padding-top:12px;margin-top:20px;">IMH Inventory Management Hub — Automated Order Request</p>
            </div>
        </div>`;

    try {
        await sendEmail({
            from: process.env.EMAIL_USER || `noreply@imhubapp.com`,
            to: sendTo,
            replyTo: requesterEmail,
            subject: `IMH Order Request — ${supplier} — ${orderNumber || new Date().toLocaleDateString()}`,
            html
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Tupou email error:', err.message || err);
        res.status(500).json({ error: `Failed to send email: ${err.message || err}` });
    }
});

// Serve static files (CSS, JS, etc.)
app.use(express.static(path.join(__dirname)));

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'Server is running', 
        timestamp: new Date().toISOString(),
        version: '2.0-secure'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔒 IMH Server running securely on port ${PORT}`);
    console.log(`📧 Email service configured: ${process.env.EMAIL_USER ? 'YES' : 'NO (set in .env)'}`);
    console.log(`⚙️  Rate limiting enabled for login and password reset`);
});
