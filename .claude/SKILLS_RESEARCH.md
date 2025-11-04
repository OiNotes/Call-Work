# Claude Code Skills Research - Community Examples & Best Practices

**Date:** November 4, 2025  
**Purpose:** Comprehensive research of real-world Claude Code Skills from community and professionals  
**Project Context:** Status Stock 4.0 - Telegram E-Commerce Platform (Node.js, Express, PostgreSQL, Telegraf.js, React, Crypto APIs)

---

## ЧАСТЬ 1: ТОП-5 КРУТЫХ ПРИМЕРОВ SKILLS ИЗ СООБЩЕСТВА

### 1. **obra/superpowers** (GitHub: obra/superpowers)
**Категория:** Development & Collaboration Framework  
**URL:** https://github.com/obra/superpowers

**Что это:**
- Официальная core skills library для Claude Code от разработчика
- 20+ battle-tested skills включая TDD, debugging, collaboration patterns
- Token-efficient (30-50 tokens per skill until loaded)

**Крутые примеры:**
```
- RED-GREEN-REFACTOR testing cycle skill
- 4-phase root cause debugging skill
- Socratic questioning для design refinement
- Batch execution с checkpoints для координации
- Concurrent subagent workflow coordination
```

**Best Practices:**
- Process-oriented (систематично, не ad-hoc)
- Evidence-based (verify before declaring success)
- Verification-focused (mandatory validation steps)
- Simplicity-first (complexity reduction)
- Domain-centric (work at problem level, not implementation)

**Для Status Stock 4.0:** Адаптировать для E-Commerce workflow, Payment verification, Bot testing

---

### 2. **anthropics/skills** (Официальный репозиторий Anthropic)
**URL:** https://github.com/anthropics/skills

**Что это:**
- Official Anthropic repository с reference examples
- Демонстрирует что возможно с Claude Skills
- Range от creative (art, music, design) до enterprise workflows

**Крутые примеры:**
```
artifacts-builder
├─ Build complex React components
├─ Tailwind CSS + shadcn/ui
├─ HTML artifacts для claude.ai

webapp-testing
├─ Playwright for UI verification
├─ Local web app testing
└─ Debugging automation

mcp-builder
├─ Guidance for MCP servers
├─ API integration patterns
└─ External service connectivity

algorithmic-art
├─ p5.js generative art
├─ Seeded randomness
├─ Flow fields & particle systems

slack-gif-creator
├─ Animated GIF generation
├─ Size validation
└─ Platform-specific optimization
```

**Структура Skills:**
```
skill-name/
├─ SKILL.md                    (метаданные + инструкции)
├─ scripts/                    (исполняемые скрипты)
│  └─ automation.sh
├─ references/                 (документация)
│  └─ api-docs.md
└─ assets/                     (templates, файлы)
   └─ template.json
```

**Для Status Stock 4.0:** Использовать как template для payment-processor-skill, bot-automation-skill, webhook-skill

---

### 3. **alirezarezvani/claude-code-skill-factory** (Skill Factory Toolkit)
**URL:** https://github.com/alirezarezvani/claude-code-skill-factory

**Что это:**
- Toolkit для генерации production-ready Skills
- 4 factory systems (Skills, Agents, Prompts, Hooks)
- Automated quality validation

**4 Factory Systems:**

#### a) Skills Factory
```yaml
Генерирует:
- YAML frontmatter с метаданными
- Python/Shell implementation files
- Sample data & documentation
- Quality validation (7-point check)
```

#### b) Agents Factory  
```yaml
Создаёт:
- Enhanced YAML frontmatter
- MCP integration support
- Auto-invocation capabilities
- Tool access configuration
```

#### c) Prompt Factory
```yaml
Delivers:
- 69 professional presets
- 15 domains coverage
- Multiple output formats
- 7-point quality validation
```

#### d) Hooks Factory
```yaml
Produces:
- 7 event types support
- Safety validation
- Language-specific templates
- Interactive Q&A (5-7 questions)
```

