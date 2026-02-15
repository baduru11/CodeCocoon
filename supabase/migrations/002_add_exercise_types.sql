-- ============================================
-- CODECOCOON - EXERCISE TYPE EXPANSION
-- ============================================

-- Drop existing constraint and add expanded types
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_type_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_type_check
  CHECK (type IN ('error_injection', 'code_recreation', 'code_explanation', 'mcq', 'flashcard', 'ide_debugging'));

-- Add new columns for exercise type-specific data
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS options JSONB;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS correct_option_index INTEGER;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS flashcard_front TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS flashcard_back TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS buggy_code TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS solution_code TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS test_cases JSONB;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS related_file TEXT;
