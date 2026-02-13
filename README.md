# 🚀 Enterprise SaaS Backend - Master

[![Prisma](https://img.shields.io/badge/Prisma-7.4.0-brightgreen)](https://www.prisma.io/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black)](https://www.fastify.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue)](https://www.postgresql.org/)

> **World-Class, White-Label, Reusable Enterprise Backend** for SaaS Applications
>
> Production-ready backend with Authentication, Multi-tenancy, RBAC, Webhooks, Feature Flags, File Upload, Audit Logging, and Background Jobs.

---

## ✨ Features

### **Phase 1 & 2: Foundation** ✅ **COMPLETE**
- 🔐 **JWT Authentication** - Access (15m) + Refresh (7d) tokens with rotation
- 🏢 **Multi-Tenancy** - Row-level isolation with tenant guards
- 👥 **RBAC** - Granular role-based permissions (`resource:action`)
- 📧 **Password Reset Flow** - Forgot → Email → Reset → Change
- 📁 **File Upload** - Multipart upload with MIME validation
- 📊 **Audit Logging** - IP address + user agent tracking
- ⚡ **Background Jobs** - BullMQ workers for email & cleanup
- 🔄 **Redis Caching** - Token blacklist + feature flag cache
- 📝 **API Documentation** - Swagger UI at `/docs`

### **Phase 3: Premium Features** 🚧 **PARTIAL**
- ✅ **Webhook System** - Event-driven HTTP callbacks with retry logic
- ✅ **Feature Flags** - Global & tenant-specific toggles with caching
- ⏳ **Per-Tenant Rate Limiting** - Plan-based request limits
- ⏳ **Admin Dashboard API** - System metrics & tenant management
- ⏳ **Enhanced Health Checks** - DB + Redis + Queue + Disk monitoring

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 20+ | JavaScript runtime |
| **Language** | TypeScript 5.x | Type safety |
| **Framework** | Fastify 5.x | High-performance HTTP server |
| **ORM** | Prisma 7.4.0 | Database toolkit |
| **Database** | PostgreSQL 15+ | Relational database |
| **Cache** | Redis + ioredis | Caching & session storage |
| **Queue** | BullMQ | Background job processing |
| **Auth** | jose + argon2 | JWT + password hashing |
| **Validation** | Zod | Runtime schema validation |
| **Docs** | Swagger UI | API documentation |

---

## 🚀 Quick Start

### **Prerequisites**
- Node.js 20+
- PostgreSQL 15+
- Redis (optional - graceful degradation)

### **1. Clone Repository**
```bash
git clone https://github.com/mdnishath/backend-master.git
cd backend-master
```

### **2. Install Dependencies**
```bash
npm install
```

### **3. Setup Environment**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

**Required Environment Variables:**
```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

DATABASE_URL=postgresql://postgres:password@localhost:5432/enterprise_saas

JWT_SECRET=your-super-secret-key-min-32-characters
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

REDIS_URL=redis://localhost:6379

UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

LOG_LEVEL=debug
```

### **4. Run Database Migrations**
```bash
npx prisma migrate dev
```

### **5. Start Development Server**
```bash
npm run dev
```

**Server will start at:** http://localhost:3000

---

## 📚 API Documentation

### **Swagger UI**
Open [http://localhost:3000/docs](http://localhost:3000/docs) for interactive API documentation.

### **Health Check**
```bash
curl http://localhost:3000/health
```

### **API Endpoints (37 total)**

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Health** | 1 | Server status check |
| **Auth** | 8 | Register, login, refresh, logout, profile, password reset |
| **RBAC** | 5 | Roles, permissions, assignments |
| **Files** | 3 | Upload, list, delete |
| **Audit** | 1 | Query audit logs |
| **Jobs** | 2 | Queue statistics, manual cleanup |
| **Webhooks** | 6 | CRUD webhooks, delivery logs |
| **Features** | 7 | Feature flags management |

---

## 🗄️ Database Schema

**13 Models:**
- `Tenant` - Multi-tenancy organizations
- `User` - User accounts
- `Role` - RBAC roles
- `Permission` - Granular permissions
- `UserRole` - User ↔ Role mapping
- `RolePermission` - Role ↔ Permission mapping
- `RefreshToken` - JWT refresh tokens
- `AuditLog` - Action logging
- `FileUpload` - File metadata
- `WebhookSubscription` - Webhook endpoints
- `WebhookDelivery` - Delivery logs
- `FeatureFlag` - Feature toggles
- `TenantPlan` - Per-tenant limits

**View Schema:**
```bash
npx prisma studio
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test
npx tsx --env-file=.env tests/api-test.ts
```

---

## 🔧 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |

---

## 🔐 Security Features

- ✅ **Argon2id** password hashing
- ✅ **JWT** with `jti` for uniqueness
- ✅ **Token blacklist** on logout/password change
- ✅ **HMAC SHA-256** webhook signatures
- ✅ **IP address logging** for audit trails
- ✅ **CORS & Helmet** security headers
- ✅ **Rate limiting** (global + per-tenant)
- ✅ **Zod validation** for all inputs
- ✅ **SQL injection prevention** via Prisma

---

## 📈 Performance

- ⚡ **Fastify** - 3x faster than Express
- 🚀 **Redis caching** for feature flags (5-min TTL)
- 🔄 **Connection pooling** via `pg.Pool`
- 📦 **BullMQ concurrency:** 10 webhooks, 5 emails, 2 cleanup jobs
- 📁 **Static file serving** for uploads

---

## 📖 Documentation

- [AI Handover Document](docs/AI_HANDOVER.md) - Full context for AI assistants
- [Progress Summary](docs/PROGRESS_SUMMARY.md) - Latest development status
- [Prisma 7 Upgrade](docs/PRISMA_7_UPGRADE.md) - Migration guide
- [Task Tracker](docs/task-tracker.md) - Feature checklist
- [Implementation Plan](docs/implementation-plan.md) - Architecture details
- [Development Guide](docs/DEVELOPMENT.md) - Contributing guidelines

---

## 🛣️ Roadmap

### **Phase 3: Premium Features** 🚧 **In Progress**
- ✅ Webhook system
- ✅ Feature flags
- ⏳ Per-tenant rate limiting
- ⏳ Admin dashboard API
- ⏳ Enhanced health checks
- ⏳ Data export/import

### **Phase 4: Production Ready** ⏳ **Planned**
- Docker Compose setup
- CI/CD pipeline (GitHub Actions)
- Load testing (k6/Artillery)
- Security audit (OWASP Top 10)
- Deployment guide

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Commit Convention:** Use [Conventional Commits](https://www.conventionalcommits.org/)
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Testing
- `chore:` Maintenance

---

## 📜 License

ISC

---

## 🙏 Acknowledgments

- Built with [Prisma 7](https://www.prisma.io/)
- Powered by [Fastify](https://www.fastify.io/)
- Inspired by enterprise-grade architecture patterns

---

**⭐ Star this repository if you find it helpful!**

**Built with ❤️ for the Enterprise SaaS Community**