**3 Official Anthropic Patterns:**
1. **Simple pattern** - Direct skill execution
2. **Multi-Phase pattern** - Sequential steps
3. **Agent-Style pattern** - Autonomous agent coordination

**Для Status Stock 4.0:** Использовать Factory для быстрой генерации payment-processing-skill, database-migration-skill

---

### 4. **BehiSecc/awesome-claude-skills** (Community Curated Collection)
**URL:** https://github.com/BehiSecc/awesome-claude-skills

**Специализированные Skills:**

```
pypict-claude-skill
├─ Pairwise Independent Combinatorial Testing
├─ Comprehensive test case design
└─ Quality assurance patterns

aws-skills
├─ AWS development workflows
├─ CDK best practices
└─ Serverless architecture patterns

webapp-testing
├─ Playwright automation
├─ UI interaction testing
└─ Web app debugging

file-organizer
├─ Intelligent file management
├─ Automated organization
└─ Cross-computer sync

meeting-insights-analyzer
├─ Transcript analysis
├─ Actionable insights
└─ Summary generation

git-workflow-manager
├─ Git automation
├─ Branch management
└─ Commit strategies
```

**Для Status Stock 4.0:**  
- Адаптировать git-workflow-manager для bot development workflow
- Создать crypto-wallet-validator skill
- webhook-delivery-testing skill для payment callbacks

---

### 5. **alirezarezvani/claude-skills** (42+ Production Skills)
**URL:** https://github.com/alirezarezvani/claude-skills

**Что это:**
- 42 production-ready skills in Phase 1
- Executive advisor skills (CEO, CTO roles)
- Specialized domain expertise

**Примеры Skills:**

```
CEO Advisor Skill
├─ Board presentation preparation
├─ Strategic planning
├─ Tech debt analysis
└─ Executive communications

CTO Advisor Skill  
├─ Architecture reviews
├─ Team scaling strategies
├─ Technology selection
└─ Infrastructure planning

DevOps Skills
├─ Deployment automation
├─ Monitoring setup
├─ Incident response
└─ Infrastructure as Code

Security Skills
├─ Vulnerability assessment
├─ Penetration testing prep
├─ Security audit workflows
└─ Compliance checking
```

**Architecture Pattern:**
- Skills composed automatically (Claude identifies which ones needed)
- Works across Claude.ai, Claude Code, API
- Stacking capability (multiple skills in one workflow)

**Для Status Stock 4.0:**  
- E-Commerce Store Manager skill
- Payment Processor skill
- Bot Development skill
- Telegram API Integration skill

---

## ЧАСТЬ 2: BEST PRACTICES КОТОРЫЕ Я ПРОПУСТИЛ

### A. Skills Architecture & Design

#### 1. **SKILL.md Frontmatter** (Required + Optional)
```yaml
---
name: payment-processor
description: >
  Automate payment processing for crypto and traditional payments.
  Handles wallet validation, transaction verification, failure recovery.
  
allowed-tools:
  - Bash
  - Write
  - Read
  - Edit
  
model: claude-3-5-sonnet-20241022
version: 1.0.0
license: MIT
author: Status Stock Team
---

# Your markdown instructions here (max 5,000 words)
```

#### 2. **Progressive Disclosure Pattern**
- Keep main SKILL.md under 2,000 words
- Reference detailed docs in `/references/`
- Load scripts from `/scripts/`
- Template files in `/assets/`

#### 3. **Composable Skills** (Key Insight!)
- Skills auto-activate based on context
- No manual loading needed
- Claude decides which skills relevant
- Multiple skills stack automatically

### B. Execution Patterns (3 Official Patterns)

#### 1. **Simple Pattern**
```markdown
# skill-name

## What this skill does
Direct instruction on what Claude should do.

## When to use it
When triggered by user request matching skill description.

## How to implement
Step-by-step instructions.
```

