# 📊 Callwork - Call Center Analytics System

Система учёта статистики call-центра с веб-дашбордом и Telegram ботом для сбора отчётов.

## 🚀 Быстрый старт (локально)

### 1️⃣ Установка зависимостей

```bash
cd "/Users/sile/Documents/Status Stock 4.0/Call stat/callwork"
npm install
```

### 2️⃣ Настройка переменных окружения

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

**Обязательные переменные:**

```env
# PostgreSQL база данных (можно использовать локальную или Neon.tech)
DATABASE_URL="postgresql://user:password@localhost:5432/callwork"

# NextAuth секрет (сгенерируйте через: openssl rand -base64 32)
NEXTAUTH_SECRET="ваш-секретный-ключ"
NEXTAUTH_URL="http://localhost:3000"

# Telegram Bot токен (получите у @BotFather)
TELEGRAM_BOT_TOKEN="123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
```

### 3️⃣ Настройка базы данных

**Вариант А: Локальный PostgreSQL**

```bash
# Убедитесь что PostgreSQL запущен
# Создайте базу данных
psql -U postgres -c "CREATE DATABASE callwork;"

# Примените миграции
npx prisma generate
npx prisma db push
```

**Вариант Б: Neon.tech (облачная БД)**

1. Зарегистрируйтесь на https://neon.tech
2. Создайте новый проект
3. Скопируйте Connection String в `DATABASE_URL`
4. Выполните миграции:

```bash
npx prisma generate
npx prisma db push
```

### 4️⃣ Создание Telegram бота

1. Откройте Telegram и найдите @BotFather
2. Отправьте `/newbot`
3. Следуйте инструкциям (название и username бота)
4. Скопируйте токен и добавьте в `.env` как `TELEGRAM_BOT_TOKEN`

### 5️⃣ Запуск приложения

**Автоматический запуск (рекомендуется):**

```bash
chmod +x start-local.sh
./start-local.sh
```

**Ручной запуск:**

```bash
# Терминал 1: Next.js приложение
npm run dev

# Терминал 2: Telegram бот
npm run bot:dev
```

### 6️⃣ Открыть приложение

- 🌐 **Веб-дашборд**: http://localhost:3000
- 🤖 **Telegram бот**: Найдите вашего бота в Telegram и отправьте `/start`

---

## 📖 Использование

### Регистрация пользователя

1. Откройте http://localhost:3000
2. Перейдите на вкладку "Register"
3. Заполните форму (имя, email, пароль)
4. Войдите в систему

### Привязка Telegram бота

1. Войдите в веб-приложение
2. Перейдите в Profile
3. Нажмите "Generate Code" - получите 6-значный код
4. Откройте бота в Telegram и отправьте `/register`
5. Введите код из веб-приложения
6. ✅ Готово! Теперь можете отправлять отчёты через бота

### Отправка отчёта через бота

1. Откройте бота в Telegram
2. Отправьте `/report`
3. Выберите дату (Сегодня/Вчера/Позавчера)
4. Последовательно введите данные:
   - Назначенные ПЗМ (первичные звонки-менеджеру)
   - Проведённые ПЗМ
   - Количество отказов
   - Причина отказов (если есть)
   - Количество прогревов
   - Проведённые ВЗМ (вторичные звонки-менеджеру)
   - Договоров на проверке
   - Заключённые сделки
   - Сумма продаж (₽)
5. Проверьте preview и подтвердите
6. ✅ Отчёт сохранён!

### Просмотр статистики (Dashboard)

**Для сотрудников (EMPLOYEE):**
- Видят только свои отчёты
- 4 KPI карточки:
  - Конверсия ПЗМ → Сделки
  - Средний чек
  - Общие продажи
  - Активные сделки
- Графики и статистика

**Для менеджеров (MANAGER):**
- Видят отчёты всех сотрудников
- Могут фильтровать по сотрудникам
- Сводная статистика по команде

---

## 🛠 Технологии

### Frontend
- **Next.js 14** (App Router)
- **React 19** + TypeScript
- **Tailwind CSS v4** (Apple-style дизайн)
- **Framer Motion** (анимации)
- **shadcn/ui** + Radix UI (компоненты)
- **Recharts** (графики)

### Backend
- **Next.js API Routes**
- **NextAuth.js** (JWT аутентификация)
- **Prisma ORM** (типобезопасный ORM)
- **PostgreSQL** (база данных)
- **Zod** (валидация)

### Telegram Bot
- **node-telegram-bot-api**
- **Polling mode** (без вебхуков)
- **State management** (Map-based sessions)

---

## 📁 Структура проекта

