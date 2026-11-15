const cron = require("node-cron");
const { query } = require("../models/db");

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

class ActivityCleanup {
  constructor() {
    this.retentionDays = Number(process.env.ACTIVITY_RETENTION_DAYS || 3);
    this.batchSize = Number(process.env.CLEANUP_BATCH_SIZE || 1000);
    this.task = null;
  }

  async initialize() {
    const [row] = await query("SELECT setting_value FROM store_settings WHERE setting_key = 'activity_retention_days'");
    if (row) this.retentionDays = Number(row.setting_value);
    this.destroy();
    this.task = cron.schedule(
      "0 0 * * *",
      () => this.runCleanup().catch((error) => console.error("Error during scheduled cleanup:", error)),
      { timezone: "Asia/Jakarta" }
    );
  }

  async runCleanup() {
    let total = 0;
    for (;;) {
      const rows = await query(
        `DELETE FROM user_activities
         WHERE id IN (
           SELECT id FROM user_activities
           WHERE created_at < now() - make_interval(days => $1)
           LIMIT $2
         )
         RETURNING id`,
        [this.retentionDays, this.batchSize]
      );
      total += rows.length;
      if (rows.length < this.batchSize) break;
    }
    await query(
      `INSERT INTO store_settings (setting_key, setting_value) VALUES ('last_activity_cleanup', now()::text)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`
    );
    return total;
  }

  async setRetention(days) {
    this.retentionDays = days;
    await query(
      `INSERT INTO store_settings (setting_key, setting_value) VALUES ('activity_retention_days', $1)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
      [String(days)]
    );
  }

  nextRun() {
    const wib = new Date(Date.now() + WIB_OFFSET_MS);
    return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + 1) - WIB_OFFSET_MS);
  }

  status() {
    return {
      isRunning: this.task !== null,
      schedule: "00:00 WIB setiap hari",
      retentionDays: this.retentionDays,
    };
  }

  destroy() {
    if (this.task) this.task.stop();
    this.task = null;
  }
}

module.exports = new ActivityCleanup();
