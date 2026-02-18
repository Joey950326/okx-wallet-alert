-- CreateEnum
CREATE TYPE "MonitorTimeLevelEnum" AS ENUM ('FIVE_MINUTES', 'FIFTEEN_MINUTES', 'ONE_HOUR', 'FOUR_HOURS', 'ONE_DAY', 'ONE_WEEK');

-- CreateTable
CREATE TABLE "adminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crypto" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "marketCap" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "monitorTimeLevel" "MonitorTimeLevelEnum" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crypto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homeData" (
    "id" TEXT NOT NULL,
    "useGold" BOOLEAN NOT NULL,
    "useSilver" BOOLEAN NOT NULL,
    "useBronze" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homeData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adminUser_username_key" ON "adminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "crypto_symbol_key" ON "crypto"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "crypto_token_key" ON "crypto"("token");
