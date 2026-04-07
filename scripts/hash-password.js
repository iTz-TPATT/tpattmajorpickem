// Run with: node scripts/hash-password.js "yourpassword"
// Then paste the output into supabase-setup.sql

const bcrypt = require("bcryptjs");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.js <password>");
  process.exit(1);
}

bcrypt.hash(password, 10, (err, hash) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(hash);
});
