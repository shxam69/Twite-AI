const attendanceService = require('../services/attendanceService');
const eventService = require('../services/eventService');
const exportService = require('../services/exportService');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

/**
 * Helper to validate date string
 */
function isValidDateString(dateStr) {
  if (!DATE_REGEX.test(dateStr)) return false;
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * @desc    Manually create/mark an attendance record (Admin)
 * @route   POST /api/attendance
 * @access  Private (Admin)
 */
async function markAttendance(req, res, next) {
  try {
    const { employee_id, attendance_date, check_in, check_out, status } = req.body;

    // Validate employee_id
    if (!employee_id || isNaN(parseInt(employee_id, 10))) {
      return res.status(400).json({
        success: false,
        message: 'A valid employee_id is required.',
      });
    }

    // Validate attendance_date
    if (!attendance_date || !isValidDateString(attendance_date.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid attendance_date (YYYY-MM-DD) is required.',
      });
    }

    // Validate time formats if provided
    if (check_in && !TIME_REGEX.test(check_in.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid check_in time format. Expected HH:MM:SS.',
      });
    }

    if (check_out && !TIME_REGEX.test(check_out.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid check_out time format. Expected HH:MM:SS.',
      });
    }

    // Validate status if provided
    const targetStatus = status ? status.trim().toLowerCase() : 'present';
    if (!attendanceService.VALID_STATUSES.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${attendanceService.VALID_STATUSES.join(', ')}.`,
      });
    }

    const record = await attendanceService.markAttendance({
      employee_id: parseInt(employee_id, 10),
      attendance_date: attendance_date.trim(),
      check_in: check_in ? check_in.trim() : null,
      check_out: check_out ? check_out.trim() : null,
      status: targetStatus,
    });

    return res.status(201).json({
      success: true,
      message: 'Attendance marked successfully.',
      data: record,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Attendance record already exists for this employee on this date.',
      });
    }
    next(error);
  }
}

/**
 * @desc    Quick check-in for today's date
 * @route   POST /api/attendance/check-in
 * @access  Private (Admin / Authenticated)
 */
async function checkIn(req, res, next) {
  try {
    let targetEmployeeId;

    if (req.user.role === 'employee') {
      if (!req.user.employee_id) {
        return res.status(400).json({
          success: false,
          message: 'User account is not linked to an employee record.',
        });
      }
      targetEmployeeId = req.user.employee_id;
    } else {
      const { employee_id } = req.body;
      if (!employee_id || isNaN(parseInt(employee_id, 10))) {
        return res.status(400).json({
          success: false,
          message: 'A valid employee_id is required.',
        });
      }
      targetEmployeeId = parseInt(employee_id, 10);
    }

    const record = await attendanceService.checkIn(targetEmployeeId);

    return res.status(201).json({
      success: true,
      message: 'Check-in recorded successfully.',
      data: record,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Attendance record already exists for this employee on this date.',
      });
    }
    next(error);
  }
}

/**
 * @desc    Quick check-out for today's date
 * @route   POST /api/attendance/check-out
 * @access  Private (Admin / Authenticated)
 */
async function checkOut(req, res, next) {
  try {
    let targetEmployeeId;

    if (req.user.role === 'employee') {
      if (!req.user.employee_id) {
        return res.status(400).json({
          success: false,
          message: 'User account is not linked to an employee record.',
        });
      }
      targetEmployeeId = req.user.employee_id;
    } else {
      const { employee_id } = req.body;
      if (!employee_id || isNaN(parseInt(employee_id, 10))) {
        return res.status(400).json({
          success: false,
          message: 'A valid employee_id is required.',
        });
      }
      targetEmployeeId = parseInt(employee_id, 10);
    }

    const record = await attendanceService.checkOut(targetEmployeeId);

    return res.status(200).json({
      success: true,
      message: 'Check-out recorded successfully.',
      data: record,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * @desc    Get paginated, filtered, and sorted attendance records
 * @route   GET /api/attendance
 * @access  Private (Authenticated)
 */
async function getAttendanceRecords(req, res, next) {
  try {
    const queryParams = { ...req.query };

    // RBAC: Employees only see their own attendance records
    if (req.user.role === 'employee') {
      if (!req.user.employee_id) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        });
      }
      queryParams.employee_id = req.user.employee_id;
    }

    const { start_date, end_date, status, employee_id } = queryParams;

    if (start_date && !isValidDateString(start_date.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start_date format. Expected YYYY-MM-DD.',
      });
    }

    if (end_date && !isValidDateString(end_date.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid end_date format. Expected YYYY-MM-DD.',
      });
    }

    if (start_date && end_date && start_date.trim() > end_date.trim()) {
      return res.status(400).json({
        success: false,
        message: 'end_date cannot be before start_date.',
      });
    }

    if (status && !attendanceService.VALID_STATUSES.includes(status.trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${attendanceService.VALID_STATUSES.join(', ')}.`,
      });
    }

    if (employee_id && isNaN(parseInt(employee_id, 10))) {
      return res.status(400).json({
        success: false,
        message: 'employee_id must be a valid integer.',
      });
    }

    const result = await attendanceService.getAttendanceRecords(queryParams);

    return res.status(200).json({
      success: true,
      data: result.records,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get attendance record by ID
 * @route   GET /api/attendance/:id
 * @access  Private (Authenticated)
 */
async function getAttendanceById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance ID.',
      });
    }

    const record = await attendanceService.getAttendanceById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found.',
      });
    }

    // RBAC: Employees can only view their own attendance record
    if (req.user.role === 'employee' && record.employee_id !== req.user.employee_id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to view another employee\'s attendance record.',
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get attendance history for an individual employee
 * @route   GET /api/attendance/employee/:employeeId
 * @access  Private (Authenticated)
 */
async function getEmployeeAttendanceHistory(req, res, next) {
  try {
    const { employeeId } = req.params;

    // RBAC: Employee users can only view their own history
    if (req.user.role === 'employee') {
      const empRecord = await attendanceService.findEmployeeByIdOrCode(employeeId);
      if (!empRecord || empRecord.id !== req.user.employee_id) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. You do not have permission to view another employee\'s attendance history.',
        });
      }
    }

    const { start_date, end_date, status } = req.query;

    if (start_date && !isValidDateString(start_date.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start_date format. Expected YYYY-MM-DD.',
      });
    }

    if (end_date && !isValidDateString(end_date.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid end_date format. Expected YYYY-MM-DD.',
      });
    }

    if (start_date && end_date && start_date.trim() > end_date.trim()) {
      return res.status(400).json({
        success: false,
        message: 'end_date cannot be before start_date.',
      });
    }

    if (status && !attendanceService.VALID_STATUSES.includes(status.trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${attendanceService.VALID_STATUSES.join(', ')}.`,
      });
    }

    const result = await attendanceService.getEmployeeAttendanceHistory(employeeId, req.query);

    return res.status(200).json({
      success: true,
      data: result.records,
      pagination: result.pagination,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * @desc    Get attendance summary statistics
 * @route   GET /api/attendance/summary
 * @access  Private (Authenticated)
 */
async function getAttendanceSummary(req, res, next) {
  try {
    const queryParams = { ...req.query };

    // RBAC: Employee users get summary strictly for themselves
    if (req.user.role === 'employee') {
      if (!req.user.employee_id) {
        return res.status(200).json({
          success: true,
          data: {
            total_records: 0,
            present_count: 0,
            absent_count: 0,
            late_count: 0,
            half_day_count: 0,
            attendance_percentage: 0,
          },
        });
      }
      queryParams.employee_id = req.user.employee_id;
    }

    const { start_date, end_date } = queryParams;

    if (start_date && !isValidDateString(start_date.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start_date format. Expected YYYY-MM-DD.',
      });
    }

    if (end_date && !isValidDateString(end_date.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid end_date format. Expected YYYY-MM-DD.',
      });
    }

    if (start_date && end_date && start_date.trim() > end_date.trim()) {
      return res.status(400).json({
        success: false,
        message: 'end_date cannot be before start_date.',
      });
    }

    const summary = await attendanceService.getAttendanceSummary(queryParams);

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * @desc    Get paginated attendance audit events (Admin only)
 * @route   GET /api/attendance/events
 * @access  Private (Admin)
 */
async function getAttendanceEvents(req, res, next) {
  try {
    const result = await eventService.getAttendanceEvents(req.query);
    return res.status(200).json({
      success: true,
      data: result.records,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Update remark on attendance record (Admin only)
 * @route   PUT /api/attendance/:id/remark
 * @access  Private (Admin)
 */
async function updateAttendanceRemark(req, res, next) {
  try {
    const { id } = req.params;
    const { remark } = req.body;
    const adminUserId = req.user.id;

    const updated = await attendanceService.updateAttendanceRemark(id, remark, adminUserId);
    return res.status(200).json({
      success: true,
      message: 'Attendance remark updated successfully.',
      data: updated,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * @desc    Export attendance report as CSV (Admin only)
 * @route   GET /api/attendance/export
 * @access  Private (Admin)
 */
async function exportAttendance(req, res, next) {
  try {
    const csvData = await exportService.generateAttendanceCsv(req.query);
    const timestamp = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${timestamp}.csv"`);
    return res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  markAttendance,
  checkIn,
  checkOut,
  getAttendanceRecords,
  getAttendanceById,
  updateAttendanceRemark,
  getEmployeeAttendanceHistory,
  getAttendanceSummary,
  getAttendanceEvents,
  exportAttendance,
};

