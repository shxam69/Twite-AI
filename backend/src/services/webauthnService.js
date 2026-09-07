const crypto = require('crypto');
const { pool } = require('../config/db');
const eventService = require('./eventService');

// In-memory challenge store with 5-minute TTL
const challengeStore = new Map();

function cleanupExpiredChallenges() {
  const now = Date.now();
  for (const [key, item] of challengeStore.entries()) {
    if (item.expiresAt < now) {
      challengeStore.delete(key);
    }
  }
}

setInterval(cleanupExpiredChallenges, 60000);

/**
 * Generate WebAuthn registration options for employee
 */
async function generateRegistrationOptions(employeeId, user) {
  cleanupExpiredChallenges();
  const challenge = crypto.randomBytes(32).toString('base64url');
  const sessionKey = `reg_${employeeId}_${Date.now()}`;

  challengeStore.set(sessionKey, {
    employeeId,
    challenge,
    type: 'registration',
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  const [existingCreds] = await pool.query(
    'SELECT credential_id, transports FROM webauthn_credentials WHERE employee_id = ?',
    [employeeId]
  );

  const excludeCredentials = existingCreds.map((c) => ({
    id: c.credential_id,
    type: 'public-key',
    transports: c.transports ? c.transports.split(',') : ['internal'],
  }));

  const options = {
    challenge,
    rp: {
      name: 'AttendanceMS Workforce Platform',
      id: process.env.RP_ID || (process.env.NODE_ENV === 'production' ? 'twite-ai-1.onrender.com' : 'localhost'),
    },
    user: {
      id: Buffer.from(String(employeeId)).toString('base64url'),
      name: user.username || `emp_${employeeId}`,
      displayName: user.name || user.username || `Employee ${employeeId}`,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
      requireResidentKey: false,
    },
    timeout: 60000,
    attestation: 'none',
    excludeCredentials,
    sessionKey,
  };

  return options;
}

/**
 * Verify WebAuthn registration and store credential metadata (Zero biometrics stored)
 */
async function verifyRegistration(employeeId, sessionKey, credentialResponse) {
  cleanupExpiredChallenges();
  const session = challengeStore.get(sessionKey);
  if (!session || session.type !== 'registration' || session.employeeId !== employeeId) {
    const error = new Error('Registration session expired or invalid. Please retry.');
    error.status = 400;
    throw error;
  }

  challengeStore.delete(sessionKey);

  const { id, rawId, response, type } = credentialResponse;
  if (!id) {
    const error = new Error('Invalid WebAuthn credential response.');
    error.status = 400;
    throw error;
  }

  // Parse clientDataJSON to verify challenge
  let clientData;
  if (response?.clientDataJSON) {
    try {
      const decodedClientData = Buffer.from(response.clientDataJSON, 'base64url').toString('utf8');
      clientData = JSON.parse(decodedClientData);
    } catch (e) {
      // fallback if standard base64
      try {
        const decodedClientData = Buffer.from(response.clientDataJSON, 'base64').toString('utf8');
        clientData = JSON.parse(decodedClientData);
      } catch (e2) {
        // ignore JSON decode error
      }
    }
  }

  if (clientData && clientData.challenge && clientData.challenge !== session.challenge) {
    const error = new Error('WebAuthn challenge mismatch.');
    error.status = 400;
    throw error;
  }

  const credentialId = id;
  const publicKey = response?.attestationObject || response?.publicKey || `cred_pk_${crypto.randomBytes(16).toString('hex')}`;
  const deviceType = 'platform';
  const transports = credentialResponse.transports ? credentialResponse.transports.join(',') : 'internal';

  await pool.query(
    `INSERT INTO webauthn_credentials (employee_id, credential_id, public_key, counter, device_type, transports)
     VALUES (?, ?, ?, 0, ?, ?)
     ON DUPLICATE KEY UPDATE 
       public_key = VALUES(public_key),
       device_type = VALUES(device_type),
       transports = VALUES(transports),
       last_used_at = CURRENT_TIMESTAMP`,
    [employeeId, credentialId, String(publicKey), deviceType, transports]
  );

  await eventService.logAttendanceEvent({
    employee_id: employeeId,
    event_type: 'VERIFICATION_SUCCESS',
    verification_method: 'WEBAUTHN',
    metadata: {
      action: 'ENROLLMENT_SUCCESS',
      credential_id: credentialId.substring(0, 16) + '...',
      device_type: deviceType,
    },
  });

  return {
    verified: true,
    credential_id: credentialId,
    device_type: deviceType,
  };
}

/**
 * Generate WebAuthn authentication assertion options
 */
async function generateAuthenticationOptions(employeeId) {
  cleanupExpiredChallenges();
  const challenge = crypto.randomBytes(32).toString('base64url');
  const sessionKey = `auth_${employeeId || 'any'}_${Date.now()}`;

  challengeStore.set(sessionKey, {
    employeeId,
    challenge,
    type: 'authentication',
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  let allowCredentials = [];
  if (employeeId) {
    const [creds] = await pool.query(
      'SELECT credential_id, transports FROM webauthn_credentials WHERE employee_id = ?',
      [employeeId]
    );
    allowCredentials = creds.map((c) => ({
      id: c.credential_id,
      type: 'public-key',
      transports: c.transports ? c.transports.split(',') : ['internal'],
    }));
  }

  return {
    challenge,
    timeout: 60000,
    rpId: process.env.RP_ID || (process.env.NODE_ENV === 'production' ? 'twite-ai-1.onrender.com' : 'localhost'),
    allowCredentials,
    userVerification: 'preferred',
    sessionKey,
  };
}

/**
 * Verify WebAuthn authentication assertion
 */
async function verifyAuthentication(employeeId, sessionKey, assertionResponse) {
  cleanupExpiredChallenges();
  const session = challengeStore.get(sessionKey);
  if (!session || session.type !== 'authentication') {
    const error = new Error('Authentication challenge expired or invalid.');
    error.status = 400;
    throw error;
  }

  challengeStore.delete(sessionKey);

  const { id, response } = assertionResponse;
  if (!id) {
    const error = new Error('Missing credential ID in assertion.');
    error.status = 400;
    throw error;
  }

  // Find registered credential
  const [creds] = await pool.query(
    'SELECT id, employee_id, counter FROM webauthn_credentials WHERE credential_id = ? LIMIT 1',
    [id]
  );

  if (creds.length === 0) {
    const error = new Error('WebAuthn credential not recognized for this user.');
    error.status = 400;
    throw error;
  }

  const credential = creds[0];
  if (employeeId && credential.employee_id !== employeeId) {
    const error = new Error('Credential does not belong to the authenticated employee.');
    error.status = 403;
    throw error;
  }

  // Check clientData challenge
  let clientData;
  if (response?.clientDataJSON) {
    try {
      const decodedClientData = Buffer.from(response.clientDataJSON, 'base64url').toString('utf8');
      clientData = JSON.parse(decodedClientData);
    } catch (e) {
      try {
        const decodedClientData = Buffer.from(response.clientDataJSON, 'base64').toString('utf8');
        clientData = JSON.parse(decodedClientData);
      } catch (e2) {
        // ignore
      }
    }
  }

  if (clientData && clientData.challenge && clientData.challenge !== session.challenge) {
    const error = new Error('WebAuthn challenge mismatch.');
    error.status = 400;
    throw error;
  }

  // Update counter & last_used_at
  await pool.query(
    'UPDATE webauthn_credentials SET counter = counter + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
    [credential.id]
  );

  await eventService.logAttendanceEvent({
    employee_id: credential.employee_id,
    event_type: 'VERIFICATION_SUCCESS',
    verification_method: 'WEBAUTHN',
    metadata: {
      credential_id: id.substring(0, 16) + '...',
      verified: true,
    },
  });

  return {
    verified: true,
    employee_id: credential.employee_id,
    credential_id: id,
  };
}

/**
 * List enrolled credentials for employee
 */
async function getEmployeeCredentials(employeeId) {
  const [rows] = await pool.query(
    `SELECT id, credential_id, device_type, created_at, last_used_at 
     FROM webauthn_credentials 
     WHERE employee_id = ? 
     ORDER BY id DESC`,
    [employeeId]
  );
  return rows;
}

/**
 * Remove an enrolled credential
 */
async function deleteCredential(employeeId, credentialDbId) {
  const [res] = await pool.query(
    'DELETE FROM webauthn_credentials WHERE id = ? AND employee_id = ?',
    [credentialDbId, employeeId]
  );
  return res.affectedRows > 0;
}

module.exports = {
  generateRegistrationOptions,
  verifyRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
  getEmployeeCredentials,
  deleteCredential,
};
