const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");
const activityCleanup = require("../utils/activityCleanup");

router.get("/status", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const { pool } = require("../models/db");
    const connection = await pool.getConnection();
    
    const status = await activityCleanup.getCleanupStatus();
    
    const [activitiesStats] = await connection.query(`
      SELECT 
        COUNT(*) as total_activities,
        COUNT(CASE WHEN created_at < DATE_SUB(NOW(), INTERVAL 3 DAY) THEN 1 END) as activities_older_than_3days,
        MIN(created_at) as oldest_activity,
        MAX(created_at) as newest_activity
      FROM user_activities
    `);
    
    const [eventInfo] = await connection.query(`
      SELECT 
        EVENT_NAME,
        STATUS as event_status,
        INTERVAL_VALUE,
        INTERVAL_FIELD,
        LAST_EXECUTED,
        STARTS,
        ENDS
      FROM information_schema.EVENTS 
      WHERE EVENT_SCHEMA = DATABASE() 
      AND EVENT_NAME = 'cleanup_user_activities'
    `);
    
    const [lastCleanupLog] = await connection.query(`
      SELECT setting_value as last_cleanup
      FROM store_settings 
      WHERE setting_key = 'last_auto_cleanup_3days'
    `);
    
    connection.release();
    
    let nextCleanupFormatted = 'Tidak tersedia';
    if (eventInfo.length > 0) {
      const event = eventInfo[0];
      if (event.INTERVAL_VALUE && event.INTERVAL_FIELD) {
        if (event.INTERVAL_VALUE === 1 && event.INTERVAL_FIELD === 'DAY' && event.STARTS) {
          const startTime = new Date(event.STARTS);
          const now = new Date();
          
          const startHour = startTime.getHours();
          const startMinute = startTime.getMinutes();
          
          const nextExecution = new Date();
          nextExecution.setHours(startHour, startMinute, 0, 0);
          
          if (nextExecution <= now) {
            nextExecution.setDate(nextExecution.getDate() + 1);
          }
          
          nextCleanupFormatted = nextExecution.toLocaleString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta'
          }) + ' WIB';
        } else {
          nextCleanupFormatted = `Setiap ${event.INTERVAL_VALUE} ${event.INTERVAL_FIELD.toLowerCase()}`;
        }
      }
    }
    
    const enhancedStatus = {
      ...status,
      totalActivities: activitiesStats[0].total_activities,
      oldActivities: activitiesStats[0].activities_older_than_3days,
      oldestActivity: activitiesStats[0].oldest_activity,
      newestActivity: activitiesStats[0].newest_activity,
      
      nextCleanup: nextCleanupFormatted,
      eventSchedulerStatus: eventInfo.length > 0 ? eventInfo[0].event_status : 'DISABLED',
      cleanupInterval: eventInfo.length > 0 ? `${eventInfo[0].INTERVAL_VALUE} ${eventInfo[0].INTERVAL_FIELD}` : 'Tidak diatur',
      lastCleanupScheduled: eventInfo.length > 0 ? eventInfo[0].LAST_EXECUTED : null,
      eventStartTime: eventInfo.length > 0 ? eventInfo[0].STARTS : null,
      
      lastCleanupLogged: lastCleanupLog.length > 0 ? lastCleanupLog[0].last_cleanup : null,
      
      retentionDays: 3,
      isAutoCleanupActive: eventInfo.length > 0 && eventInfo[0].event_status === 'ENABLED'
    };
    
    res.json({
      success: true,
      data: enhancedStatus
    });
  } catch (error) {
    console.error("Error getting cleanup status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get cleanup status",
      error: error.message
    });
  }
});

router.post("/manual", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const deletedCount = await activityCleanup.manualCleanup();
    res.json({
      success: true,
      message: `Manual cleanup completed successfully`,
      data: {
        deletedActivities: deletedCount,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error("Error during manual cleanup:", error);
    res.status(500).json({
      success: false,
      message: "Manual cleanup failed",
      error: error.message
    });
  }
});

router.get("/logs", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const { pool } = require("../models/db");
    const connection = await pool.getConnection();
    
    const [cleanupHistory] = await connection.query(`
      SELECT setting_value as last_cleanup
      FROM store_settings 
      WHERE setting_key = 'last_activity_cleanup'
    `);
    
    const [stats] = await connection.query(`
      SELECT 
        COUNT(*) as total_activities,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as today_activities,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as week_activities,
        MIN(created_at) as oldest_activity,
        MAX(created_at) as newest_activity
      FROM user_activities
    `);
    
    const [dailyStats] = await connection.query(`
      SELECT 
        DATE(created_at) as activity_date,
        COUNT(*) as activity_count
      FROM user_activities 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY activity_date DESC
    `);
    
    connection.release();
    
    res.json({
      success: true,
      data: {
        lastCleanup: cleanupHistory[0]?.last_cleanup || null,
        statistics: stats[0],
        dailyActivities: dailyStats
      }
    });
    
  } catch (error) {
    console.error("Error getting cleanup logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get cleanup logs",
      error: error.message
    });
  }
});

