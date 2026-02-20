/*
  Warnings:

  - Added the required column `monitorTime` to the `crypto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `signal` to the `crypto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `signalTime` to the `crypto` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "gemsTypeEnum" AS ENUM ('GOLD_DOG', 'SILVER_DOG', 'BRONZE_DOG');

-- CreateEnum
CREATE TYPE "signalTypeEnum" AS ENUM ('BUY', 'SELL', 'NONE');

-- AlterTable
ALTER TABLE "crypto" ADD COLUMN     "monitorTime" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "signal" "signalTypeEnum" NOT NULL,
ADD COLUMN     "signalTime" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "goldDogData" (
    "id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentMcap" DOUBLE PRECISION NOT NULL,
    "firstSignalMcap" DOUBLE PRECISION NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenContractAddress" TEXT NOT NULL,
    "gemsType" "gemsTypeEnum" NOT NULL,
    "firstSignalTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goldDogData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "goldDogData_tokenSymbol_key" ON "goldDogData"("tokenSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "goldDogData_tokenContractAddress_key" ON "goldDogData"("tokenContractAddress");
