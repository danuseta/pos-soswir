-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.0.30 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.1.0.6537
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for pos_db
CREATE DATABASE IF NOT EXISTS `pos_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `pos_db`;

-- Dumping structure for table pos_db.categories
CREATE TABLE IF NOT EXISTS `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `icon_name` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_reseller` tinyint(1) DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.categories: ~2 rows (approximately)
INSERT INTO `categories` (`id`, `name`, `description`, `icon_name`, `created_at`, `is_reseller`, `updated_at`) VALUES
	(1, 'Makanan', NULL, NULL, '2025-06-04 17:44:14', 0, '2025-06-04 17:44:14'),
	(2, 'Minuman', NULL, NULL, '2025-06-04 17:44:38', 0, '2025-06-04 17:44:38'),
	(3, 'PUBJ', NULL, NULL, '2025-06-04 17:44:44', 1, '2025-06-04 17:44:44');

-- Dumping structure for event pos_db.cleanup_user_activities
DELIMITER //
CREATE EVENT `cleanup_user_activities` ON SCHEDULE EVERY 1 DAY STARTS '2025-06-10 00:00:00' ON COMPLETION NOT PRESERVE ENABLE DO BEGIN
          DELETE FROM user_activities 
          WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
          LIMIT 1000;
          
          -- Log cleanup action
          INSERT INTO store_settings (setting_key, setting_value) 
          VALUES ('last_activity_cleanup', NOW())
          ON DUPLICATE KEY UPDATE setting_value = NOW();
        END//
DELIMITER ;

-- Dumping structure for table pos_db.daily_stock_entries
CREATE TABLE IF NOT EXISTS `daily_stock_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `supplier_id` int NOT NULL,
  `entry_date` date NOT NULL,
  `quantity_in` int NOT NULL DEFAULT '0',
  `quantity_sold` int NOT NULL DEFAULT '0',
  `quantity_returned` int NOT NULL DEFAULT '0',
  `total_revenue` decimal(10,2) NOT NULL DEFAULT '0.00',
  `supplier_earning` decimal(10,2) NOT NULL DEFAULT '0.00',
  `store_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tax_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `price_per_unit` decimal(10,2) DEFAULT '0.00',
  `status` enum('active','completed','returned') NOT NULL DEFAULT 'active',
  `is_paid` tinyint(1) DEFAULT '0',
  `paid_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_daily_entry` (`product_id`,`supplier_id`,`entry_date`),
  KEY `supplier_id` (`supplier_id`),
  KEY `entry_date` (`entry_date`),
  KEY `status` (`status`),
  KEY `idx_daily_stock_entries_date_status` (`entry_date`,`status`),
  KEY `idx_daily_stock_entries_supplier_date` (`supplier_id`,`entry_date`),
  KEY `idx_daily_stock_entries_product_date` (`product_id`,`entry_date`),
  CONSTRAINT `daily_stock_entries_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `daily_stock_entries_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.daily_stock_entries: ~6 rows (approximately)

-- Dumping structure for table pos_db.products
CREATE TABLE IF NOT EXISTS `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `image_url` varchar(500) DEFAULT NULL,
  `cloudinary_public_id` varchar(255) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `category_id` int DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tax_percentage` decimal(5,2) DEFAULT '0.00',
  `tax_description` varchar(255) DEFAULT NULL,
  `supplier_name` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `category_id` (`category_id`),
  KEY `products_ibfk_2` (`supplier_id`),
  KEY `idx_products_is_active` (`is_active`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `products_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.products: ~2 rows (approximately)

