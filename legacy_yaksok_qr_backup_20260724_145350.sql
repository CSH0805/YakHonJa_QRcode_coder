mysqldump: [Warning] Using a password on the command line interface can be insecure.
-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: yaksok_qr
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `medicine_qr_codes`
--

DROP TABLE IF EXISTS `medicine_qr_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicine_qr_codes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `medicine_id` bigint unsigned NOT NULL,
  `qr_id` varchar(24) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `status` enum('active','superseded','revoked') NOT NULL DEFAULT 'active',
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `qr_id` (`qr_id`),
  KEY `idx_qr_medicine_status` (`medicine_id`,`status`),
  CONSTRAINT `fk_qr_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicine_qr_codes`
--

LOCK TABLES `medicine_qr_codes` WRITE;
/*!40000 ALTER TABLE `medicine_qr_codes` DISABLE KEYS */;
INSERT INTO `medicine_qr_codes` VALUES (2,2,'ShpHUSZj8E08k1ap','7a5599a3bd5f5d3149a768d992a108a49e2ca472f717525c1ee60911b5b3c4a1','active','2026-07-24 16:43:34','2026-07-24 13:43:33'),(3,3,'DCdFsCGGn05i4yZS','18bfa971d8d8e5aacce50965a3332e3736030d9596ab44da6f802e4f3b45df06','superseded','2026-07-24 16:44:46','2026-07-24 13:44:46'),(4,3,'jJnDG4fD9EjOAJHR','23d262b2bc1ce76637ac7e64a60823cac845fa0da781492c9d3141189bf9cdd9','revoked','2026-07-24 16:45:41','2026-07-24 13:45:40'),(5,4,'FVzoUvs8Iqz610PM','eb6098f6027a3ef9300be365e982f0d07d6a70d74d3397ef7483b978c26d593c','active','2026-07-24 16:46:26','2026-07-24 13:46:26');
/*!40000 ALTER TABLE `medicine_qr_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicines`
--

DROP TABLE IF EXISTS `medicines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicines` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `medicine_name` varchar(255) NOT NULL,
  `dose_amount` varchar(100) NOT NULL,
  `times` json NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `caution` text,
  `manage_key_hash` char(64) NOT NULL,
  `status` enum('active','deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicines`
--

LOCK TABLES `medicines` WRITE;
/*!40000 ALTER TABLE `medicines` DISABLE KEYS */;
INSERT INTO `medicines` VALUES (2,'Ÿ�̷��� 500mg','1��','[\"morning\", \"afternoon\", \"evening\"]','2026-07-24','2026-07-30','���ָ� ���ϼ���','3979d410cfbf93e56d75b762380dba3877cd130d576db3e4eaf922271ffe535d','active','2026-07-24 13:43:33','2026-07-24 13:43:33'),(3,'타이레놀 500mg','1정','[\"morning\", \"afternoon\", \"evening\"]','2026-07-24','2026-07-30','음주를 피하세요','e6065388b980ac2ed5121d21201c43ab1af78a33cc618a4d2c493818623897b2','deleted','2026-07-24 13:44:46','2026-07-24 13:45:50'),(4,'타이레놀 500mg','1정','[\"morning\", \"afternoon\", \"evening\"]','2026-07-24','2026-07-30','음주를 피하세요','c280b0a66d3a0194b0f01caba13ce9d230ad32130a4da078955acb7bf03a4e75','active','2026-07-24 13:46:26','2026-07-24 13:46:26');
/*!40000 ALTER TABLE `medicines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'yaksok_qr'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-24 14:53:51
