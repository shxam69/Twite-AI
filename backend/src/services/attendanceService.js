const { pool } = require('../config/db');
const policyService = require('./policyService');
const eventService = require('./eventService');
const gpsService = require('./gpsService');
const qrService = require('./qrService');
const rewardService = require('./rewardService');

/**
 * Standard office start time fallback configuration
 */
const OFFICE_START_TIME = '09:00:00';

/**
 * Valid attendance status values
 */
const VALID_STATUSES = ['present', 'absent', 'late', 'half_day'];

/**
 * Whitelist for sortable columns
 */
const ALLOWED_SORT_COLUMNS = {
  id: 'a.id',
  attendance_date: 'a.attendance_date',
  check_in: 'a.check_in',
  check_out: 'a.check_out',
  status: 'a.status',
  verification_method: 'a.verification_method',
  created_at: 'a.created_at',
  employee_name: 'e.name',
  employee_code: 'e.employee_id',
  department: 'e.department',
};

/**
 * Helper to get current server date in YYYY-MM-DD (Asia/Kolkata IST)
 */
function getCurrentDate() {
  const d = new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

/**
 * Helper to get current server time in HH:MM:SS (Asia/Kolkata IST)
 */
function getCurrentTime() {
  const d = new Date();
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Helper to calculate duration in seconds between check_in and check_out time strings (HH:MM:SS)
 */
function getWorkedDurationInSeconds(checkInStr, checkOutStr) {
  if (!checkInStr || !checkOutStr) return 0;
  const todayStr = getCurrentDate();
  const startMs = new Date(`${todayStr}T${checkInStr}`).getTime();
  const endMs = new Date(`${todayStr}T${checkOutStr}`).getTime();
  let diffSec = Math.floor((endMs - startMs) / 1000);
  return isNaN(diffSec) || diffSec < 0 ? 0 : diffSec;
}

/**
 * Helper to verify an employee exists and return their record
 */
async function findEmployee(employeeId) {
  const [rows] = await pool.query(
    'SELECT id, employee_id, name, department, designation, status FROM employees WHERE id = ? LIMIT 1',
    [employeeId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Helper to find employee by ID or employee_id string
 */
async function findEmployeeByIdOrCode(identifier) {
  const [rows] = await pool.query(
    'SELECT id, employee_id, name, department, designation, status FROM employees WHERE id = ? OR employee_id = ? LIMIT 1',
    [identifier, identifier]
  );
  return rows.length > 0 ? rows[0] : null;
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.toString().trim().split(':').map(Number);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

/**
 * Manually mark/create an attendance record (Admin)
 */
async function markAttendance(data, adminUser = {}) {
  const {
    employee_id,
    attendance_date,
    check_in,
    check_out,
    status = 'present',
    verification_method = 'ADMIN',
    remarks,
    reason,
  } = data;

  const adminRemark = (remarks || reason || '').trim();
  if (!adminRemark) {
    const error = new Error('An administrative reason/remark is required for manual attendance override.');
    error.status = 400;
    throw error;
  }

  // 1. Verify employee exists
  const employee = await findEmployee(employee_id);
  if (!employee) {
    const error = new Error('Employee not found.');
    error.status = 404;
    await eventService.logAttendanceEvent({
      employee_id,
      event_type: 'ADMIN_ATTENDANCE_UPDATE',
      verification_method: 'ADMIN',
      metadata: {
        action: 'CREATE_FAILED',
        error: 'Employee not found',
        admin_user_id: adminUser?.id || null,
        admin_username: adminUser?.username || 'admin',
        attendance_date,
        reason: adminRemark,
        timestamp: new Date().toISOString(),
        result: 'FAILED',
      },
    });
    throw error;
  }

  // Time ordering validation if both check_in and check_out provided
  if (check_in && check_out) {
    const inSec = parseTimeToSeconds(check_in);
    const outSec = parseTimeToSeconds(check_out);
    if (outSec <= inSec) {
      const error = new Error('Check-out time must be after check-in time.');
      error.status = 400;
      throw error;
    }
  }

  // 2. Check for duplicate attendance on the same date
  const [existing] = await pool.query(
    'SELECT id FROM attendance WHERE employee_id = ? AND attendance_date = ? LIMIT 1',
    [employee_id, attendance_date]
  );

  if (existing.length > 0) {
    const error = new Error('Attendance record already exists for this employee on this date.');
    error.status = 409;
    await eventService.logAttendanceEvent({
      employee_id,
      event_type: 'ADMIN_ATTENDANCE_UPDATE',
      verification_method: 'ADMIN',
      metadata: {
        action: 'CREATE_FAILED',
        error: 'Duplicate attendance record',
        admin_user_id: adminUser?.id || null,
        admin_username: adminUser?.username || 'admin',
        employee_id: employee.id,
        employee_name: employee.name,
        attendance_date,
        reason: adminRemark,
        timestamp: new Date().toISOString(),
        result: 'FAILED',
      },
    });
    throw error;
  }

  const normMethod = 'ADMIN';

  // 3. Insert record
  const [result] = await pool.query(
    `INSERT INTO attendance (employee_id, attendance_date, check_in, check_out, status, verification_method, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      employee_id,
      attendance_date,
      check_in || null,
      check_out || null,
      status,
      normMethod,
      adminRemark,
    ]
  );

  const newRecordId = result.insertId;

  // 4. Reward points calculation if completed shift qualifies
  let rewardResult = null;
  if (check_in && check_out) {
    const workedSeconds = parseTimeToSeconds(check_out) - parseTimeToSeconds(check_in);
    if (workedSeconds > 0) {
      rewardResult = await rewardService.awardExtraHoursPoints(employee_id, newRecordId, workedSeconds);
    }
  }

  // 5. Mandatory Audit Event: ADMIN_ATTENDANCE_UPDATE
  await eventService.logAttendanceEvent({
    employee_id,
    event_type: 'ADMIN_ATTENDANCE_UPDATE',
    verification_method: 'ADMIN',
    metadata: {
      action: 'CREATE',
      attendance_id: newRecordId,
      admin_user_id: adminUser?.id || null,
      admin_username: adminUser?.username || 'admin',
      employee_id: employee.id,
      employee_name: employee.name,
      attendance_date,
      previous_values: null,
      new_values: {
        check_in: check_in || null,
        check_out: check_out || null,
        status,
        verification_method: 'ADMIN',
        remarks: adminRemark,
      },
      reason: adminRemark,
      reward_points_awarded: rewardResult?.pointsAwarded || 0,
      timestamp: new Date().toISOString(),
      result: 'SUCCESS',
    },
  });

  return getAttendanceById(newRecordId);
}

/**
 * Manually update an existing attendance record (Admin)
 */
async function updateAttendance(id, data, adminUser = {}) {
  const {
    check_in,
    check_out,
    status,
    remarks,
    reason,
  } = data;

  const adminRemark = (remarks || reason || '').trim();
  if (!adminRemark) {
    const error = new Error('An administrative reason/remark is required for manual attendance override.');
    error.status = 400;
    throw error;
  }

  // 1. Fetch existing attendance record
  const existingRecord = await getAttendanceById(id);
  if (!existingRecord) {
    const error = new Error('Attendance record not found.');
    error.status = 404;
    throw error;
  }

  const employee = await findEmployee(existingRecord.employee_id);

  // Target values
  const targetCheckIn = check_in !== undefined ? check_in : existingRecord.check_in;
  const targetCheckOut = check_out !== undefined ? check_out : existingRecord.check_out;
  const targetStatus = status ? status.trim().toLowerCase() : existingRecord.status;

  // Time ordering validation if both targetCheckIn and targetCheckOut present
  if (targetCheckIn && targetCheckOut) {
    const inSec = parseTimeToSeconds(targetCheckIn);
    const outSec = parseTimeToSeconds(targetCheckOut);
    if (outSec <= inSec) {
      const error = new Error('Check-out time must be after check-in time.');
      error.status = 400;
      throw error;
    }
  }

  const previousValues = {
    check_in: existingRecord.check_in,
    check_out: existingRecord.check_out,
    status: existingRecord.status,
    verification_method: existingRecord.verification_method,
    remarks: existingRecord.remarks,
  };

  const newValues = {
    check_in: targetCheckIn || null,
    check_out: targetCheckOut || null,
    status: targetStatus,
    verification_method: 'ADMIN',
    remarks: adminRemark,
  };

  // 2. Update record in database
  await pool.query(
    `UPDATE attendance 
     SET check_in = ?, check_out = ?, status = ?, verification_method = 'ADMIN', remarks = ?
     WHERE id = ?`,
    [
      newValues.check_in,
      newValues.check_out,
      newValues.status,
      newValues.remarks,
      id,
    ]
  );

  // 3. Reward points calculation if completed shift qualifies (idempotent ledger check)
  let rewardResult = null;
  if (newValues.check_in && newValues.check_out) {
    const workedSeconds = parseTimeToSeconds(newValues.check_out) - parseTimeToSeconds(newValues.check_in);
    if (workedSeconds > 0) {
      rewardResult = await rewardService.awardExtraHoursPoints(existingRecord.employee_id, id, workedSeconds);
    }
  }

  // 4. Mandatory Audit Event: ADMIN_ATTENDANCE_UPDATE
  await eventService.logAttendanceEvent({
    employee_id: existingRecord.employee_id,
    event_type: 'ADMIN_ATTENDANCE_UPDATE',
    verification_method: 'ADMIN',
    metadata: {
      action: 'UPDATE',
      attendance_id: id,
      admin_user_id: adminUser?.id || null,
      admin_username: adminUser?.username || 'admin',
      employee_id: existingRecord.employee_id,
      employee_name: employee?.name || existingRecord.employee_name,
      attendance_date: existingRecord.attendance_date,
      previous_values: previousValues,
      new_values: newValues,
      reason: adminRemark,
      reward_points_awarded: rewardResult?.pointsAwarded || 0,
      timestamp: new Date().toISOString(),
      result: 'SUCCESS',
    },
  });

  return getAttendanceById(id);
}

/**
 * Check-in for today's date
 */
async function checkIn(employeeId, options = {}) {
  const { verification_method = 'MANUAL', metadata = null } = options;

  // 1. Verify employee exists
  const employee = await findEmployee(employeeId);
  if (!employee) {
    const error = new Error('Employee not found.');
    error.status = 404;
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_IN_FAILED',
      verification_method,
      metadata: { reason: 'Employee not found', ...metadata },
    });
    throw error;
  }

  // 2. Inactive employees cannot check in
  if (employee.status === 'inactive') {
    const error = new Error('Cannot check in inactive employee.');
    error.status = 400;
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_IN_FAILED',
      verification_method,
      metadata: { reason: 'Employee is inactive', ...metadata },
    });
    throw error;
  }

  const today = getCurrentDate();
  const currentTime = getCurrentTime();

  // 3. Check duplicate check-in today
  const [existing] = await pool.query(
    'SELECT id FROM attendance WHERE employee_id = ? AND attendance_date = ? LIMIT 1',
    [employeeId, today]
  );

  if (existing.length > 0) {
    const error = new Error('Attendance record already exists for this employee on this date.');
    error.status = 409;
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_IN_FAILED',
      verification_method,
      metadata: { reason: 'Duplicate check-in for today', date: today, ...metadata },
    });
    throw error;
  }

  // 4. Dynamic policy lookup for office start time
  const officeStartTime = (await policyService.getPolicy('office_start_time')) || OFFICE_START_TIME;
  const initialStatus = currentTime > officeStartTime ? 'late' : 'present';

  const normMethod = ['MANUAL', 'QR', 'WEBAUTHN', 'QR_WEBAUTHN', 'AUTO_LOCATION', 'ADMIN'].includes(verification_method)
    ? verification_method
    : 'MANUAL';

  // 5. Insert check-in record
  const [result] = await pool.query(
    `INSERT INTO attendance (employee_id, attendance_date, check_in, status, verification_method)
     VALUES (?, ?, ?, ?, ?)`,
    [employeeId, today, currentTime, initialStatus, normMethod]
  );

  await eventService.logAttendanceEvent({
    employee_id: employeeId,
    event_type: 'CHECK_IN',
    verification_method: normMethod,
    metadata: { check_in_time: currentTime, status: initialStatus, ...metadata },
  });

  return getAttendanceById(result.insertId);
}

/**
 * Check-out for today's date
 */
async function checkOut(employeeId, options = {}) {
  const { verification_method = 'MANUAL', metadata = null } = options;

  // 1. Verify employee exists
  const employee = await findEmployee(employeeId);
  if (!employee) {
    const error = new Error('Employee not found.');
    error.status = 404;
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_OUT_FAILED',
      verification_method,
      metadata: { reason: 'Employee not found', ...metadata },
    });
    throw error;
  }

  const today = getCurrentDate();
  const currentTime = getCurrentTime();

  // 2. Find today's attendance record
  const [existing] = await pool.query(
    `SELECT id, employee_id, attendance_date, check_in, check_out, status 
     FROM attendance 
     WHERE employee_id = ? AND attendance_date = ? 
     LIMIT 1`,
    [employeeId, today]
  );

  if (existing.length === 0) {
    const error = new Error('No check-in record found for today. Please check in first.');
    error.status = 404;
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_OUT_FAILED',
      verification_method,
      metadata: { reason: 'No check-in record found for today', date: today, ...metadata },
    });
    throw error;
  }

  const attendanceRecord = existing[0];

  // 3. Check if already checked out
  if (attendanceRecord.check_out) {
    const error = new Error('Employee has already checked out for today.');
    error.status = 409;
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_OUT_FAILED',
      verification_method,
      metadata: { reason: 'Already checked out for today', date: today, ...metadata },
    });
    throw error;
  }

  const normMethod = ['MANUAL', 'QR', 'WEBAUTHN', 'QR_WEBAUTHN', 'AUTO_LOCATION', 'ADMIN'].includes(verification_method)
    ? verification_method
    : 'MANUAL';

  // 4. Update check_out time while preserving existing check_in and status
  await pool.query(
    'UPDATE attendance SET check_out = ?, verification_method = ? WHERE id = ?',
    [currentTime, normMethod, attendanceRecord.id]
  );

  await eventService.logAttendanceEvent({
    employee_id: employeeId,
    event_type: 'CHECK_OUT',
    verification_method: normMethod,
    metadata: { check_out_time: currentTime, ...metadata },
  });

  return getAttendanceById(attendanceRecord.id);
}

/**
 * Get paginated and filtered attendance records with employee details
 */
async function getAttendanceRecords(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const offset = (page - 1) * limit;

  const { employee_id, status, start_date, end_date, sortBy, sortOrder } = query;

  const conditions = [];
  const params = [];

  if (employee_id) {
    conditions.push('a.employee_id = ?');
    params.push(employee_id);
  }

  if (status && status.trim()) {
    conditions.push('a.status = ?');
    params.push(status.trim().toLowerCase());
  }

  if (start_date && start_date.trim()) {
    conditions.push('a.attendance_date >= ?');
    params.push(start_date.trim());
  }

  if (end_date && end_date.trim()) {
    conditions.push('a.attendance_date <= ?');
    params.push(end_date.trim());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Safe sorting
  const safeSortBy = ALLOWED_SORT_COLUMNS[sortBy] || 'a.attendance_date';
  const safeSortOrder = sortOrder && sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Count total records
  const countSql = `
    SELECT COUNT(*) AS total 
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    ${whereClause}
  `;
  const [countResult] = await pool.query(countSql, params);
  const total = countResult[0].total;
  const totalPages = Math.ceil(total / limit) || 1;

  // Retrieve paginated records
  const dataSql = `
    SELECT 
      a.id,
      a.employee_id,
      e.employee_id AS employee_code,
      e.name AS employee_name,
      e.department,
      e.designation,
      e.status AS employee_status,
      DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
      a.check_in,
      a.check_out,
      a.status,
      a.verification_method,
      a.remarks,
      a.created_at,
      a.updated_at
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    ${whereClause}
    ORDER BY ${safeSortBy} ${safeSortOrder}
    LIMIT ? OFFSET ?
  `;

  const [records] = await pool.query(dataSql, [...params, limit, offset]);

  return {
    records,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Get a single attendance record by ID with employee details
 */
async function getAttendanceById(id) {
  const [rows] = await pool.query(
    `SELECT 
      a.id,
      a.employee_id,
      e.employee_id AS employee_code,
      e.name AS employee_name,
      e.department,
      e.designation,
      e.status AS employee_status,
      DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
      a.check_in,
      a.check_out,
      a.status,
      a.verification_method,
      a.remarks,
      a.created_at,
      a.updated_at
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.id = ?
    LIMIT 1`,
    [id]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update remarks on an attendance record (Admin only)
 */
async function updateAttendanceRemark(id, remark, adminUserId) {
  const record = await getAttendanceById(id);
  if (!record) {
    const error = new Error('Attendance record not found.');
    error.status = 404;
    throw error;
  }

  const trimmedRemark = (remark || '').trim();

  await pool.query(
    `UPDATE attendance SET remarks = ? WHERE id = ?`,
    [trimmedRemark, id]
  );

  await eventService.logAttendanceEvent({
    employee_id: record.employee_id,
    event_type: 'ADMIN_ATTENDANCE_UPDATE',
    verification_method: 'ADMIN',
    metadata: {
      attendance_id: id,
      action: 'UPDATE_REMARK',
      remark: trimmedRemark,
      updated_by_user_id: adminUserId,
    },
  });

  return await getAttendanceById(id);
}


/**
 * Get attendance history for a specific employee
 */
async function getEmployeeAttendanceHistory(employeeId, query) {
  // 1. Verify employee exists (supports ID or employee_id string)
  const employee = await findEmployeeByIdOrCode(employeeId);
  if (!employee) {
    const error = new Error('Employee not found.');
    error.status = 404;
    throw error;
  }

  // 2. Delegate to getAttendanceRecords with fixed employee_id
  return getAttendanceRecords({
    ...query,
    employee_id: employee.id,
  });
}

/**
 * Calculate attendance summary statistics
 */
async function getAttendanceSummary(query) {
  const { start_date, end_date, employee_id } = query;

  const conditions = [];
  const params = [];

  if (employee_id) {
    const employee = await findEmployeeByIdOrCode(employee_id);
    if (!employee) {
      const error = new Error('Employee not found.');
      error.status = 404;
      throw error;
    }
    conditions.push('employee_id = ?');
    params.push(employee.id);
  }

  if (start_date && start_date.trim()) {
    conditions.push('attendance_date >= ?');
    params.push(start_date.trim());
  }

  if (end_date && end_date.trim()) {
    conditions.push('attendance_date <= ?');
    params.push(end_date.trim());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      COUNT(*) AS total_records,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late_count,
      SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) AS half_day_count
    FROM attendance
    ${whereClause}
  `;

  const [rows] = await pool.query(sql, params);
  const row = rows[0] || {};

  const total_records = Number(row.total_records) || 0;
  const present_count = Number(row.present_count) || 0;
  const absent_count = Number(row.absent_count) || 0;
  const late_count = Number(row.late_count) || 0;
  const half_day_count = Number(row.half_day_count) || 0;

  // Calculate attendance percentage: (present + late + half_day) / total_records * 100
  let attendance_percentage = 0;
  if (total_records > 0) {
    const attendedDays = present_count + late_count + half_day_count;
    attendance_percentage = Number(((attendedDays / total_records) * 100).toFixed(2));
  }

  return {
    total_records,
    present_count,
    absent_count,
    late_count,
    half_day_count,
    attendance_percentage,
  };
}

/**
 * Dynamic Rotating QR Check-in with GPS Geofencing (Employee)
 */
async function checkInWithQr(employeeId, rawToken, latitude, longitude, verificationMethod = 'QR') {
  // 1. Verify employee exists
  const employee = await findEmployee(employeeId);
  if (!employee) {
    const error = new Error('Employee not found.');
    error.status = 404;
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_IN_FAILED',
      verification_method: verificationMethod,
      metadata: { reason: 'Employee not found' },
    });
    throw error;
  }

  // 2. Inactive employees cannot check in
  if (employee.status === 'inactive') {
    const error = new Error('Cannot check in inactive employee.');
    error.status = 400;
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_IN_FAILED',
      verification_method: verificationMethod,
      metadata: { reason: 'Employee is inactive' },
    });
    throw error;
  }

  const today = getCurrentDate();
  const currentTime = getCurrentTime();

  // 3. Obtain connection and begin MySQL transaction
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  let challengeId = null;
  let distanceMeters = null;

  try {
    // 4. Check duplicate check-in today
    const [existing] = await connection.query(
      'SELECT id FROM attendance WHERE employee_id = ? AND attendance_date = ? LIMIT 1',
      [employeeId, today]
    );

    if (existing.length > 0) {
      const error = new Error('Attendance record already exists for this employee on this date.');
      error.status = 409;
      throw error;
    }

    // 5. Authoritative GPS geofence verification
    const gpsResult = await gpsService.verifyWorkplaceGeofence(latitude, longitude);
    distanceMeters = gpsResult.distanceMeters;

    // 6. Authoritative QR token validation and per-employee usage recording inside transaction
    const qrResult = await qrService.validateAndConsumeChallengeForEmployee(rawToken, employeeId, 'CHECK_IN', connection);
    challengeId = qrResult.challenge_id;

    // 7. Calculate status based on office_start_time policy
    const officeStartTime = (await policyService.getPolicy('office_start_time')) || OFFICE_START_TIME;
    const initialStatus = currentTime > officeStartTime ? 'late' : 'present';

    // 8. Insert attendance record with verification_method ('QR' or 'QR_WEBAUTHN')
    const finalMethod = ['QR', 'QR_WEBAUTHN'].includes(verificationMethod) ? verificationMethod : 'QR';
    const [insertResult] = await connection.query(
      `INSERT INTO attendance (employee_id, attendance_date, check_in, status, verification_method)
       VALUES (?, ?, ?, ?, ?)`,
      [employeeId, today, currentTime, initialStatus, finalMethod]
    );

    // Commit transaction
    await connection.commit();

    // 9. Non-blocking audit event
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_IN',
      verification_method: finalMethod,
      metadata: {
        challenge_id: challengeId,
        distance_meters: distanceMeters,
        location_verified: true,
        check_in_time: currentTime,
        status: initialStatus,
      },
    });

    return getAttendanceById(insertResult.insertId);
  } catch (error) {
    await connection.rollback();

    // Log failure event non-blockingly
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_IN_FAILED',
      verification_method: 'QR',
      metadata: {
        reason: error.message || 'QR Check-in failed',
        challenge_id: challengeId || undefined,
        distance_meters: distanceMeters || undefined,
      },
    });

    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Dynamic Rotating QR Check-out with GPS Geofencing (Employee)
 */
async function checkOutWithQr(employeeId, rawToken, latitude, longitude, verificationMethod = 'QR') {
  // 1. Verify employee exists
  const employee = await findEmployee(employeeId);
  if (!employee) {
    const error = new Error('Employee not found.');
    error.status = 404;
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_OUT_FAILED',
      verification_method: verificationMethod,
      metadata: { reason: 'Employee not found' },
    });
    throw error;
  }

  // 2. Inactive employees cannot check out
  if (employee.status === 'inactive') {
    const error = new Error('Cannot process check-out for inactive employee.');
    error.status = 400;
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_OUT_FAILED',
      verification_method: verificationMethod,
      metadata: { reason: 'Employee is inactive' },
    });
    throw error;
  }

  const today = getCurrentDate();
  const currentTime = getCurrentTime();

  // 3. Obtain connection and begin MySQL transaction
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  let challengeId = null;
  let distanceMeters = null;

  try {
    // 4. Find today's attendance record
    const [records] = await connection.query(
      'SELECT id, check_in, check_out FROM attendance WHERE employee_id = ? AND attendance_date = ? FOR UPDATE',
      [employeeId, today]
    );

    if (records.length === 0) {
      const error = new Error('No check-in record found for today. You must check in first before checking out.');
      error.status = 400;
      throw error;
    }

    const attendance = records[0];

    // Already checked out check
    if (attendance.check_out) {
      const error = new Error('Employee has already checked out today.');
      error.status = 400;
      throw error;
    }

    // 5. Authoritative GPS geofence verification
    const gpsResult = await gpsService.verifyWorkplaceGeofence(latitude, longitude);
    distanceMeters = gpsResult.distanceMeters;

    // 6. Authoritative QR token validation and per-employee usage recording inside transaction
    const qrResult = await qrService.validateAndConsumeChallengeForEmployee(rawToken, employeeId, 'CHECK_OUT', connection);
    challengeId = qrResult.challenge_id;

    // 7. Enforce minimum working hours policy before check-out
    const minHoursStr = await policyService.getPolicy('minimum_checkout_hours');
    const minHours = minHoursStr !== null && minHoursStr !== undefined ? parseFloat(minHoursStr) : 4;
    const workedSeconds = getWorkedDurationInSeconds(attendance.check_in, currentTime);

    if (minHours > 0 && workedSeconds < minHours * 3600) {
      const workedHoursFormatted = (workedSeconds / 3600).toFixed(1);
      const error = new Error(
        `Minimum working duration of ${minHours} hours required before check-out. Current duration: ${workedHoursFormatted} hours.`
      );
      error.status = 400;
      throw error;
    }

    // 8. Update attendance record with check_out time & method
    const finalMethod = ['QR', 'QR_WEBAUTHN'].includes(verificationMethod) ? verificationMethod : 'QR';
    await connection.query(
      `UPDATE attendance SET check_out = ?, verification_method = ? WHERE id = ?`,
      [currentTime, finalMethod, attendance.id]
    );

    // 9. Transactional Extra Hours Reward Calculation & Ledger Insertion
    const rewardResult = await rewardService.awardExtraHoursPoints(
      employeeId,
      attendance.id,
      workedSeconds,
      connection
    );

    // Commit transaction
    await connection.commit();

    // 10. Non-blocking audit event
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_OUT',
      verification_method: finalMethod,
      metadata: {
        challenge_id: challengeId,
        distance_meters: distanceMeters,
        location_verified: true,
        check_out_time: currentTime,
        worked_seconds: workedSeconds,
        extra_hours: rewardResult.extraHours || 0,
        points_awarded: rewardResult.pointsAwarded || 0,
      },
    });

    const record = await getAttendanceById(attendance.id);
    return {
      ...record,
      worked_hours: (workedSeconds / 3600).toFixed(2),
      extra_hours: rewardResult.extraHours || 0,
      points_awarded: rewardResult.pointsAwarded || 0,
    };
  } catch (error) {
    await connection.rollback();

    // Log failure event non-blockingly
    await eventService.logAttendanceEvent({
      employee_id: employeeId,
      event_type: 'CHECK_OUT_FAILED',
      verification_method: 'QR',
      metadata: {
        reason: error.message || 'QR Check-out failed',
        challenge_id: challengeId || undefined,
        distance_meters: distanceMeters || undefined,
      },
    });

    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  OFFICE_START_TIME,
  VALID_STATUSES,
  findEmployeeByIdOrCode,
  markAttendance,
  updateAttendance,
  checkIn,
  checkOut,
  checkInWithQr,
  checkOutWithQr,
  getAttendanceRecords,
  getAttendanceById,
  updateAttendanceRemark,
  getEmployeeAttendanceHistory,
  getAttendanceSummary,
};
