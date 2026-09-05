require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function seedAdmin() {
  const username = process.env.ADMIN_DEFAULT_USER || 'admin';
  const password = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123';
  const role = 'admin';

  console.log('🌱 Starting admin seed process...');
  console.log(`👤 Target admin username: ${username}`);

  try {
    // Check if user already exists
    const [existing] = await pool.query(
      'SELECT id, username, role FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      console.log(`ℹ️  Admin user "${username}" already exists (ID: ${existing[0].id}). Skipping seed.`);
      process.exit(0);
    }

    // Hash password with bcryptjs
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new admin user
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );

    console.log('✅ Admin user created successfully!');
    console.log(`   ID: ${result.insertId}`);
    console.log(`   Username: ${username}`);
    console.log(`   Default Password: ${password}`);
    console.log('⚠️  Please change the default password after first login.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed admin user:', error.message);
    process.exit(1);
  }
}

seedAdmin();
