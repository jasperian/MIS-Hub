-- Apply to existing databases before enabling email account passwords.
CREATE TABLE IF NOT EXISTS `EmailAccountPassword` (
    `recordId` VARCHAR(191) NOT NULL,
    `encryptedSecret` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`recordId`),
    CONSTRAINT `EmailAccountPassword_recordId_fkey` FOREIGN KEY (`recordId`) REFERENCES `InventoryRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
