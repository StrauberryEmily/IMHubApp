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
app.set('trust proxy', 1);

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
// Use DB_PATH for persistent storage on platforms like Railway volumes.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'users.db');
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'emilyjreed01@gmail.com').toLowerCase();
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err);
        process.exit(1);
    }
    console.log('✅ Database connected at', dbPath);
});

// Create users table if it doesn't exist
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        recoveryCode TEXT NOT NULL,
        role TEXT DEFAULT 'Staff',
        isPrimaryAdmin INTEGER DEFAULT 0,
        isOwner INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`, (err) => {
    if (err) console.error('Table creation error:', err);

    // Ensure the designated owner email is always tagged as Owner.
    db.run(
        'UPDATE users SET role = ?, isPrimaryAdmin = 1, isOwner = 1 WHERE lower(email) = ?',
        ['Owner', OWNER_EMAIL],
        (ownerErr) => {
            if (ownerErr) {
                console.error('Owner bootstrap error:', ownerErr);
            }
        }
    );

});

// Create approved emails table for controlled registration.
db.run(`
    CREATE TABLE IF NOT EXISTS approved_emails (
        email TEXT PRIMARY KEY,
        approvedBy TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`, (err) => {
    if (err) console.error('Approved emails table error:', err);

    // Ensure owner email is always allowed to register.
    db.run(
        'INSERT OR IGNORE INTO approved_emails (email, approvedBy) VALUES (?, ?)',
        [OWNER_EMAIL, OWNER_EMAIL],
        (seedErr) => {
            if (seedErr) console.error('Approved emails seed error:', seedErr);
        }
    );
});

// Create signup attempts table for owner review queue.
db.run(`
    CREATE TABLE IF NOT EXISTS signup_attempts (
        email TEXT PRIMARY KEY,
        fullName TEXT,
        attemptCount INTEGER DEFAULT 1,
        firstAttemptAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastAttemptAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        lastError TEXT DEFAULT '',
        reviewedBy TEXT,
        reviewedAt DATETIME
    );
`, (err) => {
    if (err) console.error('Signup attempts table error:', err);
});

// Add missing columns if they don't exist
db.all(`PRAGMA table_info(users)`, (err, columns) => {
    const columnNames = columns?.map(col => col.name) || [];
    
    if (!columnNames.includes('isPrimaryAdmin')) {
        db.run(`ALTER TABLE users ADD COLUMN isPrimaryAdmin INTEGER DEFAULT 0`, (err) => {
            if (!err) console.log('✅ Added isPrimaryAdmin column');
        });
    }
    
    if (!columnNames.includes('isOwner')) {
        db.run(`ALTER TABLE users ADD COLUMN isOwner INTEGER DEFAULT 0`, (err) => {
            if (!err) console.log('✅ Added isOwner column');
        });
    }
});

// Create recovery tokens table for password reset
db.run(`
    CREATE TABLE IF NOT EXISTS recovery_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        recoveryCode TEXT NOT NULL,
        expiresAt DATETIME NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email) REFERENCES users(email)
    );
