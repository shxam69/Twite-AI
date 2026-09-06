const { pool } = require('../config/db');

const SENSITIVE_KEYS = [
  'password',
  'token',
  'jwt',
  'authorization',
  'secret',
  'biometric',
  'fingerprint',
  'face_data',
  'access_token',
  'refresh_token',
];

const VALID_EVENT_TYPES = [
  'CHECK_IN',
  'CHECK_OUT',
  'CHECK_IN_FAILED',
  'CHECK_OUT_FAILED',
  'VERIFICATION_SUCCESS',
  'VERIFICATION_FAILED',
  'ADMIN_ATTENDANCE_UPDATE',
];

const VALID_VERIFICATION_METHODS = [
  'MANUAL',
  'QR',
  'WEBAUTHN',
  'QR_WEBAUTHN',
  'AUTO_LOCATION',
  'ADMIN',
];

/**
 * Recursively sanitize metadata to remove sensitive credentials, secrets, and raw biometric data
 */
function sanitizeMetadata(data) {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeMetadata(item));
  }

  const sanitized = {};
  for (const [key, val] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEYS.some((sKey) => key.toLowerCase().includes(sKey.toLowerCase()));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeMetadata(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

/**
 * Log an attendance audit event securely with parameterized SQL and metadata sanitization
 */
async function logAttendanceEvent({
  employee_id,
  event_type,
  verification_method = 'MANUAL',
  metadata = null,
}) {
  try {
    if (!employee_id || isNaN(parseInt(employee_id, 10))) {
      throw new Error('Valid employee_id is required for audit event logging.');
    }

    if (!VALID_EVENT_TYPES.includes(event_type)) {
      throw new Error(`Invalid event_type: ${event_type}`);
    }

    const normMethod = VALID_VERIFICATION_METHODS.includes(verification_method)
      ? verification_method
      : 'MANUAL';

    const safeMetadata = metadata ? JSON.stringify(sanitizeMetadata(metadata)) : null;

    const [result] = await pool.query(
      `INSERT INTO attendance_events (employee_id, event_type, verification_method, metadata)
       VALUES (?, ?, ?, ?)`,
      [parseInt(employee_id, 10), event_type, normMethod, safeMetadata]
    );

    return result.insertId;
  } catch (error) {
    // Log server error internally but do not crash callers unless intended
    console.error('Audit event logging failure:', error.message);
    return null;
  }
}

/**
 * Get paginated attendance audit events with optional filters (Admin only)
 */
async function getAttendanceEvents(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const offset = (page - 1) * limit;

  const { employee_id, event_type, start_date, end_date } = query;
  const conditions = [];
  const params = [];

  if (employee_id && !isNaN(parseInt(employee_id, 10))) {
    conditions.push('ev.employee_id = ?');
    params.push(parseInt(employee_id, 10));
  }

  if (event_type && VALID_EVENT_TYPES.includes(event_type.trim())) {
    conditions.push('ev.event_type = ?');
    params.push(event_type.trim());
  }

  if (start_date && start_date.trim()) {
    conditions.push('ev.created_at >= ?');
    params.push(`${start_date.trim()} 00:00:00`);
  }

  if (end_date && end_date.trim()) {
    conditions.push('ev.created_at <= ?');
    params.push(`${end_date.trim()} 23:59:59`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count query
  const countSql = `
    SELECT COUNT(*) AS total 
    FROM attendance_events ev
    JOIN employees e ON ev.employee_id = e.id
    ${whereClause}
  `;
  const [countRes] = await pool.query(countSql, params);
  const total = countRes[0]?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // Data query
  const dataSql = `
    SELECT 
      ev.id,
      ev.employee_id,
      e.employee_id AS employee_code,
      e.name AS employee_name,
      ev.event_type,
      ev.verification_method,
      ev.metadata,
      DATE_FORMAT(ev.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM attendance_events ev
    JOIN employees e ON ev.employee_id = e.id
    ${whereClause}
    ORDER BY ev.created_at DESC, ev.id DESC
    LIMIT ? OFFSET ?
  `;

  const [records] = await pool.query(dataSql, [...params, limit, offset]);

  // Parse JSON metadata safely
  const formattedRecords = records.map((r) => ({
    ...r,
    metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
  }));

  return {
    records: formattedRecords,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

module.exports = {
  SENSITIVE_KEYS,
  VALID_EVENT_TYPES,
  VALID_VERIFICATION_METHODS,
  sanitizeMetadata,
  logAttendanceEvent,
  getAttendanceEvents,
};
