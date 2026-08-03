const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const email = 'emilyjreed01@gmail.com';
const password = '4Epracha!';
const db = new sqlite3.Database('./users.db');

db.get('SELECT email FROM users WHERE email = ?', [email], async (err, row) => {
  if (err) {
    console.error(err);
    db.close();
    process.exit(1);
  }

  if (row) {
    console.log('account already exists');
    db.close();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const recoveryCode = Math.floor(Math.random() * 900000) + 100000;

  db.run('INSERT INTO users (email, passwordHash, recoveryCode) VALUES (?, ?, ?)', [email, passwordHash, recoveryCode], function(err) {
    if (err) {
      console.error(err);
      db.close();
      process.exit(1);
    }
    console.log('created account');
    db.close();
  });
});
