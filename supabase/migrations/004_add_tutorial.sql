-- Add tutorial JSONB column to analysis_results
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS tutorial JSONB DEFAULT NULL;

COMMENT ON COLUMN analysis_results.tutorial IS
  'Structured tutorial data: abstractions, relationships, chapterOrder, chapters';
