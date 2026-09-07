const webauthnService = require('../services/webauthnService');
const eventService = require('../services/eventService');

async function getRegistrationOptions(req, res, next) {
  try {
    const employeeId = req.user.role === 'employee' ? req.user.employee_id : (req.query.employee_id || req.user.employee_id);
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Valid employee record required for WebAuthn.' });
    }

    const options = await webauthnService.generateRegistrationOptions(employeeId, req.user);
    return res.status(200).json({ success: true, data: options });
  } catch (err) {
    next(err);
  }
}

async function verifyRegistrationResponse(req, res, next) {
  try {
    const employeeId = req.user.role === 'employee' ? req.user.employee_id : (req.body.employee_id || req.user.employee_id);
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Valid employee record required for WebAuthn.' });
    }

    const { sessionKey, credentialResponse } = req.body;
    if (!sessionKey || !credentialResponse) {
      return res.status(400).json({ success: false, message: 'sessionKey and credentialResponse are required.' });
    }

    const result = await webauthnService.verifyRegistration(employeeId, sessionKey, credentialResponse);
    return res.status(200).json({ success: true, message: 'Platform authenticator registered successfully.', data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

async function getAuthenticationOptions(req, res, next) {
  try {
    const employeeId = req.user?.role === 'employee' ? req.user.employee_id : (req.query.employee_id ? parseInt(req.query.employee_id, 10) : null);
    const options = await webauthnService.generateAuthenticationOptions(employeeId);
    return res.status(200).json({ success: true, data: options });
  } catch (err) {
    next(err);
  }
}

async function verifyAuthenticationResponse(req, res, next) {
  try {
    const employeeId = req.user?.role === 'employee' ? req.user.employee_id : (req.body.employee_id ? parseInt(req.body.employee_id, 10) : null);
    const { sessionKey, assertionResponse } = req.body;
    if (!sessionKey || !assertionResponse) {
      return res.status(400).json({ success: false, message: 'sessionKey and assertionResponse are required.' });
    }

    const result = await webauthnService.verifyAuthentication(employeeId, sessionKey, assertionResponse);
    return res.status(200).json({ success: true, message: 'WebAuthn assertion verified.', data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

async function listCredentials(req, res, next) {
  try {
    const employeeId = req.user.role === 'employee' ? req.user.employee_id : (req.query.employee_id || req.user.employee_id);
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Valid employee record required.' });
    }

    const creds = await webauthnService.getEmployeeCredentials(employeeId);
    return res.status(200).json({ success: true, data: creds });
  } catch (err) {
    next(err);
  }
}

async function removeCredential(req, res, next) {
  try {
    const employeeId = req.user.role === 'employee' ? req.user.employee_id : req.user.employee_id;
    const credentialId = parseInt(req.params.id, 10);
    const success = await webauthnService.deleteCredential(employeeId, credentialId);
    return res.status(200).json({ success, message: success ? 'Credential removed.' : 'Credential not found.' });
  } catch (err) {
    next(err);
  }
}

async function logWebAuthnStatus(req, res, next) {
  try {
    const employeeId = req.user?.employee_id;
    const { status, reason } = req.body;
    // status can be WEBAUTHN_UNAVAILABLE, WEBAUTHN_CANCELLED, WEBAUTHN_FAILED
    if (employeeId) {
      await eventService.logAttendanceEvent({
        employee_id: employeeId,
        event_type: status === 'WEBAUTHN_UNAVAILABLE' ? 'VERIFICATION_SUCCESS' : 'VERIFICATION_FAILED',
        verification_method: 'WEBAUTHN',
        metadata: {
          client_status: status,
          reason: reason || 'Platform authenticator client report',
        },
      });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRegistrationOptions,
  verifyRegistrationResponse,
  getAuthenticationOptions,
  verifyAuthenticationResponse,
  listCredentials,
  removeCredential,
  logWebAuthnStatus,
};
