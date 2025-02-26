-- Remove the used column and add reply_count to track number of replies
ALTER TABLE email_tokens DROP COLUMN used;
ALTER TABLE email_tokens ADD COLUMN reply_count INTEGER NOT NULL DEFAULT 0;

-- Add a max_replies column with a default of 0 (unlimited)
ALTER TABLE email_tokens ADD COLUMN max_replies INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN email_tokens.reply_count IS 'Number of times this token has been used for replies';
COMMENT ON COLUMN email_tokens.max_replies IS 'Maximum number of replies allowed (0 = unlimited)'; 