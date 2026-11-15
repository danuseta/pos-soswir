const cron = require('node-cron');
const { withTransaction } = require('../models/db');
const { completeEntries } = require('../services/dailyStock');

class DailyStockScheduler {
  constructor() {
    this.scheduledTask = null;
  }

  async performAutoCompletion() {
    try {
      const result = await withTransaction((client) => completeEntries(client, null));
      console.log(`Auto-completion: ${result.completed} entry, ${result.products} produk`);
      return { success: true, completed_count: result.completed, updated_products: result.products, message: "Auto-completion successful" };
    } catch (error) {
      console.error("❌ Error in daily stock auto-completion:", error);
      return { success: false, error: error.message, message: "Failed to complete daily stock entries" };
    }
  }

  setupScheduler() {
    this.scheduledTask = cron.schedule('0 18 * * *', async () => {
      await this.performAutoCompletion();
    }, {
      scheduled: true,
      timezone: "Asia/Jakarta"
    });

    console.log('📅 Daily Stock Auto-Completion Scheduler started');
    console.log('⏰ Schedule: Every day at 18:00 WIB (6 PM)');
    console.log('🎯 Action: Complete all active daily stock entries');
  }

  stopScheduler() {
    if (this.scheduledTask) {
      this.scheduledTask.destroy();
      this.scheduledTask = null;
      console.log('🛑 Daily Stock Scheduler stopped');
    }
  }

  getStatus() {
    return {
      isRunning: this.scheduledTask !== null,
      schedule: '0 18 * * * (18:00 WIB)',
      timezone: 'Asia/Jakarta',
      nextRun: this.scheduledTask ? 'Next 18:00 WIB' : 'Not scheduled'
    };
  }

  async triggerManual() {
    console.log('🧪 Manual trigger - Daily Stock Auto-Completion');
    return await this.performAutoCompletion();
  }
}

const dailyStockScheduler = new DailyStockScheduler();
module.exports = dailyStockScheduler; 