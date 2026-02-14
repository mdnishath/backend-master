# 🚀 Quickstart Guide

**Get your Enterprise SaaS Backend running in 5 minutes!**

This guide will get you from zero to a fully functional API as fast as possible.

---

## 🎯 Choose Your Path

### **Path 1: Docker (Easiest)** ⚡

**Time:** 5 minutes | **Difficulty:** Beginner | **Requirements:** Docker only

Perfect if you:
- Want to get started immediately
- Don't want to install PostgreSQL/Redis manually
- Want a production-like environment

[→ Jump to Docker Setup](#docker-setup)

---

### **Path 2: Interactive Wizard** 🎨

**Time:** 10 minutes | **Difficulty:** Beginner | **Requirements:** Node.js + Docker

Perfect if you:
- Want to customize database type
- Need specific deployment configurations
- Want to learn about each option

[→ Jump to Wizard Setup](#wizard-setup)

---

### **Path 3: Manual** 🛠️

**Time:** 15 minutes | **Difficulty:** Intermediate | **Requirements:** Node.js + PostgreSQL + Redis

Perfect if you:
- Want full control over everything
- Already have database infrastructure
- Prefer to understand each step

[→ Jump to Manual Setup](#manual-setup)

---

## Docker Setup

### **Step 1: Clone the Repository**

```bash
git clone https://github.com/mdnishath/backend-master.git
cd backend-master
```

### **Step 2: Run the Setup Script**

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### **Step 3: Wait for Magic to Happen** ✨

The script will automatically:

1. ✅ Generate secure credentials
2. ✅ Start PostgreSQL database
3. ✅ Start Redis cache
4. ✅ Install dependencies
5. ✅ Run database migrations
6. ✅ Seed default admin user
7. ✅ Build the application
8. ✅ Start the API server

### **Step 4: Get Your Credentials** 🔐

After setup completes, you'll see:

```
🎉 Setup Complete!

📍 Services:
   • API Server:    http://localhost:3000
   • API Docs:      http://localhost:3000/docs
   • Health Check:  http://localhost:3000/health

🔐 Credentials:
   Admin User:
     Email: admin@example.com
     Password: [auto-generated password]

⚠ Important: Your credentials are saved in .setup-credentials.txt
  Please store them securely and delete the file!
```

### **Step 5: Test Your API** 🧪

```bash
# Check health
curl http://localhost:3000/health

# View interactive docs
open http://localhost:3000/docs  # macOS
# or
start http://localhost:3000/docs  # Windows
# or
xdg-open http://localhost:3000/docs  # Linux
```

### **Step 6: Login and Start Building** 🏗️

1. Open http://localhost:3000/docs
2. Find the `POST /api/v1/auth/login` endpoint
3. Click "Try it out"
4. Enter your admin credentials
5. Get your access token
6. Use "Authorize" button to authenticate
7. Explore all 37+ API endpoints!

---

## Wizard Setup

### **Step 1: Clone and Install**

```bash
git clone https://github.com/mdnishath/backend-master.git
cd backend-master
npm install
```

### **Step 2: Run the Interactive Wizard**

```bash
npx tsx scripts/setup-wizard.ts
```

### **Step 3: Answer the Questions**

The wizard will ask you about:

#### **1. Server Configuration**
```
Server port [3000]:
Server host [0.0.0.0]:
Environment (development/production/test) [development]:
```

#### **2. Database Configuration**
```
Database type (postgresql/mysql/sqlite) [postgresql]:
PostgreSQL host [localhost]:
PostgreSQL port [5432]:
Database name [enterprise_saas]:
Database user [postgres]:
Database password (leave empty to generate):
```

#### **3. Redis Configuration**
```
Use Redis? (y/n) [y]:
Redis host [localhost]:
Redis port [6379]:
```

#### **4. JWT Configuration**
```
Access token expiry [15m]:
Refresh token expiry [7d]:
```

#### **5. File Upload**
```
Upload directory [uploads]:
Max file size in MB [10]:
```

#### **6. Logging**
```
Log level (debug/info/warn/error) [info]:
```

#### **7. Admin User**
```
Admin email [admin@example.com]:
Admin password (leave empty to generate):
```

#### **8. Deployment Type**
```
Choose your deployment method:
  1. Docker (recommended)
  2. Manual (Node.js directly)
  3. Railway (one-click deploy)
  4. Render (one-click deploy)

Select (1-4) [1]:
```

### **Step 4: Files Generated**

The wizard creates:
- `.env` - Your environment configuration
- `docker-compose.yml` - If you selected Docker deployment

### **Step 5: Start Your Backend**

If you chose **Docker**:
```bash
docker-compose up -d
npm run db:migrate
```

If you chose **Manual**:
```bash
# Make sure PostgreSQL and Redis are running
npm run db:migrate
npm run dev
```

### **Step 6: Access Your API**

Visit http://localhost:3000/docs

---

## Manual Setup

### **Prerequisites**

Before starting, make sure you have:

- ✅ **Node.js 20+** ([Download](https://nodejs.org/))
- ✅ **PostgreSQL 15+** ([Download](https://www.postgresql.org/download/))
- ✅ **Redis** (optional but recommended) ([Download](https://redis.io/download/))

### **Step 1: Clone Repository**

```bash
git clone https://github.com/mdnishath/backend-master.git
cd backend-master
```

### **Step 2: Install Dependencies**

```bash
npm install
```

### **Step 3: Setup PostgreSQL**

Create a database for the backend:

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE enterprise_saas;

# Create user (optional)
CREATE USER backend_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE enterprise_saas TO backend_user;

# Exit
\q
```

### **Step 4: Create Environment File**

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Database (update with your credentials)
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/enterprise_saas

# JWT (generate a strong secret!)
JWT_SECRET=your-super-secret-key-minimum-32-characters-long
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Redis (if you have it running)
REDIS_URL=redis://localhost:6379

# File Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

# Logging
LOG_LEVEL=debug
```

**Generate a secure JWT secret:**
```bash
openssl rand -base64 32
```

### **Step 5: Run Database Migrations**

```bash
npx prisma migrate dev
```

This creates all necessary tables in your database.

### **Step 6: Generate Prisma Client**

```bash
npx prisma generate
```

### **Step 7: Seed Default Data** (Optional)

Create a file `seed.ts` or run this manually in Prisma Studio:

```bash
npx prisma studio
```

Create:
1. A **Tenant** (organization)
2. An **Admin User**
3. An **Admin Role** with permissions
4. A **Tenant Plan**

### **Step 8: Start Development Server**

```bash
npm run dev
```

You should see:
```
Server running at http://0.0.0.0:3000
Swagger UI at http://0.0.0.0:3000/docs
```

### **Step 9: Test the API**

```bash
# Health check
curl http://localhost:3000/health

# Should return
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-02-14T...",
    "checks": { ... }
  }
}
```

---

## 🎯 Next Steps

Now that your backend is running, here's what to do next:

### **1. Explore the API** 📚

Visit http://localhost:3000/docs to see all 37+ endpoints:

- **Authentication** - Register, login, logout, password reset
- **User Management** - CRUD operations with RBAC
- **File Upload** - Multipart file uploads
- **Webhooks** - Event-driven HTTP callbacks
- **Feature Flags** - Toggle features globally or per-tenant
- **Admin Dashboard** - System metrics and tenant management

### **2. Create Your First User** 👤

Using the Swagger UI at `/docs`:

1. Go to `POST /api/v1/auth/register`
2. Click "Try it out"
3. Enter user details:
```json
{
  "email": "you@example.com",
  "password": "YourPassword123!",
  "name": "Your Name",
  "tenantSlug": "default"
}
```
4. Execute
5. Copy your access token

### **3. Authenticate** 🔐

1. Click the "Authorize" button at the top
2. Enter: `Bearer YOUR_ACCESS_TOKEN`
3. Click "Authorize"
4. Now you can call protected endpoints!

### **4. Test Protected Endpoints** 🛡️

Try these endpoints (you're now authenticated):

- `GET /api/v1/auth/me` - Get your profile
- `GET /api/v1/roles` - List roles in your tenant
- `GET /api/v1/audit-logs` - View audit trail

### **5. Upload a File** 📁

1. Go to `POST /api/v1/files`
2. Click "Try it out"
3. Upload any file (max 10MB by default)
4. Get the file URL in the response

### **6. Explore Advanced Features** 🚀

**Webhooks:**
- Create a webhook subscription
- Trigger events (user.created, user.updated, etc.)
- Check delivery logs

**Feature Flags:**
- Create a feature flag
- Toggle it on/off
- Check if enabled for your tenant

**Rate Limiting:**
- See your plan limits
- Test rate limiting by making many requests

### **7. Customize for Your Project** 🎨

Now that you understand how it works:

1. **Add Your Own Models** - Edit `prisma/schema.prisma`
2. **Create New Endpoints** - Add routes in `src/api/v1/`
3. **Add Business Logic** - Create services in `src/core/`
4. **Customize Permissions** - Modify RBAC in database

---

## 🛠️ Useful Commands

### **Development**

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test
```

### **Database**

```bash
# Create a new migration
npx prisma migrate dev --name your_migration_name

# Reset database (WARNING: deletes all data!)
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma Client
npx prisma generate
```

### **Docker**

```bash
# View all logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Restart a service
docker-compose restart backend

# Execute command in container
docker-compose exec backend npm run db:migrate
```

### **Database CLI**

```bash
# PostgreSQL shell
docker-compose exec postgres psql -U postgres -d enterprise_saas

# Redis CLI
docker-compose exec redis redis-cli
```

---

## 🐛 Troubleshooting

### **Database Connection Failed**

**Error:** `Can't reach database server`

**Solutions:**
1. Check PostgreSQL is running: `docker-compose ps`
2. Verify DATABASE_URL in `.env`
3. Check PostgreSQL logs: `docker-compose logs postgres`
4. Wait 10 seconds and try again (database may be starting)

### **Redis Connection Failed**

**Error:** `Redis connection refused`

**Solutions:**
1. Redis is optional - the system will work without it
2. Check Redis is running: `docker-compose ps`
3. Verify REDIS_URL in `.env`
4. To disable Redis: comment out REDIS_URL in `.env`

### **Port Already in Use**

**Error:** `Port 3000 is already allocated`

**Solutions:**
1. Stop the conflicting process
2. Change PORT in `.env` to something else (e.g., 3001)
3. Update docker-compose.yml ports mapping

### **Prisma Client Not Generated**

**Error:** `Cannot find module '@prisma/client'`

**Solution:**
```bash
npx prisma generate
```

### **Migration Failed**

**Error:** `Migration failed to apply`

**Solutions:**
1. Check database connection
2. Reset database: `npx prisma migrate reset`
3. Check migration files in `prisma/migrations/`

### **JWT Secret Not Set**

**Error:** `JWT_SECRET is required`

**Solution:**
Generate a secure secret:
```bash
openssl rand -base64 32
```
Add it to `.env`:
```env
JWT_SECRET=the_generated_secret_here
```

---

## 📖 Learn More

- [Architecture Documentation](./ARCHITECTURE.md) - Deep dive into the codebase
- [Customization Guide](./CUSTOMIZATION.md) - How to extend features
- [Deployment Guide](./DEPLOYMENT.md) - Deploy to production
- [API Documentation](http://localhost:3000/docs) - Interactive Swagger docs
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute

---

## 🆘 Get Help

- 🐛 **Found a bug?** [Open an issue](https://github.com/mdnishath/backend-master/issues)
- 💡 **Have a question?** [Start a discussion](https://github.com/mdnishath/backend-master/discussions)
- 🌟 **Love it?** [Star the repo](https://github.com/mdnishath/backend-master)

---

## 🎉 You're Ready!

Congratulations! You now have a production-grade Enterprise SaaS Backend running.

**What's next?**

- Build your frontend (React, Vue, Next.js, etc.)
- Customize the backend for your specific use case
- Deploy to production (Railway, Render, AWS, etc.)
- Scale to millions of users!

**Happy coding! 🚀**

---

*Built with ❤️ for the Enterprise SaaS Community*
