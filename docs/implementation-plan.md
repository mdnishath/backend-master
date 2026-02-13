# Implementation Plan — Enterprise SaaS Backend

## Goal

Build a **Premium, White-Label, Reusable Enterprise Backend** that can be sold as a product and connected to any web application.

---

## Current Architecture

```
e:\backend\
├── prisma/
│   └── schema.prisma           ← 9 models (User, Tenant, Role, Permission, etc.)
├── src/
│   ├── api/
│   │   ├── middleware/          ← auth.guard, rbac.guard, tenant.guard
│   │   ├── plugins/            ← error-handler
│   │   └── v1/                 ← auth, rbac, password-reset, file, audit, job routes
│   ├── config/env.ts           ← Zod-validated environment config
│   ├── core/
│   │   ├── auth/               ← auth.service, password-reset.service
│   │   ├── audit/              ← audit.service
│   │   └── rbac/               ← rbac.service
│   ├── infra/
│   │   ├── cache/redis.ts      ← Redis client + cache helpers + token blacklist
│   │   ├── database/prisma.ts  ← Prisma client singleton
│   │   ├── queue/              ← BullMQ queues + workers
│   │   ├── storage/            ← File storage service (local, S3-swappable)
│   │   └── jwt/                ← JWT creation + verification (jose)
│   ├── shared/                 ← errors.ts, response.ts, types.ts
│   ├── utils/hash.ts           ← Argon2id hashing
│   ├── app.ts                  ← Fastify app factory
│   └── server.ts               ← Entry point
├── tests/                      ← api-test, password-reset-test, phase2-test
├── docs/                       ← This folder
└── uploads/                    ← File upload directory
```

---

## Database Models (9 total)

| Model | Purpose |
|-------|---------|
| `User` | Accounts with email, password, tenant link, resetToken |
| `Tenant` | Business/organization (multi-tenancy) |
| `Role` | Named roles per tenant (Admin, Manager, User) |
| `Permission` | Granular permissions (resource:action) |
| `UserRole` | Many-to-many user ↔ role |
| `RolePermission` | Many-to-many role ↔ permission |
| `RefreshToken` | JWT refresh token storage with expiry |
| `AuditLog` | Action logging with IP, user agent, metadata |
| `FileUpload` | File metadata with tenant scoping |

---

## API Endpoints (23 total)

### Health
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Server + DB status |

### Auth (8 endpoints)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | No | Register + auto-create tenant |
| POST | `/api/v1/auth/login` | No | Login → JWT tokens |
| POST | `/api/v1/auth/refresh` | No | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Yes | Invalidate refresh token |
| GET | `/api/v1/auth/me` | Yes | Get current user profile |
| POST | `/api/v1/auth/forgot-password` | No | Request password reset |
| POST | `/api/v1/auth/reset-password` | No | Reset with token |
| POST | `/api/v1/auth/change-password` | Yes | Change password (authenticated) |

### RBAC (5 endpoints)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/permissions` | Yes | List all permissions |
| GET | `/api/v1/roles` | Yes | List tenant roles |
| POST | `/api/v1/roles` | Yes | Create role |
| POST | `/api/v1/roles/:id/permissions` | Yes | Assign permissions to role |
| POST | `/api/v1/users/:id/roles` | Yes | Assign role to user |

### Files (3 endpoints)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/files/upload` | Yes | Upload file (multipart) |
| GET | `/api/v1/files` | Yes | List files (paginated) |
| DELETE | `/api/v1/files/:id` | Yes | Delete file |

### Audit (1 endpoint)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/audit-logs` | Yes | Query audit logs (filtered) |

### Jobs (2 endpoints)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/jobs/stats` | Yes | Queue statistics |
| POST | `/api/v1/jobs/cleanup` | Yes | Trigger cleanup job |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | v20+ |
| Language | TypeScript | 5.x |
| Framework | Fastify | 5.x |
| ORM | Prisma | 6.19.2 |
| Database | PostgreSQL | 15+ |
| Cache | Redis / ioredis | Latest |
| Queue | BullMQ | Latest |
| Auth | jose (JWT) + argon2 | Latest |
| Validation | Zod | Latest |
| Docs | @fastify/swagger + swagger-ui | Latest |

---

## Verification

```bash
# Start dev server
npm run dev

# Run migration
npx prisma migrate dev

# Run tests
npx tsx --env-file=.env tests/api-test.ts
npx tsx --env-file=.env tests/password-reset-test.ts
npx tsx --env-file=.env tests/phase2-test.ts

# View Swagger
open http://localhost:3000/docs

# Health check
curl http://localhost:3000/health
```

---

## Environment Variables

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/enterprise_saas?schema=public
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
LOG_LEVEL=debug
REDIS_URL=redis://localhost:6379
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
```
