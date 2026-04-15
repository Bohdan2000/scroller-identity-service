# Identity Service

Handles authentication, session management, OAuth, and device tracking for the Scroller platform.

## Responsibilities

- Email/password sign-up and sign-in
- Google and Apple OAuth
- JWT access + refresh token issuance and rotation
- Session lifecycle and revocation
- Device tracking
- Account status enforcement

This service **does not** store profile data, manage social relationships, or handle content.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, NestJS 10 |
| Language | TypeScript |
| HTTP | Fastify |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Auth | JWT (passport-jwt), bcryptjs |
| OAuth | google-auth-library, apple-signin-auth |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### Local development

```bash
# 1. Install dependencies (also runs prisma generate via postinstall)
npm install

# 2. Copy and fill in environment variables
cp .env.example .env

# 3. Start the database
docker compose up postgres -d

# 4. Run migrations
npm run prisma:migrate:dev

# 5. Start in watch mode
npm run start:dev
```

Service is available at `http://localhost:3001`.  
Swagger UI at `http://localhost:3001/api/v1/docs`.

### Run with Docker

```bash
cp .env.example .env   # fill in JWT secrets at minimum

docker compose up --build -d

docker compose logs -f identity
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3001` | HTTP port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | — | Secret for signing access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | — | Secret for signing refresh tokens (min 32 chars) |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN_MS` | No | `604800000` | Refresh token lifetime in ms (default 7 days) |
| `GOOGLE_CLIENT_ID` | OAuth only | — | Google OAuth client ID |
| `APPLE_CLIENT_ID` | OAuth only | — | Apple OAuth client/service ID |
| `APPLE_TEAM_ID` | OAuth only | — | Apple developer team ID |
| `APPLE_KEY_ID` | OAuth only | — | Apple private key ID |
| `APPLE_PRIVATE_KEY` | OAuth only | — | Apple private key (PEM) |
| `BCRYPT_ROUNDS` | No | `12` | bcrypt hashing rounds |

---

## API

Full interactive documentation: `GET /api/v1/docs`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/sign-up` | — | Register with email + password |
| `POST` | `/api/v1/auth/sign-in` | — | Sign in with email + password |
| `POST` | `/api/v1/auth/oauth/google` | — | Sign in / register via Google |
| `POST` | `/api/v1/auth/oauth/apple` | — | Sign in / register via Apple |
| `POST` | `/api/v1/auth/refresh` | — | Rotate access + refresh tokens |
| `POST` | `/api/v1/auth/logout` | Bearer | Revoke the current session |
| `GET` | `/api/v1/auth/me` | Bearer | Get current user |
| `GET` | `/api/v1/health` | — | Health check |

### Token flow

```
sign-up / sign-in / oauth
         │
         ▼
  { accessToken, refreshToken }
         │
         ├─ accessToken  → Authorization: Bearer <token>  (15 min)
         │
         └─ refreshToken → POST /auth/refresh             (7 days, rotated on every use)
```

**Refresh token rotation** — each use of a refresh token issues a new pair and immediately revokes the old one. Reuse of an already-rotated token is treated as a replay attack and revokes the entire session.

---

## Project Structure

```
src/
├── auth/                   # Controller, service, strategies, guards, DTOs
│   ├── decorators/         # @CurrentUser()
│   ├── dto/                # Request / response shapes
│   ├── guards/             # JwtAccessGuard, JwtRefreshGuard
│   ├── interfaces/         # JwtAccessPayload, JwtRefreshPayload
│   └── strategies/         # passport-jwt strategies
├── tokens/                 # JWT issuance, verification, hashing, rotation
├── sessions/               # Session CRUD and revocation
├── devices/                # Device upsert and tracking
├── oauth/                  # Google + Apple token verification
├── health/                 # GET /health
├── prisma/                 # PrismaService (global)
├── common/
│   ├── dto/                # ErrorResponseDto
│   ├── exceptions/         # Typed domain exceptions (AUTH_001–AUTH_008)
│   ├── filters/            # Global HTTP exception filter
│   └── interceptors/       # Request logging
└── config/
    └── configuration.ts    # Typed config factory
```

---

## Database

Schema is defined in `prisma/schema.prisma`. Migrations live in `prisma/migrations/`.

```bash
# Create a new migration during development
npm run prisma:migrate:dev -- --name <migration_name>

# Apply migrations in production (also runs automatically on container start)
npm run prisma:migrate:deploy

# Open Prisma Studio
npm run prisma:studio
```

---

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

Tests use Jest with mocked dependencies — no database required.

---

## Error Codes

All errors follow the shape:

```json
{
  "statusCode": 401,
  "code": "AUTH_001",
  "message": "Invalid email or password",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/api/v1/auth/sign-in"
}
```

| Code | Status | Meaning |
|---|---|---|
| `AUTH_001` | 401 | Invalid credentials |
| `AUTH_002` | 409 | Email already registered |
| `AUTH_003` | 403 | Account blocked |
| `AUTH_004` | 401 | Token expired |
| `AUTH_005` | 401 | Token invalid or revoked |
| `AUTH_006` | 401 | Session not found or revoked |
| `AUTH_007` | 502 | OAuth provider error |
| `AUTH_008` | 400 | Password reset token invalid |
