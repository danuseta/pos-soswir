const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRole } = require("../middleware/authMiddleware");
const { query } = require("../models/db");
const activityCleanup = require("../utils/activityCleanup");

router.get("/status", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const { isRunning, retentionDays } = activityCleanup.status();

    const [stats] = await query(
      `SELECT
         COUNT(*) AS total_activities,
         COUNT(*) FILTER (WHERE created_at < now() - make_interval(days => $1)) AS old_activities,
         MIN(created_at) AS oldest_activity,
         MAX(created_at) AS newest_activity
       FROM user_activities`,
      [retentionDays]
    );

    const [lastCleanup] = await query(
      "SELECT setting_value AS last_cleanup FROM store_settings WHERE setting_key = 'last_activity_cleanup'"
    );

    const nextRun = activityCleanup.nextRun();
    const nextCleanup = isRunning
      ? nextRun.toLocaleString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }) + " WIB"
      : "Tidak tersedia";

    res.json({
      success: true,
      data: {
        isRunning,
        schedule: "00:00 WIB setiap hari",
        totalActivities: stats.total_activities,
        oldActivities: stats.old_activities,
        oldestActivity: stats.oldest_activity,
        newestActivity: stats.newest_activity,
        nextCleanup,
        eventSchedulerStatus: isRunning ? "ENABLED" : "DISABLED",
        cleanupInterval: "1 DAY",
        lastCleanupScheduled: lastCleanup ? lastCleanup.last_cleanup : null,
        eventStartTime: isRunning ? nextRun : null,
        lastCleanupLogged: lastCleanup ? lastCleanup.last_cleanup : null,
        retentionDays,
        isAutoCleanupActive: isRunning,
      },
    });
  } catch (error) {
    console.error("Error getting cleanup status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get cleanup status",
      error: error.message,
    });
  }
});

router.post("/manual", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const deletedCount = await activityCleanup.runCleanup();
    res.json({
      success: true,
      message: "Manual cleanup completed successfully",
      data: {
        deletedActivities: deletedCount,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("Error during manual cleanup:", error);
    res.status(500).json({
      success: false,
      message: "Manual cleanup failed",
      error: error.message,
    });
  }
});

router.get("/logs", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const [cleanupHistory] = await query(
      "SELECT setting_value AS last_cleanup FROM store_settings WHERE setting_key = 'last_activity_cleanup'"
    );

    const [stats] = await query(`
      SELECT
        COUNT(*) AS total_activities,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '1 day') AS today_activities,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS week_activities,
        MIN(created_at) AS oldest_activity,
        MAX(created_at) AS newest_activity
      FROM user_activities
    `);

    const dailyStats = await query(`
      SELECT
        to_char(created_at::date, 'YYYY-MM-DD') AS activity_date,
        COUNT(*) AS activity_count
      FROM user_activities
      WHERE created_at >= now() - interval '7 days'
      GROUP BY created_at::date
      ORDER BY created_at::date DESC
    `);

    res.json({
      success: true,
      data: {
        lastCleanup: cleanupHistory ? cleanupHistory.last_cleanup : null,
        statistics: stats,
        dailyActivities: dailyStats,
      },
    });
  } catch (error) {
    console.error("Error getting cleanup logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get cleanup logs",
      error: error.message,
    });
  }
});

router.post("/test", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const { retentionDays } = activityCleanup.status();

    const [result] = await query(
      `SELECT
         COUNT(*) AS would_delete,
         MIN(created_at) AS oldest_to_delete,
         MAX(created_at) AS newest_to_delete
       FROM user_activities
       WHERE created_at < now() - make_interval(days => $1)`,
      [retentionDays]
    );

    const examples = await query(
      `SELECT id, user_id, username, activity_type, created_at
       FROM user_activities
       WHERE created_at < now() - make_interval(days => $1)
       ORDER BY created_at ASC
       LIMIT 10`,
      [retentionDays]
    );

    res.json({
      success: true,
      message: "Cleanup test completed (dry run)",
      data: {
        retentionDays,
        wouldDelete: result.would_delete,
        oldestToDelete: result.oldest_to_delete,
        newestToDelete: result.newest_to_delete,
        examples,
      },
    });
  } catch (error) {
    console.error("Error during cleanup test:", error);
    res.status(500).json({
      success: false,
      message: "Cleanup test failed",
      error: error.message,
    });
  }
});

router.post("/update-retention", authenticateToken, authorizeRole(["superadmin"]), async (req, res) => {
  try {
    const { retentionDays, cleanupInterval, intervalUnit } = req.body;
    const days = Number(retentionDays);

    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        message: "Periode retensi harus antara 1-365 hari",
      });
    }

    await activityCleanup.setRetention(days);

    res.json({
      success: true,
      message: "Periode retensi berhasil diupdate!",
      data: {
        retentionDays: days,
        cleanupInterval,
        intervalUnit,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error updating retention period:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengupdate periode retensi",
      error: error.message,
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
