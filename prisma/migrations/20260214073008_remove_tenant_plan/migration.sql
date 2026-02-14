-- DropTable (Remove TenantPlan - Open Source, No Paid Tiers)
DROP TABLE IF EXISTS "tenant_plans";

-- AlterTable (Ensure Tenant.settings has proper default)
-- Settings are now JSON with structure:
-- {
--   "rateLimit": 100,
--   "maxUsers": -1,
--   "maxStorage": -1,
--   "maxWebhooks": -1,
--   "features": ["*"]
-- }

COMMENT ON COLUMN "tenants"."settings" IS 'Tenant configuration: rateLimit, maxUsers, maxStorage, maxWebhooks, features array';