```
callwork/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   ├── auth/          # NextAuth + регистрация
│   │   ├── reports/       # CRUD отчётов
│   │   ├── statistics/    # Агрегация данных
│   │   ├── users/         # Список сотрудников
│   │   └── telegram/      # Генерация кодов
│   ├── login/             # Страница входа
│   ├── dashboard/         # Главная страница (KPI + графики)
│   ├── profile/           # Привязка Telegram
│   └── layout.tsx         # Корневой layout
├── components/            # React компоненты
│   ├── analytics/         # KPICard, StatCard
│   ├── auth/              # LoginForm, RegisterForm
│   ├── layout/            # DashboardLayout, Header
│   └── ui/                # shadcn/ui компоненты
├── lib/                   # Утилиты
│   ├── auth/              # NextAuth helpers
│   └── prisma.ts          # Prisma client singleton
├── bot/                   # Telegram Bot
│   ├── handlers/          # Обработчики команд
│   │   ├── start.ts       # /start
│   │   ├── register.ts    # /register + код
│   │   └── report.ts      # /report (11 шагов)
│   ├── utils/             # Валидация, форматирование
│   ├── types/             # TypeScript типы
│   └── index.ts           # Главный файл бота
├── prisma/
│   └── schema.prisma      # Схема БД (User + Report)
├── .env.example           # Пример переменных окружения
├── start-local.sh         # Скрипт запуска
└── README.md              # Этот файл
```

---

## 🗄️ База данных

### Модель User

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String
  name          String
  role          Role      @default(EMPLOYEE)
  telegramId    String?   @unique
  telegramCode  String?   @unique
  codeExpiresAt DateTime?
  reports       Report[]
  managedUsers  User[]    @relation("ManagerToEmployees")
  manager       User?     @relation("ManagerToEmployees")
  managerId     String?
}

enum Role {
  EMPLOYEE
  MANAGER
}
```

### Модель Report

```prisma
model Report {
  id                String   @id @default(cuid())
  userId            String
  date              DateTime
  pzmScheduled      Int      @default(0)
  pzmConducted      Int      @default(0)
  rejections        Int      @default(0)
  rejectionReason   String?
  warmUp            Int      @default(0)
  vzmConducted      Int      @default(0)
  contractReview    Int      @default(0)
  dealsClosed       Int      @default(0)
  salesAmount       Decimal  @default(0) @db.Decimal(12, 2)
  user              User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, date])
}
```

---

## 📝 API Endpoints

### Authentication

- `POST /api/auth/register` - Регистрация нового пользователя
- `POST /api/auth/signin` - Вход (NextAuth)
- `POST /api/auth/signout` - Выход

### Reports

- `GET /api/reports` - Получить отчёты (с фильтрами)
- `POST /api/reports` - Создать отчёт

### Statistics

- `GET /api/statistics` - Агрегированная статистика

### Users

- `GET /api/users` - Список сотрудников (только для MANAGER)

### Telegram

- `POST /api/telegram/generate-code` - Генерация кода привязки

---

## 🚀 Deployment

### Vercel (Next.js App)

```bash
# 1. Установите Vercel CLI
npm i -g vercel

# 2. Войдите в аккаунт
vercel login

# 3. Deploy
vercel

# 4. Добавьте env variables в Vercel Dashboard:
# - DATABASE_URL (Neon.tech connection string)
# - NEXTAUTH_SECRET
# - NEXTAUTH_URL (https://your-app.vercel.app)

# 5. Production deploy
vercel --prod
```

### Railway (Telegram Bot)

1. Зарегистрируйтесь на https://railway.app
2. Создайте новый проект
3. Connect GitHub или deploy locally
4. Добавьте environment variables:
   - `DATABASE_URL`
   - `TELEGRAM_BOT_TOKEN`
5. Start Command: `npm run bot:start`
6. Deploy

---

## 🧪 Разработка

### Проверка типов

```bash
npx tsc --noEmit
```

### Линтинг

```bash
npm run lint
```

### Генерация Prisma Client

```bash
npx prisma generate
```

### Просмотр БД (Prisma Studio)

```bash
npx prisma studio
```

---

## 📦 Скрипты

- `npm run dev` - Запуск Next.js в dev режиме
- `npm run build` - Сборка production build
- `npm start` - Запуск production Next.js
- `npm run bot:dev` - Запуск Telegram бота (dev)
- `npm run bot:start` - Запуск Telegram бота (production)
- `./start-local.sh` - Автоматический запуск всех сервисов

---

## 🐛 Устранение проблем

### Next.js не запускается

```bash
# Удалите .next и пересоберите
rm -rf .next
npm run dev
```

### Prisma ошибки

```bash
# Пересоздайте Prisma Client
npx prisma generate
npx prisma db push
```

### Telegram бот не отвечает

1. Проверьте `TELEGRAM_BOT_TOKEN` в `.env`
2. Убедитесь что бот запущен: `npm run bot:dev`
3. Проверьте логи: `tail -f /tmp/callwork-bot.log`

### База данных недоступна

1. Проверьте `DATABASE_URL` в `.env`
2. Убедитесь что PostgreSQL запущен
3. Проверьте подключение: `psql $DATABASE_URL`

---

## 📄 Лицензия

MIT

---

## 👨‍💻 Автор

Создано с помощью Claude Code  
Дата: 2025-11-18