`, (err) => {
    if (err) console.error('Table creation error:', err);
});
// For Gmail: Use App Password (not your regular password)
// Generate at: https://myaccount.google.com/apppasswords
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'your-app-password'
    }
});

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

// Helper function to sanitize input
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>\"']/g, '');
}

function verifyOwnerCredentials(requesterEmail, requesterPassword, callback) {
    const normalizedEmail = sanitizeInput(requesterEmail || '').toLowerCase();
    if (!normalizedEmail || !requesterPassword) {
        return callback(null, false);
    }

    db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail], async (err, user) => {
        if (err) return callback(err, false);
        if (!user) return callback(null, false);

        try {
            const passwordMatch = await bcrypt.compare(requesterPassword, user.passwordHash);
            const isOwnerUser = Number(user.isOwner) === 1 || normalizedEmail === OWNER_EMAIL;
            callback(null, Boolean(passwordMatch && isOwnerUser));
        } catch (compareErr) {
            callback(compareErr, false);
        }
    });
}

function recordSignupAttempt(email, fullName, status = 'pending', lastError = '') {
    db.run(
        `INSERT INTO signup_attempts (email, fullName, attemptCount, firstAttemptAt, lastAttemptAt, status, lastError)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
            fullName = excluded.fullName,
            attemptCount = signup_attempts.attemptCount + 1,
            lastAttemptAt = CURRENT_TIMESTAMP,
            status = excluded.status,
            lastError = excluded.lastError`,
        [email, fullName, status, lastError],
        (err) => {
            if (err) console.error('Signup attempt record error:', err);
        }
    );
}

// Helper function to generate 6-digit recovery code
function generateRecoveryCode() {
    return Math.floor(Math.random() * 900000) + 100000;
}

// User Registration
app.post('/api/register', loginLimiter, async (req, res) => {
    try {
        const email = sanitizeInput(req.body.email || '').toLowerCase();
        const password = req.body.password || '';
        const fullName = sanitizeInput(req.body.fullName || '');

        // Validation
        if (!email || !password || !fullName) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (password.length < 8 || !/\d/.test(password) || !/[A-Z]/.test(password)) {
            return res.status(400).json({ error: 'Password must be 8+ characters with 1 number and 1 uppercase letter' });
        }

        const completeRegistration = async () => {
            // Check if user already exists
            db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existing) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (existing) {
                    return res.status(400).json({ error: 'Email already registered' });
                }

                // Hash password
                const passwordHash = await bcrypt.hash(password, 10);
                const recoveryCode = generateRecoveryCode();
                const isOwner = email === OWNER_EMAIL ? 1 : 0;
                const role = isOwner ? 'Owner' : 'Staff';
                const isPrimaryAdmin = isOwner ? 1 : 0;

                // Store user in database
                db.run(
                    'INSERT INTO users (email, passwordHash, recoveryCode, role, isPrimaryAdmin, isOwner) VALUES (?, ?, ?, ?, ?, ?)',
                    [email, passwordHash, recoveryCode, role, isPrimaryAdmin, isOwner],
                    function(insertErr) {
                        if (insertErr) {
                            return res.status(500).json({ error: 'Failed to create account' });
                        }

                        res.json({
                            success: true,
                            message: 'Account created successfully',
                            recoveryCode: recoveryCode.toString(),
                            email: email,
                            fullName: fullName,
                            role: role,
                            isOwner: isOwner,
                            isPrimaryAdmin: isPrimaryAdmin
                        });

                        db.run(
                            `UPDATE signup_attempts
                             SET status = 'registered', lastError = '', reviewedAt = CURRENT_TIMESTAMP
                             WHERE email = ?`,
                            [email],
                            () => {}
                        );
                    }
                );
            });
        };

        // Registration allowlist: non-owner emails must be pre-approved.
        if (email !== OWNER_EMAIL) {
            db.get('SELECT email FROM approved_emails WHERE lower(email) = ?', [email], (approvalErr, approvedRow) => {
                if (approvalErr) {
                    return res.status(500).json({ error: 'Database error' });
                }

                if (!approvedRow) {
                    recordSignupAttempt(
                        email,
                        fullName,
                        'pending',
                        'Not approved for account creation'
                    );
                    return res.status(403).json({
                        error: 'This email is not approved yet. Ask the owner to approve it in Settings > Team > Account Approvals.'
                    });
                }

                completeRegistration();
            });
            return;
        }

        completeRegistration();
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// List approved emails (owner only)
app.post('/api/approvals/list', async (req, res) => {
    try {
        const requesterEmail = sanitizeInput(req.body.requesterEmail || '').toLowerCase();
        const requesterPassword = req.body.requesterPassword || '';

        verifyOwnerCredentials(requesterEmail, requesterPassword, (verifyErr, allowed) => {
            if (verifyErr) return res.status(500).json({ error: 'Database error' });
            if (!allowed) return res.status(403).json({ error: 'Only owner can manage approved emails' });

            db.all('SELECT email, approvedBy, createdAt FROM approved_emails ORDER BY createdAt DESC', [], (listErr, rows) => {
                if (listErr) return res.status(500).json({ error: 'Database error' });
                res.json({ success: true, approvals: rows || [] });
            });
        });
    } catch (error) {
        console.error('Approvals list error:', error);
        res.status(500).json({ error: 'Failed to list approved emails' });
    }
});

// List signup attempts for owner review queue (owner only)
app.post('/api/approvals/attempts', async (req, res) => {
    try {
        const requesterEmail = sanitizeInput(req.body.requesterEmail || '').toLowerCase();
        const requesterPassword = req.body.requesterPassword || '';

        verifyOwnerCredentials(requesterEmail, requesterPassword, (verifyErr, allowed) => {
            if (verifyErr) return res.status(500).json({ error: 'Database error' });
            if (!allowed) return res.status(403).json({ error: 'Only owner can review signup attempts' });

            db.all(
                `SELECT email, fullName, attemptCount, firstAttemptAt, lastAttemptAt, status, lastError, reviewedBy, reviewedAt
                 FROM signup_attempts
                 ORDER BY lastAttemptAt DESC`,
                [],
                (listErr, rows) => {
                    if (listErr) return res.status(500).json({ error: 'Database error' });
                    res.json({ success: true, attempts: rows || [] });
                }
            );
        });
    } catch (error) {
        console.error('Attempts list error:', error);
        res.status(500).json({ error: 'Failed to list signup attempts' });
    }
});

// Add approved email (owner only)
app.post('/api/approvals/add', async (req, res) => {
    try {
        const requesterEmail = sanitizeInput(req.body.requesterEmail || '').toLowerCase();
        const requesterPassword = req.body.requesterPassword || '';
        const email = sanitizeInput(req.body.email || '').toLowerCase();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        verifyOwnerCredentials(requesterEmail, requesterPassword, (verifyErr, allowed) => {
            if (verifyErr) return res.status(500).json({ error: 'Database error' });
            if (!allowed) return res.status(403).json({ error: 'Only owner can manage approved emails' });

            db.run(
                'INSERT OR IGNORE INTO approved_emails (email, approvedBy) VALUES (?, ?)',
                [email, requesterEmail],
                function(insertErr) {
                    if (insertErr) return res.status(500).json({ error: 'Database error' });

                    db.run(
                        `UPDATE signup_attempts
                         SET status = 'approved', lastError = '', reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP
                         WHERE email = ?`,
                        [requesterEmail, email],
                        () => {}
                    );

                    res.json({ success: true, email });
                }
            );
        });
    } catch (error) {
        console.error('Approvals add error:', error);
        res.status(500).json({ error: 'Failed to approve email' });
    }
});

// Remove approved email (owner only)
app.post('/api/approvals/remove', async (req, res) => {
    try {
        const requesterEmail = sanitizeInput(req.body.requesterEmail || '').toLowerCase();
        const requesterPassword = req.body.requesterPassword || '';
        const email = sanitizeInput(req.body.email || '').toLowerCase();

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        if (email === OWNER_EMAIL) {
            return res.status(400).json({ error: 'Cannot remove owner email from approvals' });
        }

        verifyOwnerCredentials(requesterEmail, requesterPassword, (verifyErr, allowed) => {
            if (verifyErr) return res.status(500).json({ error: 'Database error' });
            if (!allowed) return res.status(403).json({ error: 'Only owner can manage approved emails' });

            db.run('DELETE FROM approved_emails WHERE email = ?', [email], function(removeErr) {
                if (removeErr) return res.status(500).json({ error: 'Database error' });

                db.run(
                    `UPDATE signup_attempts
                     SET status = 'denied', lastError = 'Denied by owner', reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP
                     WHERE email = ?`,
                    [requesterEmail, email],
                    () => {}
                );

                res.json({ success: true, removed: this.changes > 0, email });
            });
        });
    } catch (error) {
        console.error('Approvals remove error:', error);
        res.status(500).json({ error: 'Failed to remove approved email' });
    }
});

// Approve a signup attempt directly from queue (owner only)
app.post('/api/approvals/attempts/approve', async (req, res) => {
    try {
        const requesterEmail = sanitizeInput(req.body.requesterEmail || '').toLowerCase();
        const requesterPassword = req.body.requesterPassword || '';
        const email = sanitizeInput(req.body.email || '').toLowerCase();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        verifyOwnerCredentials(requesterEmail, requesterPassword, (verifyErr, allowed) => {
            if (verifyErr) return res.status(500).json({ error: 'Database error' });
            if (!allowed) return res.status(403).json({ error: 'Only owner can review signup attempts' });

            db.run(
                'INSERT OR IGNORE INTO approved_emails (email, approvedBy) VALUES (?, ?)',
                [email, requesterEmail],
                function(insertErr) {
                    if (insertErr) return res.status(500).json({ error: 'Database error' });

                    db.run(
                        `UPDATE signup_attempts
                         SET status = 'approved', lastError = '', reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP
                         WHERE email = ?`,
                        [requesterEmail, email],
                        () => {}
                    );

                    res.json({ success: true, email });
                }
            );
        });
    } catch (error) {
        console.error('Attempts approve error:', error);
        res.status(500).json({ error: 'Failed to approve signup attempt' });
    }
});

// Deny a signup attempt directly from queue (owner only)
app.post('/api/approvals/attempts/deny', async (req, res) => {
    try {
        const requesterEmail = sanitizeInput(req.body.requesterEmail || '').toLowerCase();
        const requesterPassword = req.body.requesterPassword || '';
        const email = sanitizeInput(req.body.email || '').toLowerCase();
        const reason = sanitizeInput(req.body.reason || 'Denied by owner');

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        if (email === OWNER_EMAIL) {
            return res.status(400).json({ error: 'Owner email cannot be denied' });
        }

        verifyOwnerCredentials(requesterEmail, requesterPassword, (verifyErr, allowed) => {
            if (verifyErr) return res.status(500).json({ error: 'Database error' });
            if (!allowed) return res.status(403).json({ error: 'Only owner can review signup attempts' });

            db.run('DELETE FROM approved_emails WHERE email = ?', [email], function(removeErr) {
                if (removeErr) return res.status(500).json({ error: 'Database error' });

                db.run(
                    `INSERT INTO signup_attempts (email, fullName, attemptCount, firstAttemptAt, lastAttemptAt, status, lastError, reviewedBy, reviewedAt)
                     VALUES (?, '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'denied', ?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(email) DO UPDATE SET
                        status = 'denied',
                        lastError = ?,
                        reviewedBy = ?,
                        reviewedAt = CURRENT_TIMESTAMP`,
                    [email, reason, requesterEmail, reason, requesterEmail],
                    () => {}
                );

                res.json({ success: true, email });
            });
        });
    } catch (error) {
        console.error('Attempts deny error:', error);
        res.status(500).json({ error: 'Failed to deny signup attempt' });
    }
});

// Remove a team member account (owner only)
app.post('/api/team/remove', async (req, res) => {
    try {
        const requesterEmail = sanitizeInput(req.body.requesterEmail || '').toLowerCase();
        const requesterPassword = req.body.requesterPassword || '';
        const targetEmail = sanitizeInput(req.body.targetEmail || '').toLowerCase();

        if (!targetEmail) {
            return res.status(400).json({ error: 'Target email is required' });
        }

        if (targetEmail === OWNER_EMAIL) {
            return res.status(400).json({ error: 'Owner account cannot be removed' });
        }

        verifyOwnerCredentials(requesterEmail, requesterPassword, (verifyErr, allowed) => {
            if (verifyErr) return res.status(500).json({ error: 'Database error' });
            if (!allowed) return res.status(403).json({ error: 'Only owner can remove team member accounts' });

            db.get('SELECT email FROM users WHERE email = ?', [targetEmail], (findErr, user) => {
                if (findErr) return res.status(500).json({ error: 'Database error' });
                if (!user) return res.status(404).json({ error: 'User not found' });

                db.run('DELETE FROM users WHERE email = ?', [targetEmail], function(removeErr) {
                    if (removeErr) return res.status(500).json({ error: 'Database error' });

                    db.run('DELETE FROM approved_emails WHERE email = ?', [targetEmail], () => {});
                    db.run(
                        `INSERT INTO signup_attempts (email, fullName, attemptCount, firstAttemptAt, lastAttemptAt, status, lastError, reviewedBy, reviewedAt)
                         VALUES (?, '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'removed', 'Removed by owner', ?, CURRENT_TIMESTAMP)
                         ON CONFLICT(email) DO UPDATE SET
                            status = 'removed',
                            lastError = 'Removed by owner',
                            reviewedBy = ?,
                            reviewedAt = CURRENT_TIMESTAMP`,
                        [targetEmail, requesterEmail, requesterEmail],
                        () => {}
                    );

                    res.json({
                        success: true,
                        removed: this.changes > 0,
                        email: targetEmail,
                        message: 'Team member removed from system'
                    });
                });
            });
        });
    } catch (error) {
        console.error('Team remove error:', error);
        res.status(500).json({ error: 'Failed to remove team member' });
    }
});

// Setup admin endpoint (owner credential verification required)
app.post('/api/setup-admin', async (req, res) => {
    try {
        const email = sanitizeInput(req.body.email || '').toLowerCase();
        const requesterEmail = sanitizeInput(req.body.requesterEmail || '').toLowerCase();
        const requesterPassword = req.body.requesterPassword || '';

        if (!email || !requesterEmail || !requesterPassword) {
            return res.status(400).json({ error: 'Target email, owner email, and owner password are required' });
        }

        // Verify requester is the owner and password is correct.
        db.get('SELECT * FROM users WHERE email = ?', [requesterEmail], async (requesterErr, requester) => {
            if (requesterErr) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!requester) {
                return res.status(403).json({ error: 'Only owner can assign admin role' });
            }

            const ownerPasswordMatch = await bcrypt.compare(requesterPassword, requester.passwordHash);
            if (!ownerPasswordMatch || Number(requester.isOwner) !== 1) {
                return res.status(403).json({ error: 'Only owner can assign admin role' });
            }

            // Keep owner identity tied to the owner email; all others become Admin.
            const targetIsOwner = email === OWNER_EMAIL ? 1 : 0;
            const role = targetIsOwner ? 'Owner' : 'Admin';

            const sql = 'UPDATE users SET role = ?, isPrimaryAdmin = ?, isOwner = ? WHERE email = ?';
            const params = [role, targetIsOwner, targetIsOwner, email];

            db.run(sql, params, function(updateErr) {
                if (updateErr) {
                    return res.status(500).json({ error: 'Database error' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.json({
                    success: true,
                    message: `${email} has been set as ${role}`,
                    email: email,
                    role: role,
                    isOwner: targetIsOwner,
                    isPrimaryAdmin: targetIsOwner
                });
            });
        });
    } catch (error) {
        console.error('Setup admin error:', error);
        res.status(500).json({ error: 'Setup failed' });
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

            const effectiveIsOwner = email === OWNER_EMAIL ? 1 : (user.isOwner || 0);
            const effectiveRole = effectiveIsOwner ? 'Owner' : (user.role || 'Staff');
            const effectiveIsPrimaryAdmin = effectiveIsOwner ? 1 : (user.isPrimaryAdmin || 0);

            // Keep owner flags corrected in DB if they drift.
            if (effectiveIsOwner && (user.isOwner !== 1 || user.role !== 'Owner' || user.isPrimaryAdmin !== 1)) {
                db.run(
                    'UPDATE users SET role = ?, isPrimaryAdmin = 1, isOwner = 1 WHERE email = ?',
                    ['Owner', email],
                    (fixErr) => {
                        if (fixErr) {
                            console.error('Owner role correction error:', fixErr);
                        }
                    }
                );
            }

            // Login successful
            res.json({
                success: true,
                message: 'Login successful',
                email: user.email,
                role: effectiveRole,
                isOwner: effectiveIsOwner,
                isPrimaryAdmin: effectiveIsPrimaryAdmin,
                recoveryCode: user.recoveryCode.toString()
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
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
