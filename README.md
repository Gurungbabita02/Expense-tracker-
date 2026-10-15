# Pocketwise v1.2

Personal expense and savings tracker. Next.js 14 (App Router) · MongoDB · JWT cookie sessions.

## Run it

```bash
npm install
cp .env.example .env.local     # then fill in JWT_SECRET (openssl rand -hex 32)
npm run dev                    # http://localhost:3000
npm test                       # unit tests (no database needed)
```

You need a MongoDB instance (`MONGODB_URI`, default `mongodb://localhost:27017`).
In production `JWT_SECRET` must be 32+ characters and not a placeholder, or the app refuses to start sessions.

## What's new in v1.1 + v1.2

**Foundations (v1.1)**
- **Accounts**: bank, cash, wallet, credit card. Per-account balances, opening balance, transfers between accounts.
- **Custom categories**: add, rename (history, budgets and recurring rules follow), recolour, archive. Same name allowed under Spending and Income.
- **Recurring transactions**: weekly / monthly / yearly rules for expenses, income, savings and transfers. Created automatically when due, idempotent, month-end aware (31st becomes 28th/30th, then back to 31st). Pause, resume (skips what was missed), edit, end date.
- **Per-month budgets**: a month inherits the latest earlier month until you change it. Optional overall monthly cap. Optional carry-over of last month's unspent amount.
- **Dark mode**: match device, light or dark (remembered, no flash on load).

**Savings (v1.2)**
- **Savings goals** with target, optional date, "save about ₹X a month" guidance, and add-money.
- **Saving transaction type**: money set aside is separate from spending. Deleting a goal keeps its savings as general savings.
- **Savings-rate trend** with a target line, and a configurable target.
- **Emergency fund meter**: months of spending covered (average of the last 3 full months).
- **Month-vs-month insights**: plain-language changes in spending, categories, income and savings. The current month is compared with the same day last month, not a full month.

## How the numbers work
- *Available balance* = sum of account balances (opening + income − spending − money set aside ± transfers).
- *Savings rate* = (income − spending) ÷ income. It can be negative. Transfers never count as income or spending.
- *Set aside* = saving transactions this month. *Total saved* = all saving transactions.

## Data model (MongoDB)
`users` (settings, legacy `budgets`) · `transactions` (type: expense | income | saving | transfer; `accountId`, `goalId?`, `toAccountId?`, `recurringId?`) · `categories` · `accounts` · `goals` · `recurring` · `budgets` (one snapshot per user per month).

### Upgrading from v1.1 data
Automatic and idempotent, on a user's first request: starter categories and a "Main account" are created, existing transactions are moved into that account, and old per-user budgets keep working until you edit a month. Nothing is deleted.

## API (all routes require login; everything is scoped to the signed-in user)
| Route | Methods |
|---|---|
| `/api/transactions`, `/api/transactions/[id]` | GET (type, q, month, accountId) · POST · PUT · DELETE |
| `/api/transactions/sample` | POST `{today}` demo data |
| `/api/categories`, `/[id]` | GET · POST · PUT (incl. `archived`) · DELETE (archives if in use) |
| `/api/accounts`, `/[id]` | same pattern; the last active account can't be removed |
| `/api/goals`, `/[id]` | GET · POST · PUT · DELETE |
| `/api/recurring`, `/[id]` | GET · POST · PUT · PATCH `{active}` · DELETE |
| `/api/recurring/run` | POST `{today}` creates everything that is due |
| `/api/budgets?month=YYYY-MM` | GET · PUT `{month, limits, cap}` |
| `/api/settings` | GET · PUT `{savingsTarget, rollover, emergencyMonths}` |
| `/api/auth/*` | register, login, logout, me (GET/PATCH) |

Dates are plain `YYYY-MM-DD` strings. The browser always sends its own local "today", which fixes the old bug where early-morning entries in India landed on the previous day.

## Known limits (planned for later phases)
Not part of this release: dependency upgrade (Next.js 14.2.15 has published security advisories), rate limiting that survives restarts, security headers/CSP, password reset, email verification, account deletion and data export, pagination (the dashboard loads all transactions), withdrawing money from a goal, and sub-categories.