#### 2. **Multi-Phase Pattern**
```markdown
# skill-name

## Phase 1: Preparation
- Verify prerequisites
- Set up workspace

## Phase 2: Execution  
- Run main logic
- Validate results

## Phase 3: Completion
- Cleanup
- Report results
```

#### 3. **Agent-Style Pattern**
```markdown
# skill-name

## Subagent Coordination
- Identify which subagents needed
- Dispatch tasks in parallel
- Collect and merge results
- Final verification

## Tool Access Configuration
- Which tools can subagents use?
- Safety constraints
- Resource limits
```

### C. Claude Code Hooks (Event-Driven Automation)

**Available Hook Events:**
```
- PreToolUse          (runs before any tool, can block)
- PostToolUse         (runs after tool completes)
- UserPromptSubmit    (before processing user input)
- Notification        (when Claude needs user attention)
- Stop                (when Claude stops responding)
- SessionStart        (session initialization)
- SessionEnd          (session cleanup)
```

**Hook Configuration:** `~/.claude/settings.json`
```json
{
  "hooks": {
    "preToolUse": [
      {
        "matcher": "Bash",
        "command": "bash hooks/log-commands.sh"
      },
      {
        "matcher": "Edit|Write",
        "command": "bash hooks/protect-secrets.sh"
      }
    ],
    "postToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "npx prettier --write {file_path}"
      }
    ]
  }
}
```

**Hook Security Warning:** ⚠️ Hooks run with your current environment credentials. Malicious hooks can exfiltrate data. Always review before registering!

### D. Skills Discovery & Selection

- **No algorithmic selection** - Claude reads skill descriptions and decides via reasoning
- **No embeddings needed** - Pure LLM-based intent detection
- **Context-aware activation** - Skills trigger when relevant
- **Transparent loading** - Users see which skills are being used

### E. Document Automation Patterns

Anthropic built all file handling (PDF, DOCX, XLSX, PPTX) using Skills:
```
document-processor/
├─ SKILL.md (instructions)
├─ scripts/
│  ├─ create-pdf.py
│  ├─ create-docx.py
│  ├─ create-xlsx.py
│  └─ create-pptx.py
├─ references/
│  ├─ pdf-api-docs.md
│  ├─ office-formats.md
│  └─ best-practices.md
└─ assets/
   ├─ templates/
   └─ examples/
```

### F. Skills vs MCP (Key Difference!)

**Skills advantages:**
- Markdown-based (easy to write)
- Token-efficient (small prompt overhead)
- Composable (auto-stacking)
- No infrastructure needed
- Works with CLI, code, async

**MCP advantages:**
- Real-time tool access
- Complex integrations
- Network APIs
- But: higher complexity, more setup

**Best Practice:** Skills for domain knowledge + automation, MCP for external API connectivity

---

## ЧАСТЬ 3: 7 ИДЕЙ НОВЫХ SKILLS ДЛЯ STATUS STOCK 4.0

### 1. **crypto-wallet-validator-skill**
**Категория:** Payment Security  
**Priority:** P0 (Critical)

```markdown
---
name: crypto-wallet-validator
description: >
  Validate cryptocurrency wallets across multiple blockchains.
  Supports Bitcoin, Ethereum, TRON, and other EVM chains.
  Detects fraudulent wallets, validates ownership, checks balance.
  
allowed-tools:
  - Bash
  - Read
  - Write

dependencies:
  - ethers.js (Ethereum)
  - bitcoinjs-lib (Bitcoin)
  - tronweb (TRON)
  - wallet-validator (npm)
---

# Crypto Wallet Validator Skill

## Purpose
Validate customer wallets before payment processing to prevent fraud.

## Supported Blockchains
- Bitcoin (BTC) - via bitcoinjs-lib
- Ethereum (ETH) - via ethers.js, Etherscan API
- TRON (TRX) - via TronWeb, TronGrid API
- EVM chains - via Etherscan-compatible APIs

## Validation Checks
1. Format validation (valid address format)
2. Checksum validation (correct address encoding)
3. Balance verification (has funds)
4. Owner verification (user control)
5. Risk assessment (blacklist check)

## Implementation
Uses existing validators in Status Stock 4.0:
- backend/src/services/paymentService.js
- backend/src/services/blockchainService.js
```

