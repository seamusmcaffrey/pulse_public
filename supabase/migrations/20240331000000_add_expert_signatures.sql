-- Add signature field to experts table
ALTER TABLE experts ADD COLUMN signature TEXT;

-- Add comment to explain the field's purpose
COMMENT ON COLUMN experts.signature IS 'The expert''s email signature to be removed from their comments'; 