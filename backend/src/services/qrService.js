const crypto = require('crypto');
const { pool } = require('../config/db');
const policyService = require('./policyService');

/**
 * Get current timestamp formatted for MySQL DATETIME (Asia/Kolkata IST)
 */
function getIstDateTime(offsetSeconds = 0) {
  const d = new Date(Date.now() + offsetSeconds * 1000);
  const year = d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric' });
  const month = String(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', month: '2-digit' })).padStart(2, '0');
  const day = String(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', day: '2-digit' })).padStart(2, '0');
  const hour = String(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit' })).padStart(2, '0');
  const minute = String(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', minute: '2-digit' })).padStart(2, '0');
  const second = String(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', second: '2-digit' })).padStart(2, '0');

  // Handle 24 for hour if locale formats 24:00:00
  const normalizedHour = hour === '24' ? '00' : hour;

  return `${year}-${month}-${day} ${normalizedHour}:${minute}:${second}`;
}

/**
 * Hash raw token using SHA-256
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generate cryptographically secure QR challenge (Admin only)
 */
async function generateChallenge(userId) {
  const validitySecondsStr = await policyService.getPolicy('qr_validity_seconds');
  const validity_seconds = Math.max(5, parseInt(validitySecondsStr, 10) || 30);

  const rawToken = crypto.randomBytes(32).toString('hex'); // 64-char hex
  const challenge_id = crypto.randomUUID();
  const token_hash = hashToken(rawToken);
  const expires_at = getIstDateTime(validity_seconds);

  await pool.query(
    `INSERT INTO qr_challenges (challenge_id, token_hash, expires_at, created_by)
     VALUES (?, ?, ?, ?)`,
    [challenge_id, token_hash, expires_at, userId]
  );

  return {
    challenge_id,
    rawToken,
    expires_at,
    validity_seconds,
  };
}

/**
 * Validate QR token and record per-employee single use inside an active MySQL transaction
 */
async function validateAndConsumeChallengeForEmployee(rawToken, employeeId, connection) {
  if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) {
    const error = new Error('Invalid QR token format.');
    error.status = 400;
    throw error;
  }

  const token_hash = hashToken(rawToken.trim());
  const dbClient = connection || pool;

  // 1. Find challenge by token hash with row lock
  const [challenges] = await dbClient.query(
    `SELECT id, challenge_id, token_hash, expires_at 
     FROM qr_challenges 
     WHERE token_hash = ? 
     FOR UPDATE`,
    [token_hash]
  );

  if (challenges.length === 0) {
    const error = new Error('Invalid QR code.');
    error.status = 400;
    throw error;
  }

  const challenge = challenges[0];

  // 2. Check expiration against current IST time
  const nowStr = getIstDateTime(0);
  const expiresStr = new Date(challenge.expires_at).toISOString();
  const nowMs = Date.now();
  const expiresMs = new Date(challenge.expires_at).getTime();

  if (expiresMs <= nowMs) {
    const error = new Error('QR code has expired.');
    error.status = 400;
    throw error;
  }

  // 3. Check per-employee single-use replay protection
  const [existingUses] = await dbClient.query(
    `SELECT id FROM qr_challenge_uses WHERE challenge_id = ? AND employee_id = ? LIMIT 1`,
    [challenge.id, employeeId]
  );

  if (existingUses.length > 0) {
    const error = new Error('QR code has already been used by you.');
    error.status = 400;
    throw error;
  }

  // 4. Atomically insert per-employee usage record
  try {
    await dbClient.query(
      `INSERT INTO qr_challenge_uses (challenge_id, employee_id) VALUES (?, ?)`,
      [challenge.id, employeeId]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const error = new Error('QR code has already been used by you.');
      error.status = 400;
      throw error;
    }
    throw err;
  }

  return {
    id: challenge.id,
    challenge_id: challenge.challenge_id,
    expires_at: challenge.expires_at,
  };
}

module.exports = {
  hashToken,
  generateChallenge,
  validateAndConsumeChallengeForEmployee,
};
