const express = require('express');
const router = express.Router();
const { getRecentActivities, logActivity } = require('../models/activity');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const activities = await getRecentActivities(limit);
    
    const formattedActivities = activities.map(activity => ({
      id: activity.id.toString(),
      type: activity.entity_type,
      action: activity.action_type,
      description: activity.description,
      user: activity.username || 'System',
      time: activity.created_at,
      entityId: activity.entity_id
    }));
    
    res.json(formattedActivities);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ message: 'Server error fetching activity logs' });
  }
});

router.post('/', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const { actionType, entityType, entityId, description } = req.body;
    
    if (!actionType || !entityType || !description) {
      return res.status(400).json({ message: 'actionType, entityType, and description are required' });
    }
    
    const success = await logActivity(
      req.user.id,
      req.user.username,
      actionType,
      entityType,
      entityId,
      description
    );
    
    if (success) {
      res.status(201).json({ message: 'Activity logged successfully' });
    } else {
      res.status(500).json({ message: 'Failed to log activity' });
    }
  } catch (error) {
    console.error('Error creating activity log:', error);
    res.status(500).json({ message: 'Server error creating activity log' });
  }
});

module.exports = router; 