const { pool } = require('../config/db');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

const DEFAULT_POLICIES = {
  office_start_time: '09:00:00',
  minimum_checkout_hours: '4',
  workplace_radius_meters: '100',
  workplace_latitude: '',
  workplace_longitude: '',
  qr_validity_seconds: '30',
  auto_checkout_enabled: 'false',
  grace_period_minutes: '15',
  temporary_exit_enabled: 'true',
  monthly_exit_allowance: '2',
};

// In-memory cache for fast lookups
let policyCache = {};
let lastCacheTime = 0;
const CACHE_TTL_MS = 60000; // 60 seconds

/**
 * Validate policy key and value format
 */
function validatePolicyKeyValue(key, value) {
  const normKey = key ? key.trim() : '';
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_POLICIES, normKey)) {
    const error = new Error(`Unsupported policy key: '${key}'.`);
    error.status = 400;
    throw error;
  }

  const strVal = String(value !== undefined && value !== null ? value : '').trim();

  if (normKey === 'office_start_time') {
    if (!TIME_REGEX.test(strVal)) {
      const error = new Error('office_start_time must be a valid time in HH:MM:SS format.');
      error.status = 400;
      throw error;
    }
  } else if (normKey === 'auto_checkout_enabled' || normKey === 'temporary_exit_enabled') {
    const lowerVal = strVal.toLowerCase();
    if (lowerVal !== 'true' && lowerVal !== 'false') {
      const error = new Error(`${normKey} must be a boolean string ('true' or 'false').`);
      error.status = 400;
      throw error;
    }
  } else if (normKey === 'workplace_latitude') {
    if (strVal !== '') {
      const num = Number(strVal);
      if (isNaN(num) || num < -90 || num > 90) {
        const error = new Error('workplace_latitude must be a valid latitude between -90 and 90.');
        error.status = 400;
        throw error;
      }
    }
  } else if (normKey === 'workplace_longitude') {
    if (strVal !== '') {
      const num = Number(strVal);
      if (isNaN(num) || num < -180 || num > 180) {
        const error = new Error('workplace_longitude must be a valid longitude between -180 and 180.');
        error.status = 400;
        throw error;
      }
    }
  } else {
    const num = Number(strVal);
    if (isNaN(num) || num < 0) {
      const error = new Error(`${normKey} must be a non-negative number.`);
      error.status = 400;
      throw error;
    }
  }

  return { key: normKey, value: strVal };
}

/**
 * Retrieve a single policy value by key (with fallback)
 */
async function getPolicy(key) {
  const normKey = key ? key.trim() : '';
  if (!normKey) return null;

  // Check cache first
  const now = Date.now();
  if (policyCache[normKey] && now - lastCacheTime < CACHE_TTL_MS) {
    return policyCache[normKey];
  }

  try {
    const [rows] = await pool.query(
      'SELECT policy_value FROM attendance_policies WHERE policy_key = ? LIMIT 1',
      [normKey]
    );

    if (rows.length > 0) {
      const val = rows[0].policy_value;
      policyCache[normKey] = val;
      return val;
    }
  } catch (err) {
    console.error(`Error fetching policy '${normKey}':`, err.message);
  }

  // Fallback to default
  return DEFAULT_POLICIES[normKey] || null;
}

/**
 * Retrieve all policy configuration key-value pairs
 */
async function getAllPolicies() {
  try {
    const [rows] = await pool.query(
      'SELECT policy_key, policy_value, description, updated_at FROM attendance_policies ORDER BY id ASC'
    );

    const dbMap = {};
    rows.forEach((r) => {
      dbMap[r.policy_key] = {
        key: r.policy_key,
        value: r.policy_value,
        description: r.description,
        updated_at: r.updated_at,
      };
      policyCache[r.policy_key] = r.policy_value;
    });

    lastCacheTime = Date.now();

    // Fill missing defaults if any
    Object.keys(DEFAULT_POLICIES).forEach((k) => {
      if (!dbMap[k]) {
        dbMap[k] = {
          key: k,
          value: DEFAULT_POLICIES[k],
          description: 'Default system policy',
          updated_at: null,
        };
      }
    });

    return Object.values(dbMap);
  } catch (err) {
    console.error('Error fetching all policies:', err.message);
    return Object.entries(DEFAULT_POLICIES).map(([k, v]) => ({
      key: k,
      value: v,
      description: 'Default system policy (fallback)',
      updated_at: null,
    }));
  }
}

/**
 * Update a policy key-value setting (Admin only logic)
 */
async function updatePolicy(key, value) {
  const { key: validKey, value: validValue } = validatePolicyKeyValue(key, value);

  await pool.query(
    `INSERT INTO attendance_policies (policy_key, policy_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE policy_value = VALUES(policy_value), updated_at = CURRENT_TIMESTAMP`,
    [validKey, validValue]
  );

  // Invalidate & update cache
  policyCache[validKey] = validValue;
  lastCacheTime = Date.now();

  const [updatedRows] = await pool.query(
    'SELECT policy_key, policy_value, description, updated_at FROM attendance_policies WHERE policy_key = ? LIMIT 1',
    [validKey]
  );

  return updatedRows[0];
}

module.exports = {
  DEFAULT_POLICIES,
  validatePolicyKeyValue,
  getPolicy,
  getAllPolicies,
  updatePolicy,
};
