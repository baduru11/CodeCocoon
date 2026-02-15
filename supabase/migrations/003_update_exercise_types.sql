-- ============================================
-- CODECOCOON - UPDATE EXERCISE TYPE CONSTRAINT
-- ============================================
-- Add new exercise types: output_prediction, parsons, error_message

ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_type_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_type_check
  CHECK (type IN (
    'error_injection', 'code_recreation', 'code_explanation', 'mcq',
    'output_prediction', 'parsons', 'error_message'
  ));
