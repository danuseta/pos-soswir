const cron = require('node-cron');
const { pool } = require('../models/db');

class DailyStockScheduler {
  constructor() {
    this.scheduledTask = null;
  }

  async performAutoCompletion() {
    try {
      console.log('🕕 [18:00 WIB] Starting automatic daily stock completion...');
      
      const connection = await pool.getConnection();
      const targetDate = new Date().toISOString().split('T')[0];
      
      const [activeEntries] = await connection.query(
        `SELECT dse.*, p.price as product_price, p.name as product_name
         FROM daily_stock_entries dse 
         JOIN products p ON dse.product_id = p.id 
         WHERE dse.entry_date = ? AND dse.status = 'active'`,
        [targetDate]
      );

      if (activeEntries.length === 0) {
        console.log('ℹ️  No active stock entries to complete for today');
        connection.release();
        return { completed_count: 0, message: 'No active entries found' };
      }

      let completedCount = 0;
      const updatedProducts = new Set();

      for (const entry of activeEntries) {
        const price_per_unit = parseFloat(entry.product_price);
        const quantity_returned = entry.quantity_in - entry.quantity_sold;
        const total_revenue = entry.quantity_sold * price_per_unit;
        const store_fee = total_revenue * (entry.tax_percentage / 100);
        const supplier_earning = total_revenue - store_fee;

        await connection.query(
          `UPDATE daily_stock_entries 
           SET status = 'completed',
               quantity_returned = ?,
               total_revenue = ?,
               store_fee = ?,
               supplier_earning = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [quantity_returned, total_revenue, store_fee, supplier_earning, entry.id]
        );

        updatedProducts.add(entry.product_id);
        completedCount++;
        
        console.log(`✅ Completed entry for ${entry.product_name} (ID: ${entry.id})`);
      }

      for (const productId of updatedProducts) {
        const [stockSum] = await connection.query(`
          SELECT COALESCE(SUM(quantity_in - quantity_sold), 0) as available_stock
          FROM daily_stock_entries 
          WHERE product_id = ? AND status = 'active'
        `, [productId]);

        const newProductStock = parseInt(stockSum[0].available_stock);

        await connection.query(
          "UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?",
          [newProductStock, productId]
        );
        
        console.log(`📦 Updated product ${productId} stock to ${newProductStock}`);
      }

      connection.release();

      const resultMessage = `Auto-completion successful: ${completedCount} entries completed for ${targetDate}`;
      console.log(`🎉 ${resultMessage}`);
      console.log(`📊 Updated ${updatedProducts.size} product stocks`);

      return {
        success: true,
        completed_count: completedCount,
        updated_products: updatedProducts.size,
        date: targetDate,
        message: resultMessage
      };

    } catch (error) {
      console.error('❌ Error in daily stock auto-completion:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to complete daily stock entries'
      };
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