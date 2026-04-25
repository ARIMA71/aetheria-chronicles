/*
SQLyog Ultimate v13.1.1 (64 bit)
MySQL - 8.0.30 : Database - db_aetheria
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`db_aetheria` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `db_aetheria`;

/*Table structure for table `battle_sessions` */

DROP TABLE IF EXISTS `battle_sessions`;

CREATE TABLE `battle_sessions` (
  `bs_id` bigint NOT NULL AUTO_INCREMENT,
  `player_id` int NOT NULL,
  `mq_id` int NOT NULL,
  `remaining_time` int DEFAULT NULL,
  `battle_state_json` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`bs_id`),
  KEY `player_id` (`player_id`),
  KEY `mq_id` (`mq_id`),
  CONSTRAINT `fk_bs_mq` FOREIGN KEY (`mq_id`) REFERENCES `master_quests` (`mq_id`),
  CONSTRAINT `fk_bs_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `battle_sessions` */

/*Table structure for table `gacha_banner_items` */

DROP TABLE IF EXISTS `gacha_banner_items`;

CREATE TABLE `gacha_banner_items` (
  `gb_id` int NOT NULL,
  `item_id` int NOT NULL,
  `item_type` enum('Character','Weapon') COLLATE utf8mb4_general_ci NOT NULL,
  `rate` float NOT NULL,
  KEY `gb_id` (`gb_id`),
  CONSTRAINT `fk_gbi_gb` FOREIGN KEY (`gb_id`) REFERENCES `gacha_banners` (`gb_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `gacha_banner_items` */

/*Table structure for table `gacha_banners` */

DROP TABLE IF EXISTS `gacha_banners`;

