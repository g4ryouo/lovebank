# CLAUDE.md — LoveBank

LoveBank 是給情侶使用的「愛的點數」手機優先 PWA。每個人有自己的「愛的菜單」,
一方點單、另一方完成後,由接受者付出虛擬點數、提供者賺取點數。
所有點數都是虛擬的,**不接任何真實金流**。

開始任何工作前,先讀:

1. `docs/SPEC.md`:產品規則、架構、資料模型、狀態機(唯一的規則來源)
2. `docs/TASKS.md`:任務清單與目前進度

## 技術棧

Next.js (App Router) + TypeScript strict、Tailwind、Supabase (Postgres + Auth + RLS)、
Vitest、Playwright、Vercel、pnpm。
登入:Google 帳號(Supabase Auth)。AI 審查:Anthropic API(僅伺服器端呼叫)。

## 常用指令(由 T1、T2 建立)

```
pnpm dev            # 開發伺服器
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest 單元測試
pnpm test:e2e       # Playwright(T4 之後才有)
pnpm db:start       # supabase start(需要 Docker)
pnpm db:reset       # supabase db reset(重跑所有 migration)
pnpm db:test        # supabase test db(pgTAP)
pnpm db:types       # 產生 src/types/database.ts
```

## 工作方式(必須遵守)

- 先規格再程式。一次只做一個任務(TASKS.md 的一個 T 編號)。
- 每個任務:先說明計畫(要建立/修改哪些檔案、順序),**等我確認後才動手**。
- 完成後依序跑 `pnpm lint`、`pnpm typecheck`、`pnpm test`(有改資料庫再加 `pnpm db:test`),全綠才算完成。
- 發現規格有漏洞或設計有分歧:先列出方案與取捨,**不要自行決定**。
- 不新增 SPEC 沒有的功能。不新增套件,除非先討論。
- 完成任務後更新 TASKS.md 的狀態。

## 不可違反的規則(Invariants)

1. 點數是整數。不使用浮點數。
2. 餘額**不儲存**,永遠由 `ledger` 加總計算。
3. `ledger` 只能新增(append-only)。更正只能用 `adjustment` 反向分錄。
4. **所有會改變點數或訂單狀態的操作,只能透過資料庫函式(SECURITY DEFINER)**。
   client 與一般 API 不得直接 INSERT/UPDATE `ledger`、`orders`。
5. 完成訂單時,在**同一個資料庫交易**內寫入兩筆 ledger(接受者 −、提供者 +)。
6. 同一筆訂單只能轉點一次;重複確認必須是無副作用的成功(冪等),不可重複寫帳。
7. 訂單記錄成交當下的價格、名稱、圖示快照。改價不影響既有訂單。
8. 所有資料表啟用 RLS。使用者只能看到自己情侶的資料。
9. 使用者不能修改自己的 `credit_limit`;不能修改對方的菜單價格。
10. 資料庫函式一律使用 `auth.uid()` 取得操作者,**不接受由 client 傳入的使用者 id**。
11. `SUPABASE_SERVICE_ROLE_KEY` 與 `ANTHROPIC_API_KEY` 只能出現在伺服器端程式碼,
    不得進入 client bundle、不得加 `NEXT_PUBLIC_` 前綴。
12. 送給 AI 的內容只有「提案的名稱、圖示、價格」,不含任何使用者身分或其他資料。

## 程式風格

- TypeScript strict,另開 `noUncheckedIndexedAccess`。不使用 `any`;必要時用 `unknown` 加縮小型別。
- 系統邊界(API route、表單、AI 回傳)一律用 zod 驗證。
- 規則與常數集中在 `src/lib/config.ts`(零用點數、上限、時限等),不要散落在程式各處。
- 業務規則的純函式放 `src/lib/points/`,不依賴 React 或 Supabase,方便測試。
- 元件小而單純;資料存取放 `src/lib/` 或 server actions,不放在元件裡。
- 錯誤用明確的錯誤代碼(見 SPEC 第 8 節),UI 依代碼顯示溫暖的訊息。

## 目錄結構

```
src/
  app/                  # 路由(見 SPEC 第 10 節)
    api/                # 僅放需要伺服器端祕密的 route(例如 AI 審查)
  components/
  lib/
    config.ts           # 常數
    supabase/           # client.ts / server.ts / admin.ts(admin 僅伺服器端)
    points/             # 純函式:餘額、額度、狀態轉換、分錄、零用點數
    menu/templates.ts   # 預設菜單範本
    ai/review.ts        # AI 審查(伺服器端)
  types/database.ts     # 由 supabase gen types 產生,不手改
supabase/
  config.toml
  migrations/
  tests/                # pgTAP
  seed.sql
docs/                   # SPEC.md / TASKS.md
e2e/                    # Playwright
```

## 介面用語

語氣溫暖輕鬆,語言為繁體中文。避免冷冰冰的金融用語。

| 避免 | 使用 |
| --- | --- |
| 交易、扣款、付款 | 送出愛心、收下愛心 |
| 餘額不足 | 愛心還不夠,再存一下吧 |
| 購買 | 邀請、想要 |
| 拒絕 | 婉拒 |
| 訂單 | 小心願、邀請 |

點數的名稱暫定為「愛心」。婉拒永遠不影響任何點數,介面不得暗示「付了點數就必須答應」。

## 環境變數(.env.example)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # 僅伺服器端
ANTHROPIC_API_KEY=              # 僅伺服器端
AI_MODEL=claude-haiku-5-5       # 可替換,不寫死在程式
```
