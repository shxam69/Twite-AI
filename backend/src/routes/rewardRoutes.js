const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/rewardController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(authenticateToken);

/**
 * @route   GET /api/rewards/my-account
 * @desc    Get employee reward account balance & history
 * @access  Private (Authenticated)
 */
router.get('/my-account', rewardController.getMyAccount);

/**
 * @route   GET /api/rewards/catalog
 * @desc    Get rewards catalog items
 * @access  Private (Authenticated)
 */
router.get('/catalog', rewardController.getCatalog);

/**
 * @route   POST /api/rewards/redeem
 * @desc    Redeem a reward item
 * @access  Private (Authenticated Employee)
 */
router.post('/redeem', rewardController.redeemRewardItem);

/**
 * Admin Routes
 */
router.post('/', requireAdmin, rewardController.createRewardItem);
router.put('/:id', requireAdmin, rewardController.updateRewardItem);
router.get('/redemptions', requireAdmin, rewardController.getRedemptions);
router.patch('/redemptions/:id', requireAdmin, rewardController.updateRedemption);

module.exports = router;