-- Dumping structure for table pos_db.product_deletion_audit
CREATE TABLE IF NOT EXISTS `product_deletion_audit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `deleted_by_user_id` int NOT NULL,
  `deleted_by_username` varchar(255) NOT NULL,
  `deletion_reason` text,
  `product_data` json DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_deleted_by_user` (`deleted_by_user_id`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.product_deletion_audit: ~0 rows (approximately)

-- Dumping structure for table pos_db.sales
CREATE TABLE IF NOT EXISTS `sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `customer_name` varchar(255) DEFAULT 'Umum',
  `total_amount` decimal(10,2) NOT NULL,
  `payment_method` varchar(50) DEFAULT 'Cash',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.sales: ~3 rows (approximately)

-- Dumping structure for table pos_db.sale_items
CREATE TABLE IF NOT EXISTS `sale_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sale_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `quantity` int NOT NULL,
  `price_at_sale` decimal(10,2) NOT NULL,
  `daily_stock_entry_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sale_id` (`sale_id`),
  KEY `daily_stock_entry_id` (`daily_stock_entry_id`),
  KEY `sale_items_product_fk` (`product_id`),
  CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sale_items_ibfk_3` FOREIGN KEY (`daily_stock_entry_id`) REFERENCES `daily_stock_entries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sale_items_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.sale_items: ~10 rows (approximately)

-- Dumping structure for table pos_db.sale_taxes
CREATE TABLE IF NOT EXISTS `sale_taxes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sale_id` int NOT NULL,
  `category_id` int NOT NULL,
  `category_name` varchar(255) NOT NULL,
  `gross_amount` decimal(10,2) NOT NULL,
  `tax_percentage` decimal(5,2) NOT NULL,
  `tax_amount` decimal(10,2) NOT NULL,
  `net_amount` decimal(10,2) NOT NULL,
  `store_profit` decimal(10,2) NOT NULL,
  `supplier_amount` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `quantity` int NOT NULL,
  `price_per_item` decimal(10,2) NOT NULL,
  `product_id` int DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `daily_stock_entry_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sale_id` (`sale_id`),
  KEY `category_id` (`category_id`),
  KEY `product_id` (`product_id`),
  KEY `daily_stock_entry_id` (`daily_stock_entry_id`),
  CONSTRAINT `sale_taxes_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sale_taxes_ibfk_3` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sale_taxes_ibfk_4` FOREIGN KEY (`daily_stock_entry_id`) REFERENCES `daily_stock_entries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sale_taxes_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.sale_taxes: ~4 rows (approximately)

-- Dumping structure for table pos_db.store_settings
CREATE TABLE IF NOT EXISTS `store_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(255) NOT NULL,
  `setting_value` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.store_settings: ~9 rows (approximately)
INSERT INTO `store_settings` (`id`, `setting_key`, `setting_value`, `updated_at`) VALUES
	(1, 'store_name', 'Watronila', '2025-06-03 17:07:50'),
	(3, 'store_address', 'Gedung H Teknik Elektro, Universitas Lampung', '2025-06-03 17:07:50'),
	(4, 'store_phone', '+6282160065178', '2025-06-03 17:07:50'),
	(5, 'store_email', 'watronila@gmail.com', '2025-06-03 17:07:50'),
	(6, 'operating_hours_monday', '08:00-16:00', '2025-06-03 17:07:50'),
	(7, 'operating_hours_tuesday', '08:00-16:00', '2025-06-03 17:07:50'),
	(8, 'operating_hours_wednesday', '08:00-16:00', '2025-06-03 17:07:50'),
	(9, 'operating_hours_thursday', '08:00-16:00', '2025-06-03 17:07:50'),
	(10, 'operating_hours_friday', '08:00-16:00', '2025-06-03 17:07:50'),
	(11, 'last_activity_cleanup', '2025-06-09 06:16:35', '2025-06-08 23:16:35'),
	(14, 'last_aggressive_cleanup', '2025-06-07 20:33:53', '2025-06-07 13:33:53'),
	(15, 'last_auto_cleanup_3days', '2025-06-07 20:46:50', '2025-06-07 13:46:50');

-- Dumping structure for table pos_db.suppliers
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.suppliers: ~0 rows (approximately)

-- Dumping structure for table pos_db.transaction_logs
CREATE TABLE IF NOT EXISTS `transaction_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sale_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `quantity` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `daily_stock_entry_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `product_id` (`product_id`),
  KEY `sale_id` (`sale_id`),
  KEY `daily_stock_entry_id` (`daily_stock_entry_id`),
  CONSTRAINT `transaction_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transaction_logs_ibfk_3` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transaction_logs_ibfk_4` FOREIGN KEY (`daily_stock_entry_id`) REFERENCES `daily_stock_entries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transaction_logs_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.transaction_logs: ~12 rows (approximately)

-- Dumping structure for table pos_db.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('cashier','superadmin') NOT NULL DEFAULT 'cashier',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.users: ~1 rows (approximately)
INSERT INTO `users` (`id`, `username`, `password`, `role`, `created_at`, `last_login`, `is_active`) VALUES
	(1, 'superadmin', '$2b$10$cVS6v/gX5dPbuppZawqXEOCW0echJ/uqsY51GTDVs33/b5WB1L.Xm', 'superadmin', '2025-05-17 04:43:38', '2025-06-09 05:53:16', 1);

-- Dumping structure for table pos_db.user_activities
CREATE TABLE IF NOT EXISTS `user_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `username` varchar(255) DEFAULT NULL,
  `activity_type` enum('login','logout','route_change') NOT NULL,
  `route_path` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activities_cleanup` (`created_at`,`activity_type`),
  KEY `idx_activities_user_time` (`user_id`,`created_at`),
  CONSTRAINT `user_activities_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table pos_db.user_activities: ~143 rows (approximately)

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
