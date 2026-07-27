# 🔒 IMH Security Checklist

## Before Going Live

- [ ] **Update dependencies**
  ```bash
  npm install
  npm audit
  ```

- [ ] **Create .env file**
  ```bash
  cp .env.example .env
  # Edit .env with your Gmail app password
  ```

- [ ] **Test password reset email**
  - Create account
  - Click "Forgot password?"
  - Verify email arrives with recovery code
  - Test that code resets password

- [ ] **Test rate limiting**
  - Try logging in with wrong password 6 times
  - Should be blocked on 6th attempt
  - Wait 15 minutes and try again

- [ ] **Verify all users have strong passwords**
  - 8+ characters
  - At least 1 number
  - At least 1 uppercase letter

## Regular Maintenance (Monthly)

- [ ] **Update dependencies**
  ```bash
  cd /Users/emilyreed/new
  npm update
  npm audit fix
  ```

- [ ] **Check server logs** for suspicious activity
  - Review failed login attempts
  - Check password reset requests
  - Look for unexpected errors

- [ ] **Backup user data**
  - Export user list
  - Store in secure location
  - Consider: database backup

- [ ] **Review access logs**
  - Who logged in?
  - When?
  - From where (if tracking enabled)?

## Quarterly Reviews

- [ ] **Security audit**
  - Review all user accounts
  - Disable inactive accounts
  - Update security headers
  - Check for new vulnerabilities

- [ ] **Test backup restoration**
  - Verify backups work
  - Document recovery procedure
  - Train team on recovery

- [ ] **Update documentation**
  - Security guide up to date?
  - Password policies clear?
  - Incident response plan exists?

## Immediate Actions if Issue Occurs

### Someone Forgot Password
✅ Use password reset → Email recovery code → Reset password

### Someone Lost Recovery Code
✅ (Admin only) Reset their account manually OR send new password reset email

### Suspicious Activity Detected
1. Check who it is
2. If not admin: Reset their password
3. Ask them to confirm if it was them
4. If not them: They've been compromised
   - Reset password immediately
   - Change their email if possible
   - Monitor account for activity

### Server Won't Start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process if needed
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### Email Not Sending
- Check .env file has EMAIL_USER and EMAIL_PASSWORD
- Verify Gmail app password (not regular password)
- Check if 2FA is enabled on Gmail
- Check server logs for error messages

## Security Rules for Your Team

✅ **DO:**
- Change password if you suspect compromise
- Report suspicious emails
- Keep recovery codes in safe place
- Use strong passwords
- Lock computer when away

❌ **DON'T:**
- Share passwords with anyone
- Use same password on multiple sites
- Leave computer unlocked
- Write passwords on sticky notes
- Click suspicious links in emails

## Password Policy

- **Minimum:** 8 characters
- **Must include:** 1 number + 1 UPPERCASE letter
- **Change:** If you suspect it's been compromised
- **Reset method:** Email password reset with recovery code

## Role Permissions

As **Admin (You - Emily)**:
- Create/delete user accounts
- Assign user roles
- Reset user passwords
- View all inventory data
- Change system settings
- Manage user permissions

As **Regular User (Staff)**:
- View inventory
- Add/edit items (limited)
- View own profile
- Change own password
- Create tasks

## Data Ownership

- **You own:** All user accounts, all data, all settings
- **Users own:** Their password, their recovery code, their profile photo
- **Shared:** Inventory data (you control, they view)

## Backup Procedure

1. **Weekly:** Screenshot important data
2. **Monthly:** Export complete user list
3. **Quarterly:** Full system backup

```bash
# Example: Export user list
# (When database implemented)
# mysqldump -u user -p database > backup.sql
```

## Incident Response Plan

**If someone's account is compromised:**
1. Reset their password
2. Ask them to change it
3. Review what they accessed
4. Check if any data was changed
5. Restore from backup if needed
6. Notify other admins

**If server is hacked:**
1. Take server offline (stop npm process)
2. Check logs for entry point
3. Restore from clean backup
4. Reset all user passwords
5. Update server code
6. Relaunch with monitoring

**If you lose .env file:**
1. Create new Gmail App Password
2. Generate new .env file
3. Update server configuration
4. Restart server

---

## Contact Information

- **Server Issues:** Check console logs
- **Email Problems:** Verify Gmail app password
- **Account Locked:** Wait 15 minutes for rate limit to reset
- **Data Loss:** Check backups

---

**Remember:** Security is ongoing, not one-time!
