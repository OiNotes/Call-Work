-- AlterTable: Rename fields in Report model to new format
-- This migration preserves all existing data by using RENAME COLUMN

-- Rename pzmScheduled -> zoomAppointments
ALTER TABLE "Report" RENAME COLUMN "pzmScheduled" TO "zoomAppointments";

-- Rename rejections -> refusalsCount
ALTER TABLE "Report" RENAME COLUMN "rejections" TO "refusalsCount";

-- Rename rejectionReason -> refusalsReasons
ALTER TABLE "Report" RENAME COLUMN "rejectionReason" TO "refusalsReasons";

-- Rename warmUp -> warmingUpCount
ALTER TABLE "Report" RENAME COLUMN "warmUp" TO "warmingUpCount";

-- Rename contractReview -> contractReviewCount
ALTER TABLE "Report" RENAME COLUMN "contractReview" TO "contractReviewCount";

-- Rename dealsClosed -> successfulDeals
ALTER TABLE "Report" RENAME COLUMN "dealsClosed" TO "successfulDeals";

-- Rename salesAmount -> monthlySalesAmount
ALTER TABLE "Report" RENAME COLUMN "salesAmount" TO "monthlySalesAmount";

-- Add new column: comment
ALTER TABLE "Report" ADD COLUMN "comment" TEXT;

-- Add comments to columns for documentation
COMMENT ON COLUMN "Report"."zoomAppointments" IS 'Запланированные Zoom встречи (бывш. pzmScheduled)';
COMMENT ON COLUMN "Report"."pzmConducted" IS 'Проведённые первичные встречи';
COMMENT ON COLUMN "Report"."refusalsCount" IS 'Количество отказов (бывш. rejections)';
COMMENT ON COLUMN "Report"."refusalsReasons" IS 'Причины отказов (бывш. rejectionReason)';
COMMENT ON COLUMN "Report"."warmingUpCount" IS 'Прогрев клиентов (бывш. warmUp)';
COMMENT ON COLUMN "Report"."vzmConducted" IS 'Проведённые вторичные встречи';
COMMENT ON COLUMN "Report"."contractReviewCount" IS 'Ознакомление с договором (бывш. contractReview)';
COMMENT ON COLUMN "Report"."successfulDeals" IS 'Успешные сделки (бывш. dealsClosed)';
COMMENT ON COLUMN "Report"."monthlySalesAmount" IS 'Сумма продаж за месяц (бывш. salesAmount)';
COMMENT ON COLUMN "Report"."comment" IS 'Дополнительный комментарий сотрудника';
