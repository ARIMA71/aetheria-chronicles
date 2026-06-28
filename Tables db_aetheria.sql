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
  `unlock_limit_break` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`item_id`,`item_type`,`ms_id`),
  KEY `ms_id` (`ms_id`),
  KEY `idx_item_lookup` (`item_id`,`item_type`),
  CONSTRAINT `fk_itemskill_ms` FOREIGN KEY (`ms_id`) REFERENCES `master_skills` (`ms_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `item_skills` */

insert  into `item_skills`(`item_id`,`item_type`,`ms_id`,`unlock_level`,`unlock_limit_break`) values 
(1,'Character',1,1,0),
(1,'Character',2,1,0),
(1,'Character',3,12,0),
(1,'Character',4,5,0),
(1,'Character',5,10,0),
(1,'Character',6,15,0),
(1,'Character',7,18,0),
(1,'Character',8,20,0),
(1,'Weapon',33,1,0),
(1,'Weapon',34,1,0),
(2,'Character',9,1,0),
(2,'Character',10,1,0),
(2,'Character',11,40,1),
(2,'Weapon',36,1,0),
(2,'Weapon',37,1,0),
(3,'Character',13,1,0),
(3,'Character',14,1,0),
(3,'Character',15,40,1),
(3,'Weapon',128,1,0),
(3,'Weapon',129,1,0),
(4,'Character',17,1,0),
(4,'Character',18,1,0),
(4,'Character',19,40,1),
(4,'Weapon',131,1,0),
(4,'Weapon',132,1,0),
(5,'Character',21,1,0),
(5,'Character',22,1,0),
(5,'Character',23,40,1),
(5,'Weapon',161,1,0),
(5,'Weapon',162,1,0),
(6,'Character',25,1,0),
(6,'Character',26,1,0),
(6,'Character',27,40,1),
(6,'Weapon',164,1,0),
(6,'Weapon',165,1,0),
(7,'Character',29,1,0),
(7,'Character',30,1,0),
(7,'Character',31,40,1),
(7,'Weapon',39,1,0),
(7,'Weapon',40,1,0),
(8,'Character',52,1,0),
(8,'Character',53,1,0),
(8,'Character',54,30,1),
(8,'Weapon',42,1,0),
(8,'Weapon',43,1,0),
(9,'Character',80,1,0),
(9,'Character',81,1,0),
(9,'Character',82,30,1),
(9,'Weapon',45,1,0),
(9,'Weapon',46,1,0),
(10,'Character',84,1,0),
(10,'Character',85,1,0),
(10,'Character',86,30,1),
(10,'Weapon',112,1,0),
(11,'Character',100,1,0),
(11,'Character',101,1,0),
(11,'Character',102,30,1),
(11,'Weapon',114,1,0),
(12,'Character',104,1,0),
(12,'Character',105,1,0),
(12,'Character',106,30,1),
(12,'Weapon',134,1,0),
(12,'Weapon',135,1,0),
(13,'Character',108,1,0),
(13,'Character',109,1,0),
(13,'Character',110,30,1),
(13,'Weapon',138,1,0),
(14,'Character',88,1,0),
(14,'Character',89,1,0),
(14,'Character',90,30,1),
(14,'Weapon',140,1,0),
(14,'Weapon',141,1,0),
(15,'Character',92,1,0),
(15,'Character',93,1,0),
(15,'Character',94,30,1),
(15,'Weapon',143,1,0),
(16,'Character',96,1,0),
(16,'Character',97,1,0),
(16,'Character',98,40,1),
(16,'Weapon',145,1,0),
(17,'Weapon',167,1,0),
(17,'Weapon',168,1,0),
(18,'Weapon',170,1,0),
(18,'Weapon',171,1,0),
(19,'Weapon',173,1,0),
(19,'Weapon',174,1,0),
(20,'Weapon',176,1,0),
(21,'Weapon',178,1,0),
(22,'Weapon',116,1,0),
(23,'Weapon',118,1,0),
(24,'Weapon',120,1,0),
(25,'Weapon',122,1,0),
(26,'Weapon',124,1,0),
(27,'Weapon',126,1,0),
(28,'Weapon',147,1,0),
(29,'Weapon',149,1,0),
(30,'Weapon',151,1,0),
(31,'Weapon',153,1,0),
(32,'Weapon',155,1,0),
(33,'Weapon',157,1,0),
(34,'Weapon',159,1,0),
(35,'Weapon',180,1,0),
(36,'Weapon',182,1,0),
(37,'Weapon',184,1,0),
(38,'Weapon',186,1,0),
(39,'Weapon',188,1,0),
(40,'Weapon',190,1,0),
(41,'Weapon',192,1,0);

/*Table structure for table `master_characters` */

DROP TABLE IF EXISTS `master_characters`;

CREATE TABLE `master_characters` (
  `mc_id` int NOT NULL AUTO_INCREMENT,
  `mc_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mc_desc` text COLLATE utf8mb4_general_ci,
  `mc_rarity` enum('SR','SSR') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'SSR',
  `mc_element` enum('Fire','Wind','Earth','Any') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `mc_base_hp` int NOT NULL DEFAULT '100',
  `mc_hp_growth` int NOT NULL DEFAULT '0',
  `mc_base_atk` int NOT NULL DEFAULT '10',
  `mc_atk_growth` int NOT NULL DEFAULT '0',
  `mc_base_def` int NOT NULL DEFAULT '10',
  `mc_def_growth` float NOT NULL DEFAULT '0',
  `mc_max_sa` int NOT NULL DEFAULT '100',
  `mc_special_attack_id` int DEFAULT NULL,
  `mc_portrait_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mc_sprite_path` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`mc_id`),
  KEY `fk_mc_sa` (`mc_special_attack_id`),
  CONSTRAINT `fk_mc_sa` FOREIGN KEY (`mc_special_attack_id`) REFERENCES `master_skills` (`ms_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_characters` */

insert  into `master_characters`(`mc_id`,`mc_name`,`mc_desc`,`mc_rarity`,`mc_element`,`mc_base_hp`,`mc_hp_growth`,`mc_base_atk`,`mc_atk_growth`,`mc_base_def`,`mc_def_growth`,`mc_max_sa`,`mc_special_attack_id`,`mc_portrait_path`,`mc_sprite_path`) values 
(1,'Main Character (MC)','Karakter utama dalam cerita, selalu ada dalam party, dan bisa diganti gender','SSR','Any',300,130,1200,16,225,3.5,100,NULL,NULL,NULL),
(2,'Percival','Gacha atau Hadiah First Clear Impossible Quest','SSR','Fire',355,40,1510,15,250,4,100,12,NULL,NULL),
(3,'Lowenheigh','Gacha, Rare Drop Stage 7++, atau Impossible Quest','SSR','Fire',250,40,1280,15,250,4,100,16,NULL,NULL),
(4,'Siegfired','Gacha atau Hadiah First Clear Impossible Quest','SSR','Earth',280,40,1200,15,250,4,100,20,NULL,NULL),
(5,'Lowein','Gacha, Rare Drop Stage 7++, atau Impossible Quest','SSR','Earth',342,40,1150,15,250,4,100,24,NULL,NULL),
(6,'Ereshkigal','Gacha atau Hadiah First Clear Impossible Quest','SSR','Wind',350,40,1100,15,250,4,100,28,NULL,NULL),
(7,'Narmaya','Gacha, Rare Drop Stage 7++, atau Impossible Quest','SSR','Wind',280,40,1510,15,250,4,100,32,NULL,NULL),
(8,'Agris','Karakter diberikan gratis dari progres Quest 0-5','SR','Fire',255,30,890,10,200,2.5,100,55,NULL,NULL),
(9,'Ember','Karakter diberikan gratis dari progres Quest 0-5','SR','Fire',245,30,920,10,200,2.5,100,79,NULL,NULL),
(10,'Ferry','Gacha, Drop Stage 7, dan Impossible Quest','SR','Fire',260,30,900,10,200,2.5,100,83,NULL,NULL),
(11,'Ragnar','Gacha, Drop Stage 7, dan Impossible Quest','SR','Earth',270,30,800,10,200,2.5,100,99,NULL,NULL),
(12,'Terra','Karakter diberikan gratis dari progres Quest 0-5','SR','Earth',255,30,880,10,200,2.5,100,103,NULL,NULL),
(13,'Kael','Karakter diberikan gratis dari progres Quest 0-5','SR','Earth',235,30,925,10,200,2.5,100,107,NULL,NULL),
(14,'Diane','Karakter diberikan gratis dari progres Quest 0-5','SR','Wind',260,30,875,10,200,2.5,100,87,NULL,NULL),
(15,'Zephyra','Karakter diberikan gratis dari progres Quest 0-5','SR','Wind',225,30,950,10,200,2.5,100,91,NULL,NULL),
(16,'Zephyr','Karakter diberikan gratis dari progres Quest 0-5','SR','Wind',255,30,890,10,200,2.5,100,95,NULL,NULL);

/*Table structure for table `master_materials` */

DROP TABLE IF EXISTS `master_materials`;

CREATE TABLE `master_materials` (
  `mat_id` int NOT NULL AUTO_INCREMENT,
  `mat_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mat_desc` text COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`mat_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_materials` */

insert  into `master_materials`(`mat_id`,`mat_name`,`mat_desc`) values 
(1,'Ignis Orb','Material Limit Break Karakter/Senjata Api.'),
(2,'Ventus Orb','Material Limit Break Karakter/Senjata Angin.'),
(3,'Terra Orb','Material Limit Break Karakter/Senjata Tanah.'),
(4,'Enhance Crystal','Material EXP untuk menaikkan level Karakter.'),
(5,'Weapon Whetstone','Material EXP untuk menaikkan level Senjata.'),
(6,'Green Potion','Battle Item: Memulihkan 25% HP satu karakter.'),
(7,'Revive Elixir','Battle Item: Menghidupkan kembali party yang terkena wipeout.');

/*Table structure for table `master_monsters` */

DROP TABLE IF EXISTS `master_monsters`;

CREATE TABLE `master_monsters` (
  `mon_id` int NOT NULL AUTO_INCREMENT,
  `mon_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mon_type` enum('Normal','Boss') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Normal',
  `mon_element` enum('Fire','Wind','Earth') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `mon_base_hp` int NOT NULL,
  `mon_hp_growth` int NOT NULL DEFAULT '0',
  `mon_base_atk` int NOT NULL,
  `mon_atk_growth` int NOT NULL DEFAULT '0',
  `mon_base_def` int NOT NULL DEFAULT '10',
  `mon_def_growth` int NOT NULL DEFAULT '0',
  `mon_max_ca` int NOT NULL DEFAULT '5',
  `mon_icon_path` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mon_sprite_path` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`mon_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_monsters` */

insert  into `master_monsters`(`mon_id`,`mon_name`,`mon_type`,`mon_element`,`mon_base_hp`,`mon_hp_growth`,`mon_base_atk`,`mon_atk_growth`,`mon_base_def`,`mon_def_growth`,`mon_max_ca`,`mon_icon_path`,`mon_sprite_path`) values 
(1,'Clams','Normal','Wind',15000,1500,150,15,50,5,2,NULL,NULL),
(2,'Fire Spirit','Normal','Fire',25000,2500,300,30,100,10,3,NULL,NULL),
(3,'Iron Fist','Normal','Earth',35000,3500,450,45,120,12,2,NULL,NULL),
(4,'Flame Lizard','Normal','Fire',50000,5000,600,60,150,15,3,NULL,NULL),
(5,'Syren','Boss','Wind',105000,10500,830,83,195,20,4,NULL,NULL),
(6,'Giant Skeleton','Normal','Earth',65000,6500,750,75,180,18,3,NULL,NULL),
(7,'Ashound','Boss','Fire',250000,25000,1000,100,225,23,4,NULL,NULL),
(8,'Golem','Boss','Earth',500000,50000,1250,125,250,25,4,NULL,NULL),
(9,'Shadow Syren','Boss','Wind',1200000,120000,2000,200,425,43,4,NULL,NULL),
(10,'Shadow Ashound','Boss','Fire',1400000,140000,1800,180,450,45,4,NULL,NULL),
(11,'Shadow Golem','Boss','Earth',1100000,110000,2200,220,400,40,5,NULL,NULL);

/*Table structure for table `master_quests` */

DROP TABLE IF EXISTS `master_quests`;

CREATE TABLE `master_quests` (
  `mq_id` int NOT NULL AUTO_INCREMENT,
  `mq_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mq_stamina_cost` int NOT NULL DEFAULT '10',
  `mq_power_lvl` int NOT NULL DEFAULT '0',
  `mq_order` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`mq_id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_quests` */

insert  into `master_quests`(`mq_id`,`mq_name`,`mq_stamina_cost`,`mq_power_lvl`,`mq_order`) values 
(1,'Stage 0: Tutorial',10,1000,0),
(2,'Stage 1: The Awakening',10,1500,1),
(3,'Stage 2: Goblin Incursion',15,2500,2),
(4,'Stage 3: Windy Plains',15,4000,3),
(5,'Stage 4: Syren\'s Domain',20,6500,4),
(6,'Stage 5: Rocky Path',20,9000,5),
(7,'Stage 6: The Scorched Earth',25,12000,6),
(8,'Stage 7: Gates of the Abyss',30,15000,7),
(9,'Impossible: Syren of the Storm',40,30000,8),
(10,'Impossible: Ashound of the Inferno',50,30000,9),
(11,'Impossible: Titan of the Depths',50,30000,10);

/*Table structure for table `master_skills` */

DROP TABLE IF EXISTS `master_skills`;

CREATE TABLE `master_skills` (
  `ms_id` int NOT NULL AUTO_INCREMENT,
  `ms_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `ms_desc` text COLLATE utf8mb4_general_ci,
  `ms_element` enum('Fire','Wind','Earth','Any') COLLATE utf8mb4_general_ci NOT NULL,
  `ms_category` enum('Special','Active','Passive') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Active',
  `ms_target_type` enum('Single_Enemy','All_Enemies','Single_Ally','All_Allies','Self') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Single_Enemy',
  `ms_action_type` enum('Damage','Support','Heal','Cleanse','Revive') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ms_cooldown` int DEFAULT '0',
  `ms_modifier_value` float NOT NULL DEFAULT '0',
  `ms_sa_cost` int NOT NULL DEFAULT '0',
  `ms_sa_gain` int NOT NULL DEFAULT '0',
  `trigger_dispel` tinyint(1) NOT NULL DEFAULT '0',
  `trigger_delay` tinyint(1) NOT NULL DEFAULT '0',
  `trigger_heal_pct` float NOT NULL DEFAULT '0',
  `hp_cost_pct` float NOT NULL DEFAULT '0',
  `ms_icon_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ms_vfx_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`ms_id`)
) ENGINE=InnoDB AUTO_INCREMENT=193 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_skills` */

insert  into `master_skills`(`ms_id`,`ms_name`,`ms_desc`,`ms_element`,`ms_category`,`ms_target_type`,`ms_action_type`,`ms_cooldown`,`ms_modifier_value`,`ms_sa_cost`,`ms_sa_gain`,`trigger_dispel`,`trigger_delay`,`trigger_heal_pct`,`hp_cost_pct`,`ms_icon_path`,`ms_vfx_path`) values 
(1,'Inspire','Big boost to allies ATK','Any','Active','All_Allies','Support',5,0,0,0,0,0,0,0,NULL,NULL),
(2,'Dark Haze','Medium Hit to ATK and DEF for All enemies','Any','Active','All_Enemies','Support',6,0,0,0,0,0,0,0,NULL,NULL),
(3,'Armor Break','Medium damage to enemy / Hit to Def','Any','Active','Single_Enemy','Damage',4,2,0,0,0,0,0,0,NULL,NULL),
(4,'Slash','180% elemental damage to enemy','Any','Active','Single_Enemy','Damage',4,1.8,0,0,0,0,0,0,NULL,NULL),
(5,'Dispel','Remove 1 buff enemy effect','Any','Active','Single_Enemy','Support',5,0,0,0,1,0,0,0,NULL,NULL),
(6,'Refresh','Clear All debuff on team and heal 20% of max HP','Any','Active','All_Allies','Cleanse',5,0.2,0,0,0,0,0,0,NULL,NULL),
(7,'Surge','Big elemental damage to enemy','Any','Active','Single_Enemy','Damage',6,2.5,0,0,0,0,0,0,NULL,NULL),
(8,'Revive','Revive an ally with 20% from Max HP','Any','Active','Single_Ally','Revive',11,0.2,0,0,0,0,0,0,NULL,NULL),
(9,'Zerreissen','Big Fire damage to single enemy','Fire','Active','Single_Enemy','Damage',4,2.5,0,0,0,0,0,0,NULL,NULL),
(10,'Scheneiden','280% Fire damage to single enemy','Fire','Active','Single_Enemy','Damage',6,2.8,0,0,0,0,0,0,NULL,NULL),
(11,'Roter Wirbel','300% Fire damage to all enemy / Boost fire allies ATK','Fire','Active','All_Enemies','Damage',6,3,0,0,0,0,0,0,NULL,NULL),
(12,'Feuersturm Glanz','Massive fire damage / Inflict stun for 1 turn','Fire','Special','Single_Enemy','Damage',0,4,100,0,0,0,0,0,NULL,NULL),
(13,'Free Rein','Medium boost to all allies DEF','Fire','Active','All_Allies','Support',6,0,0,0,0,0,0,0,NULL,NULL),
(14,'Fortitude','Big boost to Fire allies ATK','Fire','Active','All_Allies','Support',6,0,0,0,0,0,0,0,NULL,NULL),
(15,'Salvator','Small Fire damage to single enemy / Drain 1 enemy Charge Bar','Fire','Active','Single_Enemy','Damage',5,1.5,0,0,0,1,0,0,NULL,NULL),
(16,'Löwenherz Kataklysmus','Massive fire damage / Drain 1 enemy Charge Bar','Fire','Special','Single_Enemy','Damage',0,4,100,0,0,1,0,0,NULL,NULL),
(17,'Manigance','Medium Earth Damage to single enemy','Earth','Active','Single_Enemy','Damage',4,2,0,0,0,0,0,0,NULL,NULL),
(18,'Verdrangen','300% Earth Damage to single enemy / Consume 10% HP from self','Earth','Active','Single_Enemy','Damage',6,3,0,0,0,0,0,0.1,NULL,NULL),
(19,'Tetradachm','Big earth damage to single enemy','Earth','Active','Single_Enemy','Damage',6,2.5,0,0,0,1,0,0,NULL,NULL),
(20,'Siegfried Special Attack','Ultra earth damage','Earth','Special','Single_Enemy','Damage',0,4.5,100,0,0,0,0,0,NULL,NULL),
(21,'Sharp Reflexes','Medium Hit to ATK and DEF for All enemies','Earth','Active','All_Enemies','Support',5,0,0,10,0,0,0,0,NULL,NULL),
(22,'Renewed Vigor','Small Earth damage / inflict Poison and Delay','Earth','Active','Single_Enemy','Damage',6,1.5,0,10,0,1,0,0,NULL,NULL),
(23,'Soldier Swiftness','SA bar gain / Medium boost to Critical hit and DEF','Earth','Active','All_Allies','Support',5,0,0,10,0,0,0,0,NULL,NULL),
(24,'Lowein Special Attack','Massive earth damage / remove 1 enemy buff effect','Earth','Special','Single_Enemy','Damage',0,4,100,0,1,0,0,0,NULL,NULL),
(25,'Noble Moon','20% boost to allies SA bar / Medium boost to ATK and DEF','Wind','Active','All_Allies','Support',5,0,0,10,0,0,0,0,NULL,NULL),
(26,'Oath of Lumiel','Medium wind damage to all enemies','Wind','Active','All_Enemies','Damage',5,2,0,10,0,0,0,0,NULL,NULL),
(27,'Assimilation','300% Wind damage to single enemy / Drain 1 enemy Charge Bar','Wind','Active','Single_Enemy','Damage',7,3,0,10,0,1,0,0,NULL,NULL),
(28,'Kurkigal Kataklysm','Massive wind damage / Boost Wind allies ATK','Wind','Special','Single_Enemy','Damage',0,4,100,0,0,0,0,0,NULL,NULL),
(29,'Butterfly Effect','Boost to ATK / Critical hit','Wind','Active','Self','Support',6,0,0,10,0,0,0,0,NULL,NULL),
(30,'Transient','Boost to DEF / Counter upon getting hit','Wind','Active','Self','Support',5,0,0,10,0,0,0,0,NULL,NULL),
(31,'Kyokasuigetsu','Guarantee Critical Hit / Critical damage up to all allies','Wind','Active','All_Allies','Support',7,0,0,10,0,0,0,0,NULL,NULL),
(32,'Setsuna Kagura','Ultra Wind damage / inflict stun','Wind','Special','Single_Enemy','Damage',0,4.5,100,0,0,0,0,0,NULL,NULL),
(33,'Vermilion Majesty I','Big boost to Fire allies ATK and HP','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(34,'Vermilion Majesty II','Big boost to Fire allies Critical Hit','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(35,'Lord of Vermilion Special Attack','Ultra Fire damage','Fire','Special','Single_Enemy','Damage',0,4.5,100,0,0,0,0,0,NULL,NULL),
(36,'Lohengrin Majesty I','Big boost to Fire allies DEF','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(37,'Lohengrin Majesty II','Big boost to Fire allies ATK','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(38,'Lohengrin Special Attack','Massive Fire damage / Medium ATK Buff to Fire allies','Fire','Special','Single_Enemy','Damage',0,4,100,0,0,0,0,0,NULL,NULL),
(39,'Flamebound Might','Medium boost to Fire allies ATK','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(40,'Flamebound Fowl','Small boost to Fire allies HP','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(41,'Flamebound Saber Special Attack','Big Fire damage','Fire','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(42,'Infernal Might','Medium boost to Fire allies ATK','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(43,'Infernal Edge','Small boost to Fire allies Critical Hit','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(44,'Infernal Brand Special Attack','Big Fire damage','Fire','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(45,'Ember Aegis','Small boost to Fire allies HP','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(46,'Ember Might','Medium boost to Fire allies Critical Hit','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(47,'Ember Edge Special Attack','Big Fire damage','Fire','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(48,'Flute','Inflict Sleep (Stun) to all enemies','Wind','Special','All_Enemies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(49,'Typhoon','Medium Wind damage and DEF Down to all enemies','Wind','Special','All_Enemies','Damage',0,2,0,0,0,0,0,0,NULL,NULL),
(50,'Slingshot','Big Wind damage and Dispel to single enemy','Wind','Special','Single_Enemy','Damage',0,3,0,0,1,0,0,0,NULL,NULL),
(51,'Siren\'s Requiem','Massive Wind damage to all enemies (Activates at 50% HP)','Wind','Special','All_Enemies','Damage',0,4,0,0,0,0,0,0,NULL,NULL),
(52,'Blazing Strike','Small Fire damage to all enemies','Fire','Active','All_Enemies','Damage',4,2,0,10,0,0,0,0,NULL,NULL),
(53,'Flame Strike','Medium Fire damage to single enemy','Fire','Active','Single_Enemy','Damage',5,3,0,10,0,0,0,0,NULL,NULL),
(54,'Blazing Brand','Small Fire damage / Inflict Poison (Burn)','Fire','Active','Single_Enemy','Damage',5,1.2,0,10,0,0,0,0,NULL,NULL),
(55,'Prominence Brandish','Big Fire damage to single enemy','Fire','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(56,'Pearl Shot','160% Wind damage to single enemy','Wind','Special','Single_Enemy','Damage',0,1.6,0,0,0,0,0,0,NULL,NULL),
(57,'Gusty Clap','120% Wind damage to all enemies','Wind','Special','All_Enemies','Damage',0,1.2,0,0,0,0,0,0,NULL,NULL),
(58,'Shell Harden','Medium Boost to DEF','Wind','Special','Self','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(59,'Ember Spit','170% Fire damage to single enemy','Fire','Special','Single_Enemy','Damage',0,1.7,0,0,0,0,0,0,NULL,NULL),
(60,'Heat Wave','130% Fire damage to all enemies / Inflict Burn','Fire','Special','All_Enemies','Damage',0,1.3,0,0,0,0,0,0,NULL,NULL),
(61,'Ignite Core','Medium Boost to ATK','Fire','Special','Self','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(62,'Knuckle Slam','180% Earth damage to single enemy','Earth','Special','Single_Enemy','Damage',0,1.8,0,0,0,0,0,0,NULL,NULL),
(63,'Tremor','140% Earth damage to all enemies','Earth','Special','All_Enemies','Damage',0,1.4,0,0,0,0,0,0,NULL,NULL),
(64,'Iron Guard','Big Boost to DEF','Earth','Special','Self','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(65,'Tail Swipe','160% Fire damage to single enemy','Fire','Special','Single_Enemy','Damage',0,1.6,0,0,0,0,0,0,NULL,NULL),
(66,'Singe Breath','120% Fire damage to all enemies / Inflict Burn','Fire','Special','All_Enemies','Damage',0,1.2,0,0,0,0,0,0,NULL,NULL),
(67,'Scale Harden','Medium boost to self DEF','Fire','Special','Self','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(68,'Undead Aura','Inflict Fear to random enemies / Inflict medium DEF down to all enemies','Earth','Special','All_Enemies','Support',0,1.7,0,0,0,0,0,0,NULL,NULL),
(69,'Undead Fury','Medium boost to self ATK','Earth','Special','Self','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(70,'Graveyard Sweep','130% Earth damage to all enemies / Inflict Medium ATK Down','Earth','Special','All_Enemies','Damage',0,1.3,0,0,0,0,0,0,NULL,NULL),
(71,'Scorching Bark','Medium Fire damage / ATK Down to all enemies','Fire','Special','All_Enemies','Damage',0,2,0,0,0,0,0,0,NULL,NULL),
(72,'Infernal Fang','Big Fire damage / Inflict Burn to single enemy','Fire','Special','Single_Enemy','Damage',0,3,0,0,0,0,0,0,NULL,NULL),
(73,'Feral Howl','Big boost to self ATK and Critical','Fire','Special','Self','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(74,'Hellfire Cataclysm','Massive Fire damage to all enemies / Dispel Effect (Activates at 50% HP)','Fire','Special','All_Enemies','Damage',0,4,0,0,1,0,0,0,NULL,NULL),
(75,'Seismic Stomp','Medium Earth damage and DEF Down to all enemies','Earth','Special','All_Enemies','Damage',0,2,0,0,0,0,0,0,NULL,NULL),
(76,'Megaton Crush','Big Earth damage to single enemy','Earth','Special','Single_Enemy','Damage',0,3.2,0,0,0,0,0,0,NULL,NULL),
(77,'Earthen Bastion','Big boost to self DEF','Earth','Special','Self','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(78,'Gaia Obliteration','Big Earth damage to all enemies / Inflict Stun (Activates at 25% HP)','Earth','Special','All_Enemies','Damage',0,3,0,0,0,0,0,0,NULL,NULL),
(79,'Promethean Spark','Big Fire damage to single enemy','Fire','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(80,'Vitality Spark','Heal 10% of max HP to all allies','Fire','Active','All_Allies','Heal',4,0.1,0,10,0,0,0,0,NULL,NULL),
(81,'Kindle Spirit','Small boost to all allies ATK','Fire','Active','All_Allies','Support',4,0,0,10,0,0,0,0,NULL,NULL),
(82,'Purifying Flame','Small Fire damage to enemy / Remove 1 enemy buff effect','Fire','Active','Single_Enemy','Damage',5,2,0,10,1,0,0,0,NULL,NULL),
(83,'Phantasmagoria','Big Fire damage to single enemy','Fire','Special','Single_Enemy','Damage',0,3.5,100,0,0,1,0,0,NULL,NULL),
(84,'Phantom Veil','Small hit to enemy ATK and DEF','Fire','Active','Single_Enemy','Support',5,2,0,10,0,0,0,0,NULL,NULL),
(85,'Cursed Flames','Inflict Burn and Delay effect to single enemy','Fire','Active','Single_Enemy','Support',5,0,0,10,0,1,0,0,NULL,NULL),
(86,'Flame Burst','Small Fire damage to all enemies','Fire','Active','All_Enemies','Damage',4,1.5,0,10,0,0,0,0,NULL,NULL),
(87,'Tempest Blade','Big Wind damage to single enemy','Wind','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(88,'Vicious','Small Wind damage to single enemy','Wind','Active','Single_Enemy','Damage',3,1.5,0,10,0,0,0,0,NULL,NULL),
(89,'Wind Stomp','Medium Wind damage to single enemy','Wind','Active','Single_Enemy','Damage',5,2,0,10,0,0,0,0,NULL,NULL),
(90,'Gale Strike','Small Wind damage to all enemies / Inflict DEF Down','Wind','Active','All_Enemies','Damage',4,1.5,0,10,0,0,0,0,NULL,NULL),
(91,'Sylphid Blessing','Big Wind damage to single enemy / Restore Wind allies HP','Wind','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0.1,0,NULL,NULL),
(92,'Purifying Breeze','Restore 10% HP to all allies and clear 1 debuff','Wind','Active','All_Allies','Cleanse',4,0.1,0,10,0,0,0,0,NULL,NULL),
(93,'Wind Whispers','Small boost to Wind allies ATK and Critical Hit rate','Wind','Active','All_Allies','Support',5,0,0,10,0,0,0,0,NULL,NULL),
(94,'Aegis Shield','Medium boost to all allies DEF','Wind','Active','All_Allies','Support',4,0,0,10,0,0,0,0,NULL,NULL),
(95,'Aero Cataclysm','Big Wind damage to single enemy / Drain enemy Charge Bar','Wind','Special','Single_Enemy','Damage',0,3.5,100,0,0,1,0,0,NULL,NULL),
(96,'Gale Force','Small Hit to enemies DEF / Small Boost Wind allies Critical rate','Wind','Active','All_Enemies','Support',4,0,0,10,0,0,0,0,NULL,NULL),
(97,'Aero Drain','Drain 1 enemy Charge Bar','Wind','Active','Single_Enemy','Support',4,0,0,10,0,1,0,0,NULL,NULL),
(98,'Zephyr Gale','Small Wind damage to single enemy / Remove 1 enemy buff effect','Wind','Active','Single_Enemy','Damage',5,1.5,0,10,1,0,0,0,NULL,NULL),
(99,'Megaton Pillar','Big Earth damage to single enemy','Earth','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(100,'Stone Pillar','Small Earth damage to single enemy','Earth','Active','Single_Enemy','Damage',3,1.5,0,10,0,0,0,0,NULL,NULL),
(101,'Terra Strike','Medium Earth damage to single enemy','Earth','Active','Single_Enemy','Damage',5,2,0,10,0,0,0,0,NULL,NULL),
(102,'Earthquake','Small Earth damage to all enemies / Small Hit to ATK','Earth','Active','All_Enemies','Damage',4,1.5,0,10,0,0,0,0,NULL,NULL),
(103,'Gaia Sunder','Big Earth damage to single enemy / Small boost to self DEF','Earth','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(104,'Bastion of Terra','Medium boost to self DEF / Substitute attacks to self','Earth','Active','Self','Support',6,0,0,10,0,0,0,0,NULL,NULL),
(105,'Stone Bulwark','Small boost to party DEF','Earth','Active','All_Allies','Support',4,0,0,10,0,0,0,0,NULL,NULL),
(106,'Breaker','Remove 1 enemy buff effect','Earth','Active','Single_Enemy','Support',5,0,0,10,1,0,0,0,NULL,NULL),
(107,'Terrestria Sanctum','Big Earth damage to single enemy','Earth','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(108,'Spirit of Grace','Restore 10% party HP / Boost party Charge Bar by 20%','Earth','Active','All_Allies','Heal',5,0.1,0,20,0,0,0,0,NULL,NULL),
(109,'Purifying Mist','Clear all debuffs on party','Earth','Active','All_Allies','Cleanse',4,0,0,10,0,0,0,0,NULL,NULL),
(110,'Radiant Valor','Medium boost to party ATK','Earth','Active','All_Allies','Support',5,0,0,10,0,0,0,0,NULL,NULL),
(111,'Cinder Blade Strike','Big Fire damage to enemy','Fire','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(112,'Cinder Might','Medium boost to Fire allies ATK','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(113,'Inferno Edge Strike','Big Fire damage to enemy','Fire','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(114,'Inferno Aegis','Medium boost to Fire allies HP','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(115,'Ember Blade Charge','Medium Fire damage to enemy','Fire','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(116,'Ember Might','Small boost to Fire allies ATK','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(117,'Inferno Fang Charge','Medium Fire damage to enemy','Fire','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(118,'Inferno Edge','Small boost to Fire allies Critical rate','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(119,'Ashertein Charge','Medium Fire damage to enemy','Fire','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(120,'Ashertein Might','Small boost to Fire allies ATK','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(121,'Fire Pillar Charge','Medium Fire damage to enemy','Fire','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(122,'Fire Pillar Aegis','Small boost to Fire allies HP','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(123,'Crimson Ember Charge','Medium Fire damage to enemy','Fire','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(124,'Crimson Bastion','Small boost to Fire allies DEF','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(125,'Ignis Fatuus Charge','Medium Fire damage to enemy','Fire','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(126,'Ignis Might','Small boost to Fire allies ATK','Fire','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(127,'Balmung Strike','Ultra Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,4.5,100,0,0,0,0,0,NULL,NULL),
(128,'Balmung Majesty I','Big boost to Earth allies Critical Hit','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(129,'Balmung Majesty II','Big boost to Earth allies ATK','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(130,'Sinensis Strike','Massive Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,4,100,0,0,0,0,0,NULL,NULL),
(131,'Sinensis Bastion I','Big boost to Earth allies DEF & HP','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(132,'Sinensis Bastion II','10% cut to Earth allies ATK','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(133,'Terra Sunder Strike','Big Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(134,'Terra Sunder Might','Medium boost to Earth allies ATK','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(135,'Terra Sunder Aegis','Small boost to Earth allies HP','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(136,'Earth Breaker Strike','Big Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(137,'Earth Breaker Bastion','Medium boost to Earth allies DEF','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(138,'Earth Breaker Aegis','Small boost to Earth allies HP','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(139,'Earth Splitter Strike','Big Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(140,'Earth Splitter Aegis','Medium boost to Earth allies HP','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(141,'Earth Splitter Edge','Small boost to Earth allies Critical Hit','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(142,'Terra Edge Strike','Big Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(143,'Terra Edge Might','Medium boost to Earth allies ATK','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(144,'Loberg Strike','Big Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(145,'Loberg Bastion','Medium boost to Earth allies DEF','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(146,'Earth Crusher Charge','Medium Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(147,'Earth Crusher Might','Small boost to Earth allies ATK','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(148,'Earth Shard Charge','Medium Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(149,'Earth Shard Aegis','Small boost to Earth allies HP','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(150,'Gaia Crag Charge','Medium Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(151,'Gaia Crag Bastion','Small boost to Earth allies DEF','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(152,'Terra Breaker Charge','Medium Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(153,'Terra Breaker Edge','Small boost to Earth allies Critical Hit','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(154,'Earthbreaker Charge','Medium Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(155,'Earthbreaker Might','Small boost to Earth allies ATK','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(156,'Girbaltein Charge','Medium Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(157,'Girbaltein Aegis','Small boost to Earth allies HP','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(158,'Steins Charge','Medium Earth damage to enemy','Earth','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(159,'Steins Bastion','Small boost to Earth allies DEF','Earth','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(160,'Ascalon Strike','Massive Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,4,100,0,0,0,0,0,NULL,NULL),
(161,'Ascalon Majesty I','Big boost to Wind allies ATK & HP','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(162,'Ascalon Majesty II','Big boost to Wind allies Critical rate','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(163,'Evanescence Strike','Ultra Wind damage / Boost Wind allies Critical','Wind','Special','Single_Enemy','Damage',0,4.5,100,0,0,0,0,0,NULL,NULL),
(164,'Evanescence Bastion I','Medium boost to Wind allies DEF & ATK','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(165,'Evanescence Bastion II','10% cut to Wind allies Max HP','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(166,'Gale Force Strike','Big Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(167,'Gale Force Might','Medium boost to Wind allies ATK','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(168,'Gale Force Aegis','Small boost to Wind allies HP','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(169,'Sky Breaker Strike','Big Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(170,'Sky Breaker Aegis','Medium boost to Wind allies HP','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(171,'Sky Breaker Might','Small boost to Wind allies ATK','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(172,'Gale Whisperer Strike','Big Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(173,'Gale Whisperer Aegis','Medium boost to Wind allies HP','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(174,'Gale Whisperer Edge','Small boost to Wind allies Critical rate','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(175,'Zephyr Gale Strike','Big Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(176,'Zephyr Gale Might','Medium boost to Wind allies ATK','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(177,'Wind Whisperer Strike','Big Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3.5,100,0,0,0,0,0,NULL,NULL),
(178,'Wind Whisperer Aegis','Medium boost to Wind allies HP','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(179,'Zephyr Gale R Charge','Medium Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(180,'Zephyr Gale R Might','Small boost to Wind allies ATK','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(181,'Wind Whisper Charge','Medium Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(182,'Wind Whisper Might','Small boost to Wind allies ATK','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(183,'Sky Piercer Charge','Medium Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(184,'Sky Piercer Aegis','Small boost to Wind allies HP','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(185,'Gale Storm Charge','Medium Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(186,'Gale Storm Might','Small boost to Wind allies ATK','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(187,'Gale Carver Charge','Medium Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(188,'Gale Carver Might','Small boost to Wind allies ATK','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(189,'Helios Charge','Medium Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(190,'Helios Aegis','Small boost to Wind allies HP','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL),
(191,'Whiztletein Charge','Medium Wind damage to enemy','Wind','Special','Single_Enemy','Damage',0,3,100,0,0,0,0,0,NULL,NULL),
(192,'Whiztletein Might','Small boost to Wind allies ATK','Wind','Passive','All_Allies','Support',0,0,0,0,0,0,0,0,NULL,NULL);

/*Table structure for table `master_status_effects` */

DROP TABLE IF EXISTS `master_status_effects`;

CREATE TABLE `master_status_effects` (
  `mse_id` int NOT NULL AUTO_INCREMENT,
  `mse_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mse_type` enum('Buff','Debuff') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Buff',
  `modifier_target` enum('ATK','DEF','ULT','STUN','POISON','HP','DISPEL','CRIT','CRIDMG','STANCE') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `modifier_value` float NOT NULL DEFAULT '0',
  `mse_duration` int DEFAULT NULL,
  `is_dispellable` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`mse_id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_status_effects` */

insert  into `master_status_effects`(`mse_id`,`mse_name`,`mse_type`,`modifier_target`,`modifier_value`,`mse_duration`,`is_dispellable`) values 
(1,'ATK Up (Big)','Buff','ATK',0.3,3,1),
(2,'ATK Down (Medium)','Debuff','ATK',-0.2,4,1),
(3,'DEF Down (Medium)','Debuff','DEF',-0.2,4,1),
(4,'DEF Down (25%)','Debuff','DEF',-0.25,3,1),
(5,'ATK Up (Perci)','Buff','ATK',0.25,2,1),
(6,'Stun','Debuff','STUN',0,1,1),
(8,'DEF Up (Lohei)','Buff','DEF',0.25,3,1),
(11,'ATK Down (Medium)','Debuff','ATK',-0.2,3,1),
(12,'DEF Down (Medium)','Debuff','DEF',-0.2,3,1),
(13,'Poison (5%)','Debuff','POISON',-0.05,3,1),
(14,'SA Bar Boost (20%)','Buff','ULT',0.2,0,1),
(15,'Critical Up (Medium)','Buff','CRIT',0.2,3,1),
(16,'DEF Up (Medium)','Buff','DEF',0.2,3,1),
(18,'ATK Up (Medium)','Buff','ATK',0.2,3,1),
(19,'ATK Up (Big)','Buff','ATK',0.3,3,1),
(20,'Critical Up (Big)','Buff','CRIT',0.3,3,1),
(21,'DEF Up (Big)','Buff','DEF',0.3,2,1),
(22,'Counter Stance','Buff','STANCE',0,2,1),
(23,'Guarantee Critical','Buff','CRIT',1,1,1),
(24,'Critical Damage Up','Buff','CRIDMG',0.2,1,1),
(25,'ATK Up (Small)','Buff','ATK',0.1,3,1),
(26,'ATK Down(Small)','Debuff','ATK',-0.1,3,1),
(27,'DEF Up (Small)','Buff','DEF',0.1,3,1),
(28,'DEF Down (Small)','Debuff','DEF',-0.1,3,1),
(29,'Critical Up (Small)','Buff','CRIT',0.1,3,1),
(30,'Substitute (Taunt)','Buff','STANCE',0,3,1),
(31,'Critical Ult (Eva)','Buff','CRIT',0.3,1,1);

/*Table structure for table `master_weapons` */

DROP TABLE IF EXISTS `master_weapons`;

CREATE TABLE `master_weapons` (
  `mw_id` int NOT NULL AUTO_INCREMENT,
  `mw_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `mw_rarity` enum('R','SR','SSR') COLLATE utf8mb4_general_ci DEFAULT 'R',
  `mw_element` enum('Fire','Wind','Earth') COLLATE utf8mb4_general_ci NOT NULL,
  `unlocks_mc_id` int DEFAULT NULL,
  `mw_special_attack_id` int DEFAULT NULL,
  `mw_base_hp` int NOT NULL DEFAULT '0',
  `mw_hp_growth` int NOT NULL DEFAULT '0',
  `mw_base_atk` int NOT NULL DEFAULT '0',
  `mw_atk_growth` int NOT NULL DEFAULT '0',
  `mw_img_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`mw_id`),
  KEY `fk_weapon_unlocks_char` (`unlocks_mc_id`),
  KEY `fk_mw_sa` (`mw_special_attack_id`),
  CONSTRAINT `fk_mw_sa` FOREIGN KEY (`mw_special_attack_id`) REFERENCES `master_skills` (`ms_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_weapon_unlocks_char` FOREIGN KEY (`unlocks_mc_id`) REFERENCES `master_characters` (`mc_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `master_weapons` */

insert  into `master_weapons`(`mw_id`,`mw_name`,`mw_rarity`,`mw_element`,`unlocks_mc_id`,`mw_special_attack_id`,`mw_base_hp`,`mw_hp_growth`,`mw_base_atk`,`mw_atk_growth`,`mw_img_path`) values 
(1,'Lord of Vermilion','SSR','Fire',2,35,31,3,370,6,NULL),
(2,'Lohengrin','SSR','Fire',3,38,28,3,385,6,NULL),
(3,'Balmung','SSR','Earth',4,127,33,3,367,6,NULL),
(4,'Sinensis','SSR','Earth',3,130,30,3,377,6,NULL),
(5,'Ascalon','SSR','Wind',6,160,45,3,325,6,NULL),
(6,'Evanescence','SSR','Wind',7,163,22,3,412,6,NULL),
(7,'Flamebound Saber','SR','Fire',8,41,25,2,215,4,NULL),
(8,'Infernal Brand','SR','Fire',9,44,22,2,245,4,NULL),
(9,'Ember Edge','SR','Fire',10,47,45,2,211,4,NULL),
(10,'Cinder Blade','SR','Fire',NULL,111,22,2,248,4,NULL),
(11,'Inferno Edge','SR','Fire',NULL,113,25,2,216,4,NULL),
(12,'Terra Sunder','SR','Earth',11,133,23,2,245,4,NULL),
(13,'Earth Breaker','SR','Earth',12,136,46,2,208,4,NULL),
(14,'Earth Splitter','SR','Earth',13,139,23,2,248,4,NULL),
(15,'Terra Edge','SR','Earth',NULL,142,25,2,217,4,NULL),
(16,'Loberg','SR','Earth',NULL,144,24,2,245,4,NULL),
(17,'Gale Force','SR','Wind',14,166,47,2,200,4,NULL),
(18,'Sky Breaker','SR','Wind',15,169,24,2,248,4,NULL),
(19,'Gale Whisperer','SR','Wind',16,172,25,2,218,4,NULL),
(20,'Zephyr Gale','SR','Wind',NULL,175,48,2,200,4,NULL),
(21,'Wind Whisperer','SR','Wind',NULL,177,25,2,248,4,NULL),
(22,'Ember Blade','R','Fire',NULL,115,32,1,120,2,NULL),
(23,'Inferno Fang','R','Fire',NULL,117,15,1,200,2,NULL),
(24,'Ashertein','R','Fire',NULL,119,29,1,178,2,NULL),
(25,'Fire Pillar','R','Fire',NULL,121,30,1,160,2,NULL),
(26,'Crimson Ember','R','Fire',NULL,123,22,1,189,2,NULL),
(27,'Ignis Fatuus','R','Fire',NULL,125,26,1,124,2,NULL),
(28,'Earth Crusher','R','Earth',NULL,146,24,1,137,2,NULL),
(29,'Earth Shard','R','Earth',NULL,148,32,1,121,2,NULL),
(30,'Gaia Crag','R','Earth',NULL,150,16,1,200,2,NULL),
(31,'Terra Breaker','R','Earth',NULL,152,30,1,178,2,NULL),
(32,'Earthbreaker','R','Earth',NULL,154,30,1,161,2,NULL),
(33,'Girbaltein','R','Earth',NULL,156,22,1,190,2,NULL),
(34,'Steins','R','Earth',NULL,158,26,1,125,2,NULL),
(35,'Zeros','R','Wind',NULL,179,24,1,138,2,NULL),
(36,'Wind Whisper','R','Wind',NULL,181,32,1,122,2,NULL),
(37,'Sky Piercer','R','Wind',NULL,183,17,1,200,2,NULL),
(38,'Gale Storm','R','Wind',NULL,185,31,1,178,2,NULL),
(39,'Gale Carver','R','Wind',NULL,187,30,1,162,2,NULL),
(40,'Helios','R','Wind',NULL,189,22,1,191,2,NULL),
(41,'Whiztletein','R','Wind',NULL,191,26,1,126,2,NULL);

/*Table structure for table `monster_behavior` */

DROP TABLE IF EXISTS `monster_behavior`;

CREATE TABLE `monster_behavior` (
  `mb_id` bigint NOT NULL AUTO_INCREMENT,
  `mon_id` int NOT NULL,
  `ms_id` int NOT NULL,
  `boss_phase` enum('Normal','Enraged','Exhausted') COLLATE utf8mb4_general_ci DEFAULT 'Normal',
  `base_utility` float NOT NULL DEFAULT '1',
  `score_modifiers` json DEFAULT NULL,
  PRIMARY KEY (`mb_id`),
  KEY `fk_mai_mon` (`mon_id`),
  KEY `fk_mai_ms` (`ms_id`),
  CONSTRAINT `fk_mai_mon` FOREIGN KEY (`mon_id`) REFERENCES `master_monsters` (`mon_id`),
  CONSTRAINT `fk_mai_ms` FOREIGN KEY (`ms_id`) REFERENCES `master_skills` (`ms_id`)
) ENGINE=InnoDB AUTO_INCREMENT=120 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `monster_behavior` */

insert  into `monster_behavior`(`mb_id`,`mon_id`,`ms_id`,`boss_phase`,`base_utility`,`score_modifiers`) values 
(49,5,48,'Normal',0.6,'{\"party_buff_count\": 0.25, \"party_debuff_count\": -0.1}'),
(50,5,48,'Enraged',0.9,'{\"party_buff_count\": 0.35, \"party_debuff_count\": -0.1}'),
(51,5,49,'Normal',1,'{\"party_buff_count\": -0.2, \"party_total_hp_pct\": 0.7}'),
(52,5,49,'Enraged',1.5,'{\"party_buff_count\": -0.2, \"party_total_hp_pct\": 0.8}'),
(53,5,50,'Normal',0.4,'{\"party_buff_count\": 0.4, \"party_lowest_hp_missing_pct\": 0.9}'),
(54,5,50,'Enraged',0.6,'{\"party_buff_count\": 0.5, \"party_lowest_hp_missing_pct\": 1.2}'),
(55,5,51,'Normal',0,'{\"override_hp_trigger\": 0.5}'),
(56,5,51,'Enraged',0,'{\"override_hp_trigger\": 0.5}'),
(57,1,56,'Normal',1,'{}'),
(58,1,57,'Normal',1,'{}'),
(59,1,58,'Normal',1,'{}'),
(60,2,59,'Normal',1,'{}'),
(61,2,60,'Normal',1,'{}'),
(62,2,61,'Normal',1,'{}'),
(63,3,62,'Normal',1,'{}'),
(64,3,63,'Normal',1,'{}'),
(65,3,64,'Normal',1,'{}'),
(66,4,65,'Normal',1,'{}'),
(67,4,66,'Normal',1,'{}'),
(68,4,67,'Normal',1,'{}'),
(69,6,68,'Normal',1,'{}'),
(70,6,69,'Normal',1,'{}'),
(71,6,70,'Normal',1,'{}'),
(104,7,71,'Normal',1,'{\"party_total_hp_pct\": 0.6}'),
(105,7,71,'Enraged',1.4,'{\"party_total_hp_pct\": 0.8}'),
(106,7,72,'Normal',0.5,'{\"party_debuff_count\": 0.2, \"party_lowest_hp_missing_pct\": 1.0}'),
(107,7,72,'Enraged',0.8,'{\"party_debuff_count\": 0.3, \"party_lowest_hp_missing_pct\": 1.4}'),
(108,7,73,'Normal',0.4,'{\"boss_buff_count\": -0.5, \"party_total_hp_pct\": 0.5}'),
(109,7,73,'Enraged',0.6,'{\"boss_buff_count\": -0.7, \"party_total_hp_pct\": 0.6}'),
(110,7,74,'Normal',0,'{\"override_hp_trigger\": 0.5}'),
(111,7,74,'Enraged',0,'{\"override_hp_trigger\": 0.5}'),
(112,8,75,'Normal',1,'{\"party_debuff_count\": -0.2, \"party_total_hp_pct\": 0.6}'),
(113,8,75,'Enraged',1.3,'{\"party_debuff_count\": -0.2, \"party_total_hp_pct\": 0.8}'),
(114,8,76,'Normal',0.5,'{\"party_buff_count\": 0.3, \"party_lowest_hp_missing_pct\": 1.1}'),
(115,8,76,'Enraged',0.8,'{\"party_buff_count\": 0.4, \"party_lowest_hp_missing_pct\": 1.5}'),
(116,8,77,'Normal',0.4,'{\"boss_buff_count\": -0.5, \"boss_debuff_count\": 0.4}'),
(117,8,77,'Enraged',0.7,'{\"boss_buff_count\": -0.7, \"boss_debuff_count\": 0.6}'),
(118,8,78,'Normal',0,'{\"override_hp_trigger\": 0.25}'),
(119,8,78,'Enraged',0,'{\"override_hp_trigger\": 0.25}');

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
  `limit_break_level` int NOT NULL DEFAULT '0',
  `item_exp` int DEFAULT '0',
  PRIMARY KEY (`inv_id`),
  KEY `player_id` (`player_id`),
  CONSTRAINT `fk_inv_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`)
) ENGINE=InnoDB AUTO_INCREMENT=226 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `player_inventories` */

insert  into `player_inventories`(`inv_id`,`player_id`,`master_item_id`,`item_type`,`item_level`,`limit_break_level`,`item_exp`) values 
(101,1,1,'Character',1,0,0),
(102,1,2,'Character',1,0,0),
(103,1,3,'Character',1,0,0),
(104,1,4,'Character',1,0,0),
(105,1,8,'Character',1,0,0),
(201,1,1,'Weapon',1,0,0),
(202,1,2,'Weapon',1,0,0),
(203,1,3,'Weapon',1,0,0),
(204,1,4,'Weapon',1,0,0),
(205,1,5,'Weapon',1,0,0),
(206,1,7,'Weapon',1,0,0),
(207,1,8,'Weapon',1,0,0),
(208,1,9,'Weapon',1,0,0),
(209,1,17,'Weapon',1,0,0),
(211,2,1,'Character',1,0,0),
(212,2,8,'Character',1,0,0),
(213,2,22,'Weapon',1,0,0),
(214,3,1,'Character',1,0,0),
(215,3,8,'Character',1,0,0),
(216,3,22,'Weapon',1,0,0),
(217,4,1,'Character',1,0,0),
(218,4,8,'Character',1,0,0),
(219,4,22,'Weapon',1,0,0),
(220,5,1,'Character',1,0,0),
(221,5,8,'Character',1,0,0),
(222,5,22,'Weapon',1,0,0),
(223,6,1,'Character',1,0,0),
(224,6,8,'Character',1,0,0),
(225,6,22,'Weapon',1,0,0);

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

insert  into `player_materials`(`player_id`,`mat_id`,`quantity`) values 
(1,2,3),
(1,6,6),
(1,7,10),
(2,6,3),
(3,6,3),
(4,6,3),
(5,6,3),
(6,6,3);

/*Table structure for table `player_mc_skills` */

DROP TABLE IF EXISTS `player_mc_skills`;

CREATE TABLE `player_mc_skills` (
  `ppp_id` int NOT NULL,
  `slot_number` int NOT NULL,
  `ms_id` int NOT NULL,
  PRIMARY KEY (`ppp_id`,`slot_number`),
  KEY `fk_pmcs_ms` (`ms_id`),
  CONSTRAINT `fk_pmcs_ms` FOREIGN KEY (`ms_id`) REFERENCES `master_skills` (`ms_id`),
  CONSTRAINT `fk_pmcs_ppp` FOREIGN KEY (`ppp_id`) REFERENCES `player_party_presets` (`ppp_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `player_mc_skills` */

insert  into `player_mc_skills`(`ppp_id`,`slot_number`,`ms_id`) values 
(1,1,1),
(2,1,1),
(3,1,1),
(4,1,1),
(5,1,1),
(6,1,1),
(2,2,2),
(3,2,2),
(4,2,2),
(5,2,2),
(6,2,2),
(1,3,3),
(2,3,3),
(3,3,3),
(4,3,3),
(5,3,3),
(6,3,3),
(1,4,4),
(2,4,4),
(3,4,4),
(4,4,4),
(5,4,4),
(6,4,4),
(1,2,8);

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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `player_party_presets` */

insert  into `player_party_presets`(`ppp_id`,`player_id`,`preset_slot`,`main_char_inv_id`,`char_slot_1_inv_id`,`char_slot_2_inv_id`,`char_slot_3_inv_id`,`weap_grid_1_inv_id`,`weap_grid_2_inv_id`,`weap_grid_3_inv_id`,`weap_grid_4_inv_id`,`weap_grid_5_inv_id`) values 
(1,1,1,101,102,103,105,201,202,206,207,208),
(2,2,1,211,212,NULL,NULL,213,NULL,NULL,NULL,NULL),
(3,3,1,214,215,NULL,NULL,216,NULL,NULL,NULL,NULL),
(4,4,1,217,218,NULL,NULL,219,NULL,NULL,NULL,NULL),
(5,5,1,220,221,NULL,NULL,222,NULL,NULL,NULL,NULL),
(6,6,1,223,224,NULL,NULL,225,NULL,NULL,NULL,NULL);

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
  `gold` int NOT NULL DEFAULT '0',
  `diamond` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`player_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `players` */

insert  into `players`(`player_id`,`username`,`password_hash`,`player_level`,`player_exp`,`stamina`,`gold`,`diamond`) values 
(1,'Gran','hash123',80,0,60,100000,3000),
(2,'player_1781438464120','pass123',1,0,100,0,0),
(3,'player_1781512001282','$2b$10$9qbWv3RYKO6f0P8imVEn7.E7a/fe3ndbYemtbi5ors26yh6ArbfDe',1,0,100,0,0),
(4,'player_1781870799283','$2b$10$Cm0BOJcJMQp7dEnvw0JjTOYI0hVaeZB6f5azPq.j8Nlm3m3noVyYu',1,0,100,0,0),
(5,'verify_user_1781870810193','$2b$10$Ip8Do.Jt.ATTZ7rfIP9XnuOgscMpIfZ4lxP5AGDP7pKroB0Ug0dwm',1,0,100,0,0),
(6,'tester_1781870829','$2b$10$F6Jj7JgBIrGk2vtr1OeSoeogEHw1xIT7M8trQQV.gAAoPNuXFIE6y',1,0,100,0,0);

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
(1,1,1),
(2,2,5),
(3,3,10),
(4,4,15),
(5,5,20),
(6,6,25),
(7,7,30),
(8,8,35),
(9,9,80),
(10,10,100),
(11,11,120);

/*Table structure for table `quest_rewards` */

DROP TABLE IF EXISTS `quest_rewards`;

CREATE TABLE `quest_rewards` (
  `qr_id` int NOT NULL AUTO_INCREMENT,
  `mq_id` int NOT NULL,
  `reward_type` enum('Material','Gold','Diamond','Weapon') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `reward_item_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `drop_chance` float NOT NULL DEFAULT '1',
  PRIMARY KEY (`qr_id`),
  KEY `fk_qr_mq` (`mq_id`),
  CONSTRAINT `fk_qr_mq` FOREIGN KEY (`mq_id`) REFERENCES `master_quests` (`mq_id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `quest_rewards` */

insert  into `quest_rewards`(`qr_id`,`mq_id`,`reward_type`,`reward_item_id`,`quantity`,`drop_chance`) values 
(13,5,'Gold',0,1500,1),
(14,5,'Material',6,1,0.5),
(15,5,'Material',2,1,0.5),
(16,5,'Weapon',17,1,0.05);

/*Table structure for table `skill_status_effects` */

DROP TABLE IF EXISTS `skill_status_effects`;

CREATE TABLE `skill_status_effects` (
  `ms_id` int NOT NULL,
  `mse_id` int NOT NULL,
  `apply_chance` float NOT NULL DEFAULT '1',
  `effect_target` enum('Target','Self','Allies') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Target',
  PRIMARY KEY (`ms_id`,`mse_id`),
  KEY `fk_sse_mse` (`mse_id`),
  CONSTRAINT `fk_sse_ms` FOREIGN KEY (`ms_id`) REFERENCES `master_skills` (`ms_id`),
  CONSTRAINT `fk_sse_mse` FOREIGN KEY (`mse_id`) REFERENCES `master_status_effects` (`mse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `skill_status_effects` */

insert  into `skill_status_effects`(`ms_id`,`mse_id`,`apply_chance`,`effect_target`) values 
(1,1,1,'Target'),
(2,2,1,'Target'),
(2,3,1,'Target'),
(3,4,1,'Target'),
(11,5,1,'Allies'),
(12,6,1,'Target'),
(13,8,1,'Target'),
(14,1,1,'Target'),
(21,11,1,'Target'),
(21,12,1,'Target'),
(22,13,1,'Target'),
(23,14,1,'Target'),
(23,15,1,'Target'),
(23,16,1,'Target'),
(25,14,1,'Target'),
(25,16,1,'Target'),
(25,18,1,'Target'),
(28,5,1,'Allies'),
(29,19,1,'Self'),
(29,20,1,'Self'),
(30,21,1,'Self'),
(30,22,1,'Self'),
(31,23,1,'Target'),
(31,24,1,'Target'),
(32,6,1,'Target'),
(38,18,1,'Allies'),
(48,6,1,'Target'),
(49,3,1,'Target'),
(51,3,1,'Target'),
(53,18,1,'Target'),
(54,13,1,'Target'),
(58,16,1,'Self'),
(60,13,1,'Target'),
(61,18,1,'Self'),
(64,21,1,'Self'),
(66,13,1,'Target'),
(67,16,1,'Self'),
(68,6,1,'Target'),
(68,12,1,'Target'),
(69,18,1,'Self'),
(70,11,1,'Target'),
(71,11,1,'Target'),
(72,13,1,'Target'),
(73,19,1,'Self'),
(73,20,1,'Self'),
(75,12,1,'Target'),
(77,21,1,'Self'),
(78,6,1,'Target'),
(81,18,1,'Target'),
(84,11,1,'Target'),
(84,12,1,'Target'),
(85,13,1,'Target'),
(90,28,1,'Target'),
(93,25,1,'Target'),
(93,29,1,'Target'),
(94,16,1,'Target'),
(96,28,1,'Target'),
(96,29,1,'Self'),
(102,26,1,'Target'),
(103,27,1,'Self'),
(104,16,1,'Self'),
(104,30,1,'Self'),
(105,27,1,'Target'),
(110,18,1,'Target'),
(163,31,1,'Allies');

/*Table structure for table `skill_weapon_modifiers` */

DROP TABLE IF EXISTS `skill_weapon_modifiers`;

CREATE TABLE `skill_weapon_modifiers` (
  `ms_id` int NOT NULL,
  `stat_target` enum('ATK','HP','DEF','CRIT') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `element_condition` enum('Fire','Wind','Earth','Any') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Fire',
  `modifier_value` float NOT NULL,
  PRIMARY KEY (`ms_id`,`stat_target`),
  CONSTRAINT `fk_spm_ms` FOREIGN KEY (`ms_id`) REFERENCES `master_skills` (`ms_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `skill_weapon_modifiers` */

insert  into `skill_weapon_modifiers`(`ms_id`,`stat_target`,`element_condition`,`modifier_value`) values 
(33,'ATK','Fire',0.2),
(33,'HP','Fire',0.2),
(34,'CRIT','Fire',0.2),
(36,'DEF','Fire',0.2),
(37,'ATK','Fire',0.2),
(39,'ATK','Fire',0.15),
(40,'HP','Fire',0.1),
(42,'ATK','Fire',0.15),
(43,'CRIT','Fire',0.1),
(45,'HP','Fire',0.1),
(46,'CRIT','Fire',0.15),
(112,'ATK','Fire',0.15),
(114,'HP','Fire',0.15),
(116,'ATK','Fire',0.1),
(118,'CRIT','Fire',0.1),
(120,'ATK','Fire',0.1),
(122,'HP','Fire',0.1),
(124,'DEF','Fire',0.1),
(126,'ATK','Fire',0.1),
(128,'CRIT','Earth',0.2),
(129,'ATK','Earth',0.2),
(131,'HP','Earth',0.2),
(131,'DEF','Earth',0.2),
(132,'ATK','Earth',-0.1),
(134,'ATK','Earth',0.15),
(135,'HP','Earth',0.1),
(137,'DEF','Earth',0.15),
(138,'HP','Earth',0.1),
(140,'HP','Earth',0.15),
(141,'CRIT','Earth',0.1),
(143,'ATK','Earth',0.15),
(145,'DEF','Earth',0.15),
(147,'ATK','Earth',0.1),
(149,'HP','Earth',0.1),
(151,'DEF','Earth',0.1),
(153,'CRIT','Earth',0.1),
(155,'ATK','Earth',0.1),
(157,'HP','Earth',0.1),
(159,'DEF','Earth',0.1),
(161,'ATK','Wind',0.2),
(161,'HP','Wind',0.2),
(162,'CRIT','Wind',0.2),
(164,'ATK','Wind',0.15),
(164,'DEF','Wind',0.15),
(165,'HP','Wind',-0.1),
(167,'ATK','Wind',0.15),
(168,'HP','Wind',0.1),
(170,'HP','Wind',0.15),
(171,'ATK','Wind',0.1),
(173,'HP','Wind',0.15),
(174,'CRIT','Wind',0.1),
(176,'ATK','Wind',0.15),
(178,'HP','Wind',0.15),
(180,'ATK','Wind',0.1),
(182,'ATK','Wind',0.1),
(184,'HP','Wind',0.1),
(186,'ATK','Wind',0.1),
(188,'ATK','Wind',0.1),
(190,'HP','Wind',0.1),
(192,'ATK','Wind',0.1);

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
