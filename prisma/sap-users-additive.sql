-- Additive schema update for existing MIS Hub databases.
CREATE TABLE IF NOT EXISTS `SapUser` (
    `id` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `sapId` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `dealershipId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NULL,
    `validFrom` DATE NULL,
    `validTo` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `SapUser_sapId_key`(`sapId`),
    UNIQUE INDEX `SapUser_memberId_key`(`memberId`),
    INDEX `SapUser_dealershipId_idx`(`dealershipId`),
    INDEX `SapUser_lastName_firstName_idx`(`lastName`, `firstName`),
    PRIMARY KEY (`id`),
    CONSTRAINT `SapUser_dealershipId_fkey` FOREIGN KEY (`dealershipId`) REFERENCES `Dealership`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `SapUser_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `InventoryRecord`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