**Scripts needed:**
```bash
scripts/
├─ validate-bitcoin.js
├─ validate-ethereum.js
├─ validate-tron.js
├─ check-balance.js
└─ detect-fraud.js
```

**References:**
```
references/
├─ blockchain-apis.md
├─ wallet-formats.md
├─ security-best-practices.md
└─ known-scam-patterns.md
```

**Use Cases:**
- Verify customer wallet before payment
- Prevent payment to blacklisted wallets
- Check wallet has sufficient balance
- Generate fraud risk scores

---

### 2. **telegram-bot-automation-skill**
**Категория:** Bot Development  
**Priority:** P0 (Critical)

```markdown
---
name: telegram-bot-automation
description: >
  Automate Telegram bot development workflows using Telegraf.js.
  Handles button handlers, scene navigation, session management,
  keyboard generation, message formatting, callback queries.
  
allowed-tools:
  - Edit
  - Write
  - Read
  - Bash

dependencies:
  - telegraf.js ^4.12
  - session management patterns
  - keyboard builder helpers
---

# Telegram Bot Automation Skill

## Purpose
Streamline Telegram bot development with Telegraf.js patterns.

## Patterns Covered
1. Button Handler Pattern
2. Scene Navigation
3. Session State Management  
4. Keyboard Generation
5. Message Formatting
6. Callback Query Handling
7. Error Recovery

## Multi-Phase Execution

### Phase 1: Analyze Intent
- What functionality needed?
- Which Telegraf features apply?
- Session state changes?

### Phase 2: Generate Code
- Create handler function
- Add keyboard if needed
- Implement session logic

### Phase 3: Integration
- Add to bot structure
- Connect scenes
- Test manually

## Implementation Examples
- Create seller menu handler
- Implement product picker scene
- Handle checkout flow
- Manage wallet connections
```

**Scripts:**
```bash
scripts/
├─ generate-handler-template.js
├─ create-keyboard-builder.js
├─ setup-scene-navigation.js
├─ test-bot-locally.sh
└─ deploy-bot-changes.sh
```

---

### 3. **payment-processor-skill**
**Категория:** Payment Processing  
**Priority:** P0 (Critical)

```markdown
---
name: payment-processor
description: >
  End-to-end payment processing automation.
  Handles order creation, payment verification, confirmation,
  failure recovery, refunds, webhook processing.
  Supports crypto and traditional payments.
  
allowed-tools:
  - Bash
  - Edit
  - Read
  - Write
  
dependencies:
  - crypto validation service
  - database access
  - webhook server
---

# Payment Processor Skill

## Workflow

```
User Initiates Payment
    ↓
Select Payment Method (Crypto/Card)
    ↓
Validate Wallet (if Crypto)
    ↓
Generate Payment Request
    ↓
Wait for Confirmation
    ↓
Verify Transaction
    ↓
Update Order Status
    ↓
Send Confirmation
```

## Error Handling
- Insufficient balance → show error
- Invalid wallet → request new wallet
- Timeout → resend payment request
- Verification failed → escalate to support

## Implementation Checklist
- [ ] Validate payment method
- [ ] Check sufficient balance
- [ ] Generate payment request
- [ ] Store pending transaction
- [ ] Set confirmation timeout
- [ ] Verify transaction
- [ ] Update order status
- [ ] Send customer confirmation
```

---

### 4. **database-schema-migration-skill**
**Категория:** Database Operations  
**Priority:** P1 (High)

```markdown
---
name: database-schema-migration
description: >
  Automated PostgreSQL schema migrations with safety.
  Auto-backup before migration, schema validation,
  rollback capability, data consistency checks.
  Uses existing migration system in backend/database/
  
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit

dependencies:
  - PostgreSQL CLI
  - pg npm package
  - Migration framework (backend/database/migrations.cjs)
---

# Database Migration Skill

## Phases

### Phase 1: Preparation
```bash
# Backup database
pg_dump postgres://user@localhost/telegram_shop > backup.sql

