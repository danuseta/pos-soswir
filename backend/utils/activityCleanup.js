const { pool } = require('../models/db');
const cron = require('node-cron');

class ActivityCleanup {
  constructor() {
    this.isEnabled = process.env.CLEANUP_ENABLED === 'true';
    this.retentionDays = parseInt(process.env.ACTIVITY_RETENTION_DAYS) || 3;
    this.batchSize = parseInt(process.env.CLEANUP_BATCH_SIZE) || 1000;
    this.eventSchedulerActive = false;
    this.lastCleanup = null;
    this.cleanupTask = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (!this.isEnabled) {
      console.log('🧹 Activity cleanup is disabled via CLEANUP_ENABLED=false');
      return;
    }

    console.log('🚀 Initializing Activity Cleanup System...');
    
    try {
      await this.checkEventScheduler();
      
      if (this.eventSchedulerActive) {
        await this.setupMySQLEvent();
        console.log('✅ MySQL Event Scheduler cleanup initialized');
      } else {
        await this.setupApplicationCleanup();
        console.log('✅ Application-level cleanup initialized');
      }
      
      await this.performInitialCleanup();
      this.isInitialized = true;
      
    } catch (error) {
      console.error('❌ Error initializing cleanup system:', error);
      await this.setupApplicationCleanup();
    }
  }

  async checkEventScheduler() {
    try {
      const connection = await pool.getConnection();
      
      const [eventSchedulerStatus] = await connection.query(
        "SHOW VARIABLES LIKE 'event_scheduler'"
      );
      
      if (eventSchedulerStatus.length > 0 && eventSchedulerStatus[0].Value === 'ON') {
        try {
          await connection.query('SELECT EVENT_NAME FROM information_schema.EVENTS LIMIT 1');
          this.eventSchedulerActive = true;
        } catch (permError) {
          console.log('📝 Event Scheduler is ON but no permission to access events table');
          this.eventSchedulerActive = false;
        }
      } else {
        console.log('📝 MySQL Event Scheduler is not enabled');
        this.eventSchedulerActive = false;
      }
      
      connection.release();
    } catch (error) {
      console.log('📝 Cannot access Event Scheduler status, using application cleanup');
      this.eventSchedulerActive = false;
    }
  }

  async setupMySQLEvent() {
    try {
      const connection = await pool.getConnection();
      
      await connection.query('DROP EVENT IF EXISTS cleanup_user_activities');
      
      const eventQuery = `
        CREATE EVENT cleanup_user_activities
        ON SCHEDULE EVERY 1 DAY
        STARTS TIMESTAMP(CURRENT_DATE + INTERVAL 1 DAY, '00:00:00')
        DO
        BEGIN
          DELETE FROM user_activities 
          WHERE created_at < DATE_SUB(NOW(), INTERVAL ${this.retentionDays} DAY)
          LIMIT ${this.batchSize};
          
          -- Log cleanup action
          INSERT INTO store_settings (setting_key, setting_value) 
          VALUES ('last_activity_cleanup', NOW())
          ON DUPLICATE KEY UPDATE setting_value = NOW();
        END
      `;
      
      await connection.query(eventQuery);
      connection.release();
      
      console.log(`✅ MySQL Event created: cleanup every day at 00:00, keep ${this.retentionDays} days`);
      
    } catch (error) {
      console.error('❌ Failed to create MySQL Event:', error.message);
      this.eventSchedulerActive = false;
      await this.setupApplicationCleanup();
    }
  }

  async setupApplicationCleanup() {
    this.cleanupTask = cron.schedule('0 0 * * *', async () => {
      await this.performCleanup();
    }, {
      scheduled: true,
      timezone: "Asia/Jakarta"
    });

    console.log(`📅 Application cleanup scheduled: daily at 00:00, keep ${this.retentionDays} days`);
  }

  async performInitialCleanup() {
    console.log('🧹 Performing initial cleanup...');
    const deleted = await this.performCleanup();
    console.log(`🗑️ Initial cleanup completed: ${deleted} old activities removed`);
  }

  async performCleanup() {
    if (!this.isEnabled) return 0;

    try {
      const connection = await pool.getConnection();
      
      const [countResult] = await connection.query(`
        SELECT COUNT(*) as count 
        FROM user_activities 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ${this.retentionDays} DAY)
      `);
      
      const totalToDelete = countResult[0].count;
      
      if (totalToDelete === 0) {
        connection.release();
        this.lastCleanup = new Date();
        return 0;
      }
      
      console.log(`🧹 Starting cleanup: ${totalToDelete} activities older than ${this.retentionDays} days`);
      
      let totalDeleted = 0;
      
      while (totalDeleted < totalToDelete) {
        const [result] = await connection.query(`
          DELETE FROM user_activities 
          WHERE created_at < DATE_SUB(NOW(), INTERVAL ${this.retentionDays} DAY)
          LIMIT ${this.batchSize}
        `);
        
        const deletedInBatch = result.affectedRows;
        totalDeleted += deletedInBatch;
        
        if (deletedInBatch === 0) break;
        
        console.log(`📦 Batch cleanup: ${deletedInBatch} activities deleted (${totalDeleted}/${totalToDelete})`);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await connection.query(`
        INSERT INTO store_settings (setting_key, setting_value) 
        VALUES ('last_activity_cleanup', NOW())
        ON DUPLICATE KEY UPDATE setting_value = NOW()
      `);
      
      connection.release();
      this.lastCleanup = new Date();
      
      console.log(`✅ Cleanup completed: ${totalDeleted} activities removed`);
      return totalDeleted;
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      return 0;
    }
  }

  async manualCleanup() {
    console.log('🔧 Manual cleanup triggered...');
    return await this.performCleanup();
  }

  async getCleanupStatus() {
    try {
      const connection = await pool.getConnection();
      
      const [totalResult] = await connection.query('SELECT COUNT(*) as total FROM user_activities');
      
      const [oldResult] = await connection.query(`
        SELECT COUNT(*) as old_count 
        FROM user_activities 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ${this.retentionDays} DAY)
      `);
      
      const [lastCleanupResult] = await connection.query(`
        SELECT setting_value as last_cleanup 
        FROM store_settings 
        WHERE setting_key = 'last_activity_cleanup'
      `);
      
      const [oldestResult] = await connection.query(`
        SELECT created_at as oldest 
        FROM user_activities 
        ORDER BY created_at ASC 
        LIMIT 1
      `);
      
      connection.release();
      
      return {
        isEnabled: this.isEnabled,
        method: this.eventSchedulerActive ? 'MySQL Event Scheduler' : 'Application Cron',
        retentionDays: this.retentionDays,
        totalActivities: totalResult[0].total,
        oldActivities: oldResult[0].old_count,
        lastCleanup: lastCleanupResult[0]?.last_cleanup || null,
        oldestActivity: oldestResult[0]?.oldest || null,
        nextCleanup: this.eventSchedulerActive ? 'Daily at 00:00 (MySQL Event)' : 'Daily at 00:00 (Application)',
        isInitialized: this.isInitialized
      };
      
    } catch (error) {
      console.error('Error getting cleanup status:', error);
      return {
        error: error.message,
        isEnabled: this.isEnabled,
        isInitialized: this.isInitialized
      };
    }
  }

  destroy() {
    if (this.cleanupTask) {
      this.cleanupTask.destroy();
      console.log('🛑 Application cleanup task destroyed');
    }
  }
}

module.exports = new ActivityCleanup(); 