-- Add push step and structured refusal breakdown
ALTER TABLE "Report" ADD COLUMN "pushCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Report" ADD COLUMN "refusalsByStage" JSONB;

COMMENT ON COLUMN "Report"."pushCount" IS 'Количество дожимов (контактов после договора)';
COMMENT ON COLUMN "Report"."refusalsByStage" IS 'Распределение отказов по этапам (JSON)';