# Create migration file
touch database/migrations/001_add_column.sql

# Verify schema
psql -c "\d products"
```

### Phase 2: Schema Changes
- ALTER TABLE statements
- CREATE INDEX for performance
- ADD CONSTRAINTS for data integrity
- UPDATE existing data if needed

### Phase 3: Verification
```bash
# Apply migration
npm run db:migrate

# Validate schema
psql -c "\d products"

# Run data checks
SELECT COUNT(*) FROM products;
```

### Phase 4: Rollback (if needed)
```bash
# Restore from backup
psql postgres://user@localhost/telegram_shop < backup.sql
```

## Safety Checklist
- [ ] Backup created
- [ ] Migration script tested locally
- [ ] Rollback plan ready
- [ ] Zero-downtime migration design
- [ ] Data consistency validated
```

---

### 5. **webhook-delivery-testing-skill**
**Категория:** Payment Integration  
**Priority:** P1 (High)

```markdown
---
name: webhook-delivery-testing
description: >
  Test webhook delivery for payment confirmations.
  Simulates payment processor responses, validates
  signature verification, tests idempotency,
  error recovery, retry logic.
  
allowed-tools:
  - Bash
  - Write
  - Read
  - Edit

dependencies:
  - ngrok for tunnel
  - test payment APIs
  - webhook simulator
---

# Webhook Delivery Testing Skill

## Test Scenarios

### 1. Success Case
```bash
# Send successful payment webhook
curl -X POST http://localhost:3000/webhook/payment \
  -H "Content-Type: application/json" \
  -H "X-Signature: {signature}" \
  -d '{
    "event": "payment.confirmed",
    "transaction_id": "test_123",
    "status": "confirmed"
  }'
```

### 2. Signature Verification
- Test valid signature → passes
- Test invalid signature → rejected
- Test missing signature → rejected

### 3. Idempotency
- Send same webhook twice
- Verify only processed once
- Check idempotency key handling

### 4. Retry Logic
- Webhook timeout → retry
- 5xx error → exponential backoff
- Max retries → alert

### 5. Error Recovery
- Malformed JSON → error response
- Missing fields → validation error
- Unknown payment ID → graceful failure
```

**Scripts:**
```bash
scripts/
├─ simulate-webhook.js
├─ test-signature-validation.js
├─ test-idempotency.js
├─ test-retry-logic.sh
└─ load-test-webhooks.js
```

---

### 6. **monitoring-alerting-skill**
**Категория:** Operations & Monitoring  
**Priority:** P1 (High)

```markdown
---
name: monitoring-alerting
description: >
  Production monitoring and alerting automation.
  Real-time error log analysis, performance metrics,
  cost tracking, critical alert escalation.
  Uses OpenTelemetry for observability.
  
allowed-tools:
  - Bash
  - Read
  - Write
---

# Monitoring & Alerting Skill

## Error Detection
```bash
# Analyze error logs
tail -f backend/logs/error.log | grep -E "ERROR|CRITICAL"

