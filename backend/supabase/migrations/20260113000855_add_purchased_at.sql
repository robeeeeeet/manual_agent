-- Migration: Add purchased_at column to user_appliances
-- Description: Track appliance purchase date for accurate maintenance scheduling

-- Add purchased_at column to user_appliances table
ALTER TABLE user_appliances
ADD COLUMN purchased_at DATE;

-- Add comment for documentation
COMMENT ON COLUMN user_appliances.purchased_at IS 'Purchase date of the appliance (optional, used for maintenance scheduling from purchase date instead of registration date)';
