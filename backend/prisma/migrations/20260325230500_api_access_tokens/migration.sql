CREATE TABLE "api_access_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "last_used_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "api_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_access_tokens_token_hash_key" ON "api_access_tokens"("token_hash");
CREATE INDEX "api_access_tokens_user_id_created_at_idx" ON "api_access_tokens"("user_id", "created_at");
CREATE INDEX "api_access_tokens_user_id_revoked_at_idx" ON "api_access_tokens"("user_id", "revoked_at");

ALTER TABLE "api_access_tokens"
  ADD CONSTRAINT "api_access_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