router.post("/test", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const { pool } = require("../models/db");
    const connection = await pool.getConnection();
    
    const retentionDays = parseInt(process.env.ACTIVITY_RETENTION_DAYS) || 3;
    
    const [result] = await connection.query(`
      SELECT 
        COUNT(*) as would_delete,
        MIN(created_at) as oldest_to_delete,
        MAX(created_at) as newest_to_delete
      FROM user_activities 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ${retentionDays} DAY)
    `);
    
    const [examples] = await connection.query(`
      SELECT 
        id,
        user_id,
        username,
        activity_type,
        created_at
      FROM user_activities 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ${retentionDays} DAY)
      ORDER BY created_at ASC
      LIMIT 10
    `);
    
    connection.release();
    
    res.json({
      success: true,
      message: "Cleanup test completed (dry run)",
      data: {
        retentionDays,
        wouldDelete: result[0].would_delete,
        oldestToDelete: result[0].oldest_to_delete,
        newestToDelete: result[0].newest_to_delete,
        examples: examples
      }
    });
    
  } catch (error) {
    console.error("Error during cleanup test:", error);
    res.status(500).json({
      success: false,
      message: "Cleanup test failed",
      error: error.message
    });
  }
});

router.post("/update-retention", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const { retentionDays, cleanupInterval, intervalUnit } = req.body;
    
    if (!retentionDays || retentionDays < 1 || retentionDays > 365) {
      return res.status(400).json({
        success: false,
        message: "Periode retensi harus antara 1-365 hari"
      });
    }
    
    if (!cleanupInterval || cleanupInterval < 1) {
      return res.status(400).json({
        success: false,
        message: "Interval cleanup tidak valid"
      });
    }
    
    const validUnits = ['HOUR', 'DAY'];
    if (!validUnits.includes(intervalUnit)) {
      return res.status(400).json({
        success: false,
        message: "Unit interval harus HOUR atau DAY"
      });
    }
    
    const { pool } = require("../models/db");
    const connection = await pool.getConnection();
    
    const eventSQL = `
      DROP EVENT IF EXISTS cleanup_user_activities;
      
      CREATE EVENT cleanup_user_activities
      ON SCHEDULE EVERY ${cleanupInterval} ${intervalUnit}
      STARTS NOW()
      DO
      BEGIN
        DELETE FROM user_activities 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ${retentionDays} DAY)
        LIMIT 1000;
        
        INSERT INTO store_settings (setting_key, setting_value) 
        VALUES ('last_auto_cleanup_retention_${retentionDays}days', NOW())
        ON DUPLICATE KEY UPDATE setting_value = NOW();
      END
    `;
    
    const mysql = require('mysql2');
    const rawConnection = mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pos_db',
      multipleStatements: true
    });
    
    rawConnection.query(eventSQL, (error) => {
      rawConnection.end();
      connection.release();
      
      if (error) {
        console.error("Error updating event:", error);
        return res.status(500).json({
          success: false,
          message: "Gagal mengupdate event scheduler: " + error.message
        });
      }
      
      res.json({
        success: true,
        message: `Event scheduler berhasil diupdate!`,
        data: {
          retentionDays: retentionDays,
          cleanupInterval: cleanupInterval,
          intervalUnit: intervalUnit,
          updatedAt: new Date()
        }
      });
    });
    
  } catch (error) {
    console.error("Error updating retention period:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengupdate periode retensi",
      error: error.message
    });
  }
});

router.get("/retention-options", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const options = {
      retentionDays: [
        { value: 1, label: '1 hari', description: 'Hapus setelah 1 hari (sangat agresif)' },
        { value: 2, label: '2 hari', description: 'Hapus setelah 2 hari (agresif)' },
        { value: 3, label: '3 hari', description: 'Hapus setelah 3 hari (default)' },
        { value: 7, label: '1 minggu', description: 'Hapus setelah 7 hari (konservatif)' },
        { value: 14, label: '2 minggu', description: 'Hapus setelah 14 hari' },
        { value: 30, label: '1 bulan', description: 'Hapus setelah 30 hari (long-term)' }
      ],
      intervals: [
        { value: 1, unit: 'HOUR', label: 'Setiap 1 jam', description: 'Pembersihan sangat sering' },
        { value: 6, unit: 'HOUR', label: 'Setiap 6 jam', description: 'Pembersihan sering' },
        { value: 12, unit: 'HOUR', label: 'Setiap 12 jam', description: 'Pembersihan 2x sehari' },
        { value: 1, unit: 'DAY', label: 'Setiap hari', description: 'Pembersihan harian' }
      ]
    };
    
    res.json({
      success: true,
      data: options
    });
  } catch (error) {
    console.error("Error getting retention options:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil opsi retensi",
      error: error.message
    });
  }
});

module.exports = router; 