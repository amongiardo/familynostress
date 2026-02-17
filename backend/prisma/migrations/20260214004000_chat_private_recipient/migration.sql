ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "recipient_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "chat_messages_recipient_user_id_idx"
  ON "chat_messages"("recipient_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_recipient_user_id_fkey'
  ) THEN
    ALTER TABLE "chat_messages"
      ADD CONSTRAINT "chat_messages_recipient_user_id_fkey"
      FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
