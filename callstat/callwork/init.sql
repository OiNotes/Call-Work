-- Callwork PostgreSQL Initialization Script
-- Автоматически выполняется при первом запуске контейнера

-- Включаем расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Дополнительные индексы будут созданы Prisma автоматически
-- после выполнения prisma db push

-- Создаем роль для приложения (если нужно)
-- CREATE ROLE callwork_app WITH LOGIN PASSWORD 'app_password';

-- Устанавливаем timezone
SET timezone = 'UTC';

-- Комментарий о структуре БД
COMMENT ON DATABASE callwork IS 'Callwork - система учёта статистики call-центра';
