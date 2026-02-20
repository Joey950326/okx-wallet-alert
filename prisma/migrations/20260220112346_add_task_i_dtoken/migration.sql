/*
  Warnings:

  - A unique constraint covering the columns `[taskId]` on the table `crypto` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `taskId` to the `crypto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "crypto" ADD COLUMN     "taskId" TEXT NOT NULL,
ALTER COLUMN "signalTime" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "crypto_taskId_key" ON "crypto"("taskId");
