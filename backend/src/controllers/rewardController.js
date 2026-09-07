const rewardService = require('../services/rewardService');

async function getMyAccount(req, res, next) {
  try {
    if (req.user.role === 'employee' && !req.user.employee_id) {
      return res.status(400).json({ success: false, message: 'User account is not linked to an employee record.' });
    }
    const employeeId = req.user.role === 'employee' ? req.user.employee_id : (req.query.employee_id || req.user.employee_id);
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Valid employee_id required.' });
    }

    const data = await rewardService.getEmployeeRewardAccount(employeeId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getCatalog(req, res, next) {
  try {
    const includeInactive = req.user.role === 'admin' && req.query.includeInactive === 'true';
    const catalog = await rewardService.getRewardsCatalog(includeInactive);
    return res.status(200).json({ success: true, data: catalog });
  } catch (err) {
    next(err);
  }
}

async function createRewardItem(req, res, next) {
  try {
    const reward = await rewardService.createReward(req.body);
    return res.status(201).json({ success: true, message: 'Reward item created.', data: reward });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

async function updateRewardItem(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await rewardService.updateReward(id, req.body);
    return res.status(200).json({ success: true, message: 'Reward item updated.', data: updated });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

async function redeemRewardItem(req, res, next) {
  try {
    if (req.user.role === 'employee' && !req.user.employee_id) {
      return res.status(400).json({ success: false, message: 'User account is not linked to an employee record.' });
    }
    const employeeId = req.user.role === 'employee' ? req.user.employee_id : (req.body.employee_id || req.user.employee_id);
    const { reward_id } = req.body;

    if (!reward_id) {
      return res.status(400).json({ success: false, message: 'reward_id is required.' });
    }

    const result = await rewardService.redeemReward(employeeId, parseInt(reward_id, 10));
    return res.status(201).json({ success: true, message: 'Reward redeemed successfully.', data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

async function getRedemptions(req, res, next) {
  try {
    const statusFilter = req.query.status;
    const list = await rewardService.getRedemptions(statusFilter);
    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
}

async function updateRedemption(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    const result = await rewardService.updateRedemptionStatus(id, status);
    return res.status(200).json({ success: true, message: 'Redemption status updated.', data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

module.exports = {
  getMyAccount,
  getCatalog,
  createRewardItem,
  updateRewardItem,
  redeemRewardItem,
  getRedemptions,
  updateRedemption,
};
