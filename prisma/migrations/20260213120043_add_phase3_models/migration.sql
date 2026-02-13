-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "maxStorage" BIGINT NOT NULL DEFAULT 1073741824,
    "maxWebhooks" INTEGER NOT NULL DEFAULT 5,
    "featuresEnabled" TEXT[],
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_subscriptions_tenantId_idx" ON "webhook_subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_isActive_idx" ON "webhook_subscriptions"("isActive");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhookId_idx" ON "webhook_deliveries"("webhookId");

-- CreateIndex
CREATE INDEX "webhook_deliveries_event_idx" ON "webhook_deliveries"("event");

-- CreateIndex
CREATE INDEX "webhook_deliveries_createdAt_idx" ON "webhook_deliveries"("createdAt");

-- CreateIndex
CREATE INDEX "feature_flags_tenantId_idx" ON "feature_flags"("tenantId");

-- CreateIndex
CREATE INDEX "feature_flags_isEnabled_idx" ON "feature_flags"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_tenantId_key" ON "feature_flags"("key", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_plans_tenantId_key" ON "tenant_plans"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_plans_planType_idx" ON "tenant_plans"("planType");

-- CreateIndex
CREATE INDEX "tenant_plans_isActive_idx" ON "tenant_plans"("isActive");