CREATE TABLE `gacha_banners` (
  `gb_id` int NOT NULL AUTO_INCREMENT,
  `gb_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `gb_start_date` timestamp NULL DEFAULT NULL,
  `gb_end_date` timestamp NULL DEFAULT NULL,
  `gb_pity_guarantee` int DEFAULT '0',
  PRIMARY KEY (`gb_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `gacha_banners` */

/*Table structure for table `item_skills` */

DROP TABLE IF EXISTS `item_skills`;

CREATE TABLE `item_skills` (
  `item_id` int NOT NULL,
  `item_type` enum('Character','Weapon') COLLATE utf8mb4_general_ci NOT NULL,
  `ms_id` int NOT NULL,
  `unlock_level` int DEFAULT '1',
  KEY `ms_id` (`ms_id`),
  CONSTRAINT `fk_itemskill_ms` FOREIGN KEY (`ms_id`) REFERENCES `master_skills` (`ms_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `item_skills` */

insert  into `item_skills`(`item_id`,`item_type`,`ms_id`,`unlock_level`) values 
(1,'Weapon',1,1),
(1,'Weapon',3,1),
(2,'Weapon',2,1),
(3,'Weapon',2,1),
(4,'Weapon',3,1),
(5,'Weapon',3,1),
(2,'Character',6,1),
(2,'Character',4,1),
(2,'Character',5,1);

/*Table structure for table `master_characters` */

DROP TABLE IF EXISTS `master_characters`;

CREATE TABLE `master_characters` (
  `mc_id` int NOT NULL AUTO_INCREMENT,
  `mc_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mc_rarity` enum('R','SR','SSR') COLLATE utf8mb4_general_ci DEFAULT 'R',
  `mc_element` enum('Fire','Wind','Earth') COLLATE utf8mb4_general_ci NOT NULL,
  `mc_base_hp` int NOT NULL DEFAULT '100',
  `mc_hp_growth` int NOT NULL DEFAULT '0',
  `mc_base_atk` int NOT NULL DEFAULT '10',
  `mc_atk_growth` int NOT NULL DEFAULT '0',
  `mc_portrait_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mc_sprite_path` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`mc_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_characters` */

insert  into `master_characters`(`mc_id`,`mc_name`,`mc_rarity`,`mc_element`,`mc_base_hp`,`mc_hp_growth`,`mc_base_atk`,`mc_atk_growth`,`mc_portrait_path`,`mc_sprite_path`) values 
(1,'Viking (MC)','SSR','Fire',500,50,50,5,'/assets/characters/mc_viking.png',NULL),
(2,'Sariel','SSR','Fire',450,45,60,6,'/assets/characters/sariel.png',NULL),
(3,'Ilsa','SSR','Fire',400,40,55,5,'/assets/characters/ilsa.png',NULL),
(4,'Cidala','SSR','Fire',600,60,40,4,'/assets/characters/cidala.png',NULL);

/*Table structure for table `master_materials` */

DROP TABLE IF EXISTS `master_materials`;

CREATE TABLE `master_materials` (
  `mat_id` int NOT NULL AUTO_INCREMENT,
  `mat_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mat_desc` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`mat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_materials` */

/*Table structure for table `master_monsters` */

DROP TABLE IF EXISTS `master_monsters`;

CREATE TABLE `master_monsters` (
  `mon_id` int NOT NULL AUTO_INCREMENT,
  `mon_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mon_base_hp` int NOT NULL,
  `mon_base_atk` int NOT NULL,
  `mon_element` enum('Fire','Wind','Earth') COLLATE utf8mb4_general_ci NOT NULL,
  `mon_icon_path` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`mon_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_monsters` */

insert  into `master_monsters`(`mon_id`,`mon_name`,`mon_base_hp`,`mon_base_atk`,`mon_element`,`mon_icon_path`) values 
(1,'Areus',245,95,'Wind',NULL);

/*Table structure for table `master_quests` */

DROP TABLE IF EXISTS `master_quests`;

CREATE TABLE `master_quests` (
  `mq_id` int NOT NULL AUTO_INCREMENT,
  `mq_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mq_stamina_cost` int NOT NULL DEFAULT '10',
  `mq_power_lvl` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`mq_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_quests` */

insert  into `master_quests`(`mq_id`,`mq_name`,`mq_stamina_cost`,`mq_power_lvl`) values 
(1,'Tutorial',10,1000);

/*Table structure for table `master_skills` */

DROP TABLE IF EXISTS `master_skills`;

CREATE TABLE `master_skills` (
  `ms_id` int NOT NULL AUTO_INCREMENT,
  `ms_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `ms_desc` text COLLATE utf8mb4_general_ci,
  `ms_cooldown` int DEFAULT '0',
  `ms_element` enum('Fire','Wind','Earth') COLLATE utf8mb4_general_ci NOT NULL,
  `ms_category` enum('Special','Active','Passive') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Active',
  `ms_modifier_value` float NOT NULL DEFAULT '0',
  PRIMARY KEY (`ms_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_skills` */

insert  into `master_skills`(`ms_id`,`ms_name`,`ms_desc`,`ms_cooldown`,`ms_element`,`ms_category`,`ms_modifier_value`) values 
(1,'Lohenweg ++','Ultra Fire DMG to a foe. (MC Charge Attack)',0,'Fire','Special',5),
(2,'Fire Majesty Medium','Medium boost to Fire allies ATK',0,'Fire','Passive',0.45),
(3,'Scarlet Convergence','Big boost to Fire allies ATK',0,'Fire','Passive',0.7),
(4,'Scythe of Execution','Deal Fire DMG to all foes',5,'Fire','Active',1.5),
(5,'Ascending Shadow','Boost to own ATK',6,'Fire','Active',0.3),
(6,'Lacrime di Sangue','Massive Fire DMG to a foe (Character Ultimate)',0,'Fire','Special',4),
(7,'Roar','Dealt Wind area damage',0,'Wind','Special',2.5);

/*Table structure for table `master_status_effects` */

DROP TABLE IF EXISTS `master_status_effects`;

CREATE TABLE `master_status_effects` (
  `mse_id` int NOT NULL AUTO_INCREMENT,
  `mse_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mse_type` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mse_duration` int DEFAULT NULL,
  PRIMARY KEY (`mse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_status_effects` */

/*Table structure for table `master_weapons` */

DROP TABLE IF EXISTS `master_weapons`;

CREATE TABLE `master_weapons` (
  `mw_id` int NOT NULL AUTO_INCREMENT,
  `mw_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mw_rarity` enum('R','SR','SSR') COLLATE utf8mb4_general_ci DEFAULT 'R',
  `mw_element` enum('Fire','Wind','Earth') COLLATE utf8mb4_general_ci NOT NULL,
  `mw_base_hp` int NOT NULL DEFAULT '0',
  `mw_hp_growth` int NOT NULL DEFAULT '0',
  `mw_base_atk` int NOT NULL DEFAULT '0',
  `mw_atk_growth` int NOT NULL DEFAULT '0',
  `mw_img_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`mw_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_weapons` */

insert  into `master_weapons`(`mw_id`,`mw_name`,`mw_rarity`,`mw_element`,`mw_base_hp`,`mw_hp_growth`,`mw_base_atk`,`mw_atk_growth`,`mw_img_path`) values 
(1,'Lord of Flames','SSR','Fire',200,20,300,30,'/assets/weapons/lord_of_flames.png'),
(2,'Ember Blade','SR','Fire',100,10,150,15,'/assets/weapons/ember_blade.png'),
(3,'Crimson Bow','SR','Fire',120,12,140,14,'/assets/weapons/crimson_bow.png'),
(4,'Sun God Axe','SSR','Fire',180,18,280,28,'/assets/weapons/sun_god_axe.png'),
(5,'Phoenix Staff','SSR','Fire',250,25,200,20,'/assets/weapons/phoenix_staff.png');

/*Table structure for table `monster_ai_behavior` */

DROP TABLE IF EXISTS `monster_ai_behavior`;

CREATE TABLE `monster_ai_behavior` (
  `mai_id` bigint NOT NULL AUTO_INCREMENT,
  `mon_id` int NOT NULL,
  `condition_type` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `condition_value` int DEFAULT NULL,
  `ms_id` int NOT NULL,
  PRIMARY KEY (`mai_id`),
  KEY `mon_id` (`mon_id`),
  KEY `ms_id` (`ms_id`),
  CONSTRAINT `fk_mai_mon` FOREIGN KEY (`mon_id`) REFERENCES `master_monsters` (`mon_id`),
  CONSTRAINT `fk_mai_ms` FOREIGN KEY (`ms_id`) REFERENCES `master_skills` (`ms_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `monster_ai_behavior` */

insert  into `monster_ai_behavior`(`mai_id`,`mon_id`,`condition_type`,`condition_value`,`ms_id`) values 
(1,1,NULL,NULL,7);

/*Table structure for table `player_gacha_pity` */

DROP TABLE IF EXISTS `player_gacha_pity`;

CREATE TABLE `player_gacha_pity` (
  `player_id` int NOT NULL,
  `gb_id` int NOT NULL,
  `pity_counter` int DEFAULT '0',
  PRIMARY KEY (`player_id`,`gb_id`),
  KEY `fk_pgp_gb` (`gb_id`),
  CONSTRAINT `fk_pgp_gb` FOREIGN KEY (`gb_id`) REFERENCES `gacha_banners` (`gb_id`),
  CONSTRAINT `fk_pgp_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `player_gacha_pity` */

/*Table structure for table `player_inventories` */

DROP TABLE IF EXISTS `player_inventories`;

CREATE TABLE `player_inventories` (
  `inv_id` bigint NOT NULL AUTO_INCREMENT,
  `player_id` int NOT NULL,
  `master_item_id` int NOT NULL,
  `item_type` enum('Character','Weapon') COLLATE utf8mb4_general_ci NOT NULL,
  `item_level` int DEFAULT '1',
  `item_exp` int DEFAULT '0',
  PRIMARY KEY (`inv_id`),
  KEY `player_id` (`player_id`),
  CONSTRAINT `fk_inv_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`)
) ENGINE=InnoDB AUTO_INCREMENT=206 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `player_inventories` */

insert  into `player_inventories`(`inv_id`,`player_id`,`master_item_id`,`item_type`,`item_level`,`item_exp`) values 
(101,1,1,'Character',80,0),
(102,1,2,'Character',80,0),
(103,1,3,'Character',80,0),
(104,1,4,'Character',80,0),
(201,1,1,'Weapon',150,0),
(202,1,2,'Weapon',100,0),
(203,1,3,'Weapon',100,0),
(204,1,4,'Weapon',150,0),
(205,1,5,'Weapon',150,0);

/*Table structure for table `player_materials` */

DROP TABLE IF EXISTS `player_materials`;

CREATE TABLE `player_materials` (
  `player_id` int NOT NULL,
  `mat_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`player_id`,`mat_id`),
  KEY `fk_pmat_mat` (`mat_id`),
  CONSTRAINT `fk_pmat_mat` FOREIGN KEY (`mat_id`) REFERENCES `master_materials` (`mat_id`),
  CONSTRAINT `fk_pmat_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `player_materials` */

/*Table structure for table `player_party_presets` */

DROP TABLE IF EXISTS `player_party_presets`;

CREATE TABLE `player_party_presets` (
  `ppp_id` int NOT NULL AUTO_INCREMENT,
  `player_id` int NOT NULL,
  `preset_slot` int NOT NULL,
  `main_char_inv_id` bigint NOT NULL,
  `char_slot_1_inv_id` bigint DEFAULT NULL,
  `char_slot_2_inv_id` bigint DEFAULT NULL,
  `char_slot_3_inv_id` bigint DEFAULT NULL,
  `weap_grid_1_inv_id` bigint NOT NULL,
  `weap_grid_2_inv_id` bigint DEFAULT NULL,
  `weap_grid_3_inv_id` bigint DEFAULT NULL,
  `weap_grid_4_inv_id` bigint DEFAULT NULL,
  `weap_grid_5_inv_id` bigint DEFAULT NULL,
  PRIMARY KEY (`ppp_id`),
  KEY `player_id` (`player_id`),
  KEY `fk_ppp_mc` (`main_char_inv_id`),
  KEY `fk_ppp_c1` (`char_slot_1_inv_id`),
  KEY `fk_ppp_w1` (`weap_grid_1_inv_id`),
  CONSTRAINT `fk_ppp_c1` FOREIGN KEY (`char_slot_1_inv_id`) REFERENCES `player_inventories` (`inv_id`),
  CONSTRAINT `fk_ppp_mc` FOREIGN KEY (`main_char_inv_id`) REFERENCES `player_inventories` (`inv_id`),
  CONSTRAINT `fk_ppp_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`),
  CONSTRAINT `fk_ppp_w1` FOREIGN KEY (`weap_grid_1_inv_id`) REFERENCES `player_inventories` (`inv_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `player_party_presets` */

insert  into `player_party_presets`(`ppp_id`,`player_id`,`preset_slot`,`main_char_inv_id`,`char_slot_1_inv_id`,`char_slot_2_inv_id`,`char_slot_3_inv_id`,`weap_grid_1_inv_id`,`weap_grid_2_inv_id`,`weap_grid_3_inv_id`,`weap_grid_4_inv_id`,`weap_grid_5_inv_id`) values 
(1,1,1,101,102,103,104,201,202,203,204,205);

/*Table structure for table `player_quests` */

DROP TABLE IF EXISTS `player_quests`;

CREATE TABLE `player_quests` (
  `pq_id` bigint NOT NULL AUTO_INCREMENT,
  `player_id` int NOT NULL,
  `mq_id` int NOT NULL,
  `pq_status` enum('In_Progress','Completed','Failed') COLLATE utf8mb4_general_ci NOT NULL,
  `bs_id` bigint DEFAULT NULL,
  PRIMARY KEY (`pq_id`),
  KEY `player_id` (`player_id`),
  KEY `mq_id` (`mq_id`),
  KEY `fk_pq_bs` (`bs_id`),
  CONSTRAINT `fk_pq_bs` FOREIGN KEY (`bs_id`) REFERENCES `battle_sessions` (`bs_id`),
  CONSTRAINT `fk_pq_mq` FOREIGN KEY (`mq_id`) REFERENCES `master_quests` (`mq_id`),
  CONSTRAINT `fk_pq_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `player_quests` */

/*Table structure for table `players` */

DROP TABLE IF EXISTS `players`;

CREATE TABLE `players` (
  `player_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `player_level` int DEFAULT '1',
  `player_exp` int DEFAULT '0',
  `stamina` int NOT NULL DEFAULT '100',
  `currency` int DEFAULT '0',
  PRIMARY KEY (`player_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `players` */

insert  into `players`(`player_id`,`username`,`password_hash`,`player_level`,`player_exp`,`stamina`,`currency`) values 
(1,'Gran','hash123',80,0,100,0);

/*Table structure for table `quest_enemies` */

DROP TABLE IF EXISTS `quest_enemies`;

CREATE TABLE `quest_enemies` (
  `mq_id` int NOT NULL,
  `mon_id` int NOT NULL,
  `monster_level` int NOT NULL DEFAULT '1',
  KEY `mq_id` (`mq_id`),
  KEY `mon_id` (`mon_id`),
  CONSTRAINT `fk_qe_mon` FOREIGN KEY (`mon_id`) REFERENCES `master_monsters` (`mon_id`),
  CONSTRAINT `fk_qe_mq` FOREIGN KEY (`mq_id`) REFERENCES `master_quests` (`mq_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `quest_enemies` */

insert  into `quest_enemies`(`mq_id`,`mon_id`,`monster_level`) values 
(1,1,1);

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
