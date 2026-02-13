# 🤖 AI Assistant Handover: Enterprise SaaS Backend

**Start Here.** This document contains the full context needed for an AI to seamlessly continue development on this project.

---

## 🚀 Project Overview

**Goal:** Build a **World-Class, White-Label, Reusable Enterprise Backend** for SaaS applications.
**Tech Stack:** Node.js (v20+), Fastify (v5), TypeScript (v5), Prisma (v6.19.2), PostgreSQL, Redis, BullMQ.
**Architecture:** **Clean Architecture** (Core -> Infra -> API). No framework coupling in Core.
**Status:** **Phase 1 & 2 Complete.** Ready for Phase 3 (Webhooks & Premium Features).

---

## 📍 Current State (Phase 1 & 2 DONE)

### ✅ Completed Features
1.  **Authentication**:
    *   JWT (Access 15m, Refresh 7d) with `jose`. `jti` for uniqueness.
    *   Argon2id hashing in `utils/hash.ts`.
    *   Secure HTTP-only cookies.
    *   Password Reset Flow (Forgot -> Email Mock -> Reset -> Change).
2.  **Multi-Tenancy**:
    *   Row-level isolation via `tenantId` on all major tables.
    *   `tenant.guard.ts` middleware enforces isolation.
3.  **RBAC (Role-Based Access Control)**:
    *   Granular operational permissions (`resource:action`).
    *   Dynamic Role CRUD.
    *   `rbac.guard.ts` middlewarecheck.
4.  **Infrastructure**:
    *   **Redis**: `src/infra/cache/redis.ts` (Lazy connect, handles downtime gracefully).
    *   **Queues**: BullMQ for Email & Cleanup jobs (`src/infra/queue/`).
    *   **File Storage**: Local filesystem (mocking S3) via `@fastify/multipart`.
    *   **Audit Logging**: `AuditLog` table tracks all critical actions + IP/UserAgent.
5.  **DX**:
    *   Swagger UI at `/docs`.
    *   Zod validation for Env & Requests.

### ⚠️ Important Context & Caveats
*   **Redis**: Currently **not installed** in the local dev environment. The app is built to degrade gracefully (logs "Redis unavailable"). The next AI should know: *Queue features will fail gracefully if Redis is missing.*
*   **Email**: The worker (`src/infra/queue/workers.ts`) currently **logs to console**. Needs integration with SendGrid/SES/Resend in Phase 4.
*   **File Upload**: Stores files locally in `uploads/`. Needs S3/MinIO implementation in `src/infra/storage/storage.service.ts` for production.

---

## 🗺️ Codebase Map

*   **`src/core/`**: *Pure Business Logic*.
    *   `auth/`: AuthService, PasswordResetService.
    *   `audit/`: AuditService.
    *   `rbac/`: RbacService.
*   **`src/infra/`**: *External World*.
    *   `database/`: Prisma client.
    *   `cache/`: Redis client.
    *   `queue/`: BullMQ queues & workers.
    *   `storage/`: File upload logic.
*   **`src/api/`**: *HTTP Layer*.
    *   `v1/`: Route definitions (Controllers).
    *   `middleware/`: AuthGuard, TenantGuard, RbacGuard.
*   **`tests/`**: *Integration Tests*.
    *   `api-test.ts`: General API flow.
    *   `password-reset-test.ts`: Auth flows.
    *   `phase2-test.ts`: Files, Audit, Jobs.

---

## ⏩ Your Mission: Phase 3 (Premium Features)

The immediate next task is **implementing Phase 3**.

### 1. Webhooks System (Priority: High)
**Goal:** Allow tenants to register URLs to receive event notifications (e.g., `user.created`, `file.uploaded`).
*   **Schema**: Create `WebhookSubscription` model (tenantId, url, events[], secret).
*   **Service**: Logic to trigger webhooks on events.
*   **Queue**: Use a separate BullMQ queue (`webhooks`) to retry failed deliveries with exponential backoff.

### 2. Per-Tenant Rate Limiting
**Goal:** Different limits for Starter vs Enterprise plans.
*   **Current:** Global 100 req/min via `@fastify/rate-limit`.
*   **Next:** Dynamic limits based on Tenant Plan (needs `Plan` model or mapping).

### 3. Feature Flags
**Goal:** Toggle features per tenant.
*   **Schema**: `FeatureFlag` (key, enabled, tenantId).
*   **Service**: Check `await featureService.isEnabled('beta-feature', tenantId)`.

---

## 📝 Commands for the Next AI

*   **Start Server**: `npm run dev` (Port 3000)
*   **Run Tests**: `npx tsx --env-file=.env tests/api-test.ts`
*   **DB Migration**: `npx prisma migrate dev`
*   **DB Studio**: `npx prisma studio`

---
**This file is your source of truth.** If you are an AI reading this, verify the `docs/task-tracker.md` for the granular checklist status.
