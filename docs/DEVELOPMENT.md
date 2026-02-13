# 👨‍💻 Development Guide

## 🔧 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot-reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to JavaScript (`dist/`) |
| `npm start` | Run the compiled production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |

## 🗄️ Database (Prisma)

We use Prisma ORM. Common commands:

- **Migration**: `npx prisma migrate dev` (Creates new migration from schema changes)
- **Studio**: `npx prisma studio` (Opens database GUI)
- **Generate**: `npx prisma generate` (Regenerates TypeScript client)
- **Seed**: `npx tsx prisma/seed.ts` (Runs seed script)

## 🧪 Testing

We use native `node:test` runner or simple `tsx` scripts for integration testing.

```bash
# Run all tests
npm test

# Run specific integration test
npx tsx --env-file=.env tests/api-test.ts
```

## 🏗️ Project Structure

The project follows **Clean Architecture** principles:

- **`src/core`**: Business logic, services, domain implementation. Independent of frameworks.
- **`src/infra`**: External interfaces (Database, Redis, Email, Storage).
- **`src/api`**: HTTP layer (Fastify controllers, routes, middleware).
- **`src/config`**: Environment configuration.

## 🔒 Security Best Practices

- **Secrets**: Never commit `.env`.
- **Validation**: All inputs must be validated with Zod schemas.
- **Auth**: Always use `authGuard` for protected routes.
- **RBAC**: Use `rbacGuard` for permission-sensitive routes.

## 📦 Contribution Workflow

1. Create a `feature/` branch.
2. Implement your changes.
3. Add/Update tests.
4. Ensure `npm run lint` passes.
5. Create a Pull Request.
