-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'blocked');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'apple');

-- CreateTable
CREATE TABLE "users" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "email"          TEXT         NOT NULL,
    "password_hash"  TEXT,
    "email_verified" BOOLEAN      NOT NULL DEFAULT false,
    "status"         "UserStatus" NOT NULL DEFAULT 'active',
    "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id"               UUID            NOT NULL DEFAULT gen_random_uuid(),
    "user_id"          UUID            NOT NULL,
    "provider"         "OAuthProvider" NOT NULL,
    "provider_user_id" TEXT            NOT NULL,
    "provider_email"   TEXT,
    "meta"             JSONB,
    "created_at"       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updated_at"       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"     UUID        NOT NULL,
    "device_id"   TEXT        NOT NULL,
    "access_jti"  TEXT        NOT NULL,
    "ip"          TEXT,
    "user_agent"  TEXT,
    "expires_at"  TIMESTAMPTZ NOT NULL,
    "revoked_at"  TIMESTAMPTZ,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "session_id"  UUID        NOT NULL,
    "token_hash"  TEXT        NOT NULL,
    "expires_at"  TIMESTAMPTZ NOT NULL,
    "revoked_at"  TIMESTAMPTZ,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"     UUID        NOT NULL,
    "device_id"   TEXT        NOT NULL,
    "platform"    TEXT,
    "app_version" TEXT,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    UUID        NOT NULL,
    "token_hash" TEXT        NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at"    TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "users"           ADD CONSTRAINT "users_email_key"                          UNIQUE ("email");
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_provider_provider_user_id_key" UNIQUE ("provider", "provider_user_id");
ALTER TABLE "sessions"        ADD CONSTRAINT "sessions_access_jti_key"                  UNIQUE ("access_jti");
ALTER TABLE "refresh_tokens"  ADD CONSTRAINT "refresh_tokens_token_hash_key"            UNIQUE ("token_hash");
ALTER TABLE "devices"         ADD CONSTRAINT "devices_user_id_device_id_key"            UNIQUE ("user_id", "device_id");
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_token_hash_key" UNIQUE ("token_hash");

-- Indexes
CREATE INDEX "auth_identities_user_id_idx"       ON "auth_identities"("user_id");
CREATE INDEX "sessions_user_id_idx"              ON "sessions"("user_id");
CREATE INDEX "sessions_access_jti_idx"           ON "sessions"("access_jti");
CREATE INDEX "refresh_tokens_session_id_idx"     ON "refresh_tokens"("session_id");
CREATE INDEX "devices_user_id_idx"               ON "devices"("user_id");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- Foreign keys
ALTER TABLE "auth_identities"
    ADD CONSTRAINT "auth_identities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devices"
    ADD CONSTRAINT "devices_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "users_updated_at"
    BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER "auth_identities_updated_at"
    BEFORE UPDATE ON "auth_identities"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
