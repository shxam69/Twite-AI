const policyService = require('../services/policyService');

/**
 * @desc    Get all attendance policies (Admin only)
 * @route   GET /api/attendance/policies
 * @access  Private (Admin)
 */
async function getAllPolicies(req, res, next) {
  try {
    const policies = await policyService.getAllPolicies();
    return res.status(200).json({
      success: true,
      data: policies,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Update a specific attendance policy key (Admin only)
 * @route   PUT /api/attendance/policies/:key
 * @access  Private (Admin)
 */
async function updatePolicy(req, res, next) {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({
        success: false,
        message: 'A valid policy value is required in request body.',
      });
    }

    const updated = await policyService.updatePolicy(key, value);

    return res.status(200).json({
      success: true,
      message: `Policy '${key}' updated successfully.`,
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

module.exports = {
  getAllPolicies,
  updatePolicy,
};