# Count errors per service
grep "ERROR" backend/logs/*.log | cut -d: -f1 | sort | uniq -c

# Alert if error rate > threshold
if [ $(grep -c ERROR backend/logs/error.log) -gt 50 ]; then
  SEND_ALERT "High error rate detected"
fi
```

## Performance Metrics
- API response time (target: <500ms p95)
- Database query time (target: <200ms)
- Bot message latency (target: <100ms)
- Payment verification time (target: <30s)

## Cost Tracking
```bash
# Estimate daily costs
BACKEND_COST=$(aws ec2 describe-instances | jq '.[] | .Cost')
DATABASE_COST=$(aws rds describe-db-instances | jq '.[] | .Cost')
TOTAL_DAILY=$(echo "$BACKEND_COST + $DATABASE_COST" | bc)
```

## Alert Channels
- Telegram notification
- Email escalation
- PagerDuty on-call
- Slack channel

## Alerting Rules
1. Error rate > 5% → Warning
2. Error rate > 10% → Critical
3. API response > 2s → Warning
4. Payment failure > 3% → Critical
5. Database connection pool exhausted → Critical
```

---

### 7. **backup-recovery-automation-skill**
**Категория:** Disaster Recovery  
**Priority:** P2 (Medium)

```markdown
---
name: backup-recovery-automation
description: >
  Automated backup and disaster recovery workflows.
  Daily database backups, incremental backups,
  backup verification, point-in-time recovery,
  cross-region replication setup.
  
allowed-tools:
  - Bash
  - Read
  - Write
---

# Backup & Recovery Automation Skill

## Backup Strategy

### Full Backup (Daily)
```bash
# Every day at 2 AM
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump postgres://user@localhost/telegram_shop | \
  gzip > backups/full_${TIMESTAMP}.sql.gz

# Verify backup
gunzip -t backups/full_${TIMESTAMP}.sql.gz
```

### Incremental Backup (Hourly)
```bash
# Use WAL (Write-Ahead Logs)
# Stored in: /var/lib/postgresql/[version]/main/pg_wal/
```

### Backup Verification
```bash
# Test restore on separate instance
createdb test_restore
gunzip < backup.sql.gz | psql test_restore

# Verify data integrity
psql test_restore -c "SELECT COUNT(*) FROM users;"
```

## Disaster Recovery Scenarios

### Scenario 1: Data Corruption (Last Hour)
→ Restore from hourly backup

### Scenario 2: Data Loss (Last Day)
→ Restore from daily backup

### Scenario 3: Full System Failure
→ Restore from off-site backup
→ Recreate application servers
→ Sync data from blockchain (crypto transactions)

## Recovery Checklist
- [ ] Identify recovery point
- [ ] Restore database
- [ ] Verify data integrity
- [ ] Restart application
- [ ] Test functionality
- [ ] Document incident
```

---

## ЧАСТЬ 4: КРЕАТИВНЫЕ USE CASES & AUTOMATION PATTERNS

### Pattern 1: **Skill Chaining** (Sequential Skill Execution)

```markdown
# Example: Complete Order Fulfillment Workflow

## User Request
"Process order #12345 and send confirmation"

## Automatic Skill Activation

1. payment-processor-skill
   ├─ Validate payment status
   ├─ Confirm transaction
   └─ Update order status

2. telegram-bot-automation-skill
   ├─ Prepare order confirmation message
   ├─ Format order details
   └─ Build inline keyboard for tracking

3. notification-skill (custom)
   ├─ Send customer confirmation
   ├─ Update seller dashboard
   └─ Log transaction

4. database-schema-migration-skill (if needed)
   └─ Migrate order schema for new fields
```

**How it works:**
- Claude reads all available skills at session start
- Automatically chains relevant skills
- Data flows between skills via files/database
- User sees unified progress

---

### Pattern 2: **Hook-Driven Automation**

```bash
# hooks/post-file-edit.sh - Auto-validate code changes

#!/bin/bash
FILE_PATH=$1

# If Python file was edited → auto-format + lint
if [[ $FILE_PATH == *.py ]]; then
  black "$FILE_PATH"
  pylint "$FILE_PATH"
fi

# If JavaScript file was edited → prettier + eslint
if [[ $FILE_PATH == *.js ]]; then
  npx prettier --write "$FILE_PATH"
  npx eslint --fix "$FILE_PATH"
fi

# If database migration created → validate SQL
if [[ $FILE_PATH == *migration* && $FILE_PATH == *.sql ]]; then
  psql --dry-run < "$FILE_PATH"
fi

# If .env file touched → BLOCK it!
if [[ $FILE_PATH == .env ]]; then
  echo "ERROR: Do not edit .env file!"
  exit 2  # Block the edit
fi
```

---

### Pattern 3: **Multi-Phase Skill Execution**

```markdown
# Example: Bot Feature Implementation

## Phase 1: Design & Planning
- User describes feature
- Skill identifies requirements
- Creates implementation plan
- Lists affected components

## Phase 2: Implementation
- Generate handler code
- Create keyboard layouts
- Add session management
- Write tests

## Phase 3: Integration Testing
- Test locally with ngrok
- Verify bot responds correctly
- Check database updates
- Validate error handling

## Phase 4: Production Deployment
- Create deployment branch
- Run full test suite
- Deploy to production
- Monitor for errors
- Rollback if needed
```

---

### Pattern 4: **Data Journalism Agent** (from Simon Willison's article)

```markdown
# Multi-Skill Data Analysis Workflow

## Skills Composition

skill-data-source-reader
  └─ Access US census data APIs
  └─ Load JSON/CSV files
  └─ Parse schema

skill-data-to-database
  └─ Create PostgreSQL tables
  └─ Load data with ETL
  └─ Verify data integrity

skill-data-analysis
  └─ Run SQL queries
  └─ Generate statistics
  └─ Find newsworthy patterns

skill-visualization-generator
  └─ Create charts/graphs
  └─ Generate insights
  └─ Write narrative

skill-publication-uploader
  └─ Publish to Medium
  └─ Upload to S3
  └─ Update website

## Result
Fully automated data journalism pipeline with Claude as coordinator
```

---

### Pattern 5: **Error Recovery Automation**

```markdown
# Auto-Recovery Workflow

## Error Detection
→ Bash hook catches failed command
→ Logs error to system

## Automatic Recovery

1. Check Error Type
   ├─ Port already in use?
   ├─ Database connection failed?
   ├─ Missing dependency?
   ├─ Invalid syntax?
   └─ Timeout?

2. Apply Fix
   ├─ Kill process on port
   ├─ Restart PostgreSQL
   ├─ npm install
   ├─ Format code
   └─ Increase timeout

3. Retry Operation
   └─ Re-run failed command

4. Verify Success
   └─ Health check
```

---

## ЧАСТЬ 5: AUTOMATION PATTERNS ДЛЯ STATUS STOCK 4.0

### Pattern A: **Daily Health Check Automation**

```bash
# hooks/session-start.sh
# Runs automatically when Claude Code session starts

#!/bin/bash

echo "🚀 Starting Status Stock 4.0 Health Check..."

# Check database
psql postgres://user@localhost/telegram_shop -c "SELECT COUNT(*) FROM users;" && \
  echo "✅ Database: Connected" || echo "❌ Database: Failed"

# Check backend server
curl -s http://localhost:3000/health && \
  echo "✅ Backend: Running" || echo "❌ Backend: Offline"

# Check bot service
lsof -i :8081 && echo "✅ Bot: Running" || echo "❌ Bot: Offline"

# Check recent errors
ERROR_COUNT=$(grep -c "ERROR" backend/logs/*.log 2>/dev/null || echo "0")
if [ "$ERROR_COUNT" -gt 10 ]; then
  echo "⚠️  $ERROR_COUNT recent errors - run 'analyze logs'"
fi

echo "🏁 Health check complete"
```

---

### Pattern B: **Automated Git Workflow**

```bash
# hooks/pre-tool-use.sh (matcher: "Bash")
# Validates git commands before execution

if [[ $COMMAND == *"git commit"* ]]; then
  # Enforce conventional commits
  if [[ ! $COMMAND =~ feat:|fix:|docs:|test:|refactor: ]]; then
    echo "❌ Use conventional commits: feat:, fix:, docs:, etc."
    exit 2  # Block the commit
  fi
fi

if [[ $COMMAND == *"git push"* ]]; then
  # Prevent force push to main
  if [[ $COMMAND == *"--force"* ]] && [[ $COMMAND == *"main"* ]]; then
    echo "❌ Cannot force push to main branch"
    exit 2  # Block the push
  fi
fi

if [[ $COMMAND == *"git rebase"* ]]; then
  # Auto-create backup branch
  TIMESTAMP=$(date +%s)
  git branch "backup_${TIMESTAMP}"
  echo "✅ Backup branch created: backup_${TIMESTAMP}"
fi
```

---

### Pattern C: **Payment Testing Automation**

```markdown
# payment-testing-skill

## Automated Test Suite

### Unit Tests
```bash
npm test -- backend/src/services/paymentService.test.js
```

### Integration Tests
```bash
# 1. Start test database
npm run db:seed

# 2. Start backend server
npm run dev &

# 3. Simulate payments
bash scripts/test-crypto-payment.sh
bash scripts/test-invalid-wallet.sh
bash scripts/test-insufficient-balance.sh
bash scripts/test-timeout-recovery.sh

# 4. Verify results
bash scripts/verify-order-status.sh
```

### Webhook Testing
```bash
# Use ngrok for public URL
ngrok http 3000

# Send test webhooks
bash scripts/test-webhook-delivery.sh

# Verify idempotency
bash scripts/test-webhook-idempotency.sh
```
```

---

## SUMMARY OF FINDINGS

### Key Insights

1. **Skills >> MCP for Domain Knowledge**
   - Markdown-based, easy to iterate
   - Token-efficient (small overhead)
   - Auto-composable (no manual loading)
   - Perfect for your team's workflows

2. **Hooks for Deterministic Automation**
   - PreToolUse: Block dangerous commands
   - PostToolUse: Auto-format/lint/test
   - No tokens wasted on retry logic

3. **Composability is Default**
   - Skills auto-chain based on context
   - No explicit coordination needed
   - Claude handles skill selection

4. **Production-Ready from Day 1**
   - Use 3 official Anthropic patterns
   - 7-point quality validation
   - Proper error handling included

### Recommendations for Status Stock 4.0

**Priority 1 (This Week):**
1. Create crypto-wallet-validator-skill
2. Create telegram-bot-automation-skill
3. Create payment-processor-skill
4. Set up hooks for auto-linting/formatting

**Priority 2 (Next Week):**
5. Create database-schema-migration-skill
6. Create webhook-delivery-testing-skill
7. Create monitoring-alerting-skill

**Priority 3 (Month 2):**
8. Create backup-recovery-automation-skill
9. Implement skill chaining for complex workflows
10. Add data science skills for analytics

**Long-term (Quarter 2):**
- Build "E-Commerce Operations Agent" combining all skills
- Create "Payment Risk Assessment Agent"
- Implement "Bot Development Copilot" skill
- Add blockchain monitoring skills

---

## RESOURCES

### Official Repositories
- https://github.com/anthropics/skills (Official examples)
- https://github.com/obra/superpowers (Core patterns)
- https://github.com/alirezarezvani/claude-code-skill-factory (Factory toolkit)
- https://github.com/travisvn/awesome-claude-skills (Community curated)

### Documentation
- https://docs.claude.com/en/docs/claude-code/skills (Official docs)
- https://docs.claude.com/en/docs/claude-code/hooks-guide (Hooks guide)
- https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/ (Deep dive)
- https://simonwillison.net/2025/Oct/16/claude-skills/ (Simon Willison's article)

### Community Articles
- https://www.lennysnewsletter.com/p/claude-skills-explained (Lenny's newsletter)
- https://medium.com/@joe.njenga/how-im-using-claude-skills-new-feature-to-blow-up-my-claude-code-workflows-9010c16292ca (Joe Njenga's workflows)
- https://www.anthropic.com/engineering/claude-code-best-practices (Anthropic best practices)

### Key Tools
- Claude Code CLI: Terminal-native AI coding
- Claude Code Desktop: IDE integration
- Claude API: Programmatic skill usage
- OpenTelemetry: Observability metrics
- ngrok: Webhook testing tunnels

---

**Research Completed:** November 4, 2025  
**Next Step:** Start implementing Priority 1 skills this week  
**Estimated Time:** 4-6 hours per skill for production-ready implementation
