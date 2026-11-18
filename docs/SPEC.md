# LoveBank SPEC

版本:v0.1(討論定案版)。本文件是規則的唯一來源。要改規則,先改這份文件並取得確認。

## 1. 產品概述

兩個人配成一對。每人有一份「愛的菜單」(自己能做、願意為對方做的事),自訂價格(可為 0)。
一方向另一方「點單」或「主動邀請」,完成後由**接受者付點數、提供者賺點數**。
所有點數都是虛擬的,不接真實金流。真實世界的花費(機票、醫美等)由兩人自行處理,系統只記點數。

### 設計原則

- 溫暖,不計較。價格可為 0,提供者可以「這次免費」,婉拒永遠沒有代價。
- 對方的菜單只能瀏覽、點單,不能改價。想在對方菜單加項目,要走「服務提案」並取得同意。
- 自己的點數與額度,對方不能偷看、自己也不能亂調。

### 名詞

| 名詞 | 意思 |
| --- | --- |
| 提供者 (giver) | 做事的人,擁有該菜單項目,完成後賺點數 |
| 接受者 (receiver) | 被服務的人,完成後付點數 |
| 發起者 (initiator) | 建立這張訂單的人,可以是提供者或接受者 |
| 回應者 (responder) | 訂單中不是發起者的那一方,負責接受或婉拒 |
| 預留 (reserved) | 接受者已接受但尚未完成的訂單價格總和 |

## 2. MVP 範圍

配對、LINE 登入、我的菜單與範本、瀏覽對方菜單與點單(含主動邀請)、
訂單流程(接受/婉拒/取消/做完了/確認/這次免費/24 小時自動確認/邀請 3 天未回應自動過期)、贈送點數、
零用點數、信用額度申請與核准、服務提案(AI 審查加還價一次)、願望進度條、帳本與首頁。

**MVP 之後才考慮**:推播通知、打卡成就、異地戀玩法、多人群組、每週次數上限、額度提醒與其他額度玩法、解除配對。

## 3. 規則常數(`src/lib/config.ts`)

| 常數 | 值 | 說明 |
| --- | --- | --- |
| `INITIAL_GRANT` | 2000 | 配對完成時,雙方各得一次 |
| `DAILY_ALLOWANCE` | 500 | 每人每天,累積不清零 |
| `ALLOWANCE_CATCH_UP_DAYS` | 7 | 最多補發最近幾天(暫定,可調) |
| `AUTO_CONFIRM_HOURS` | 24 | 「做完了」之後自動確認的時限 |
| `REQUEST_EXPIRE_DAYS` | 3 | `requested` 訂單未回應即自動過期的天數 |
| `MAX_PRICE` | 100000 | 菜單價格上限 |
| `MAX_GIFT_AMOUNT` | 2000 | 贈送點數單次上限(避免囤積) |
| `GIFT_COOLDOWN_DAYS` | 7 | 每人兩次贈送之間至少間隔的天數(滾動 7 天,即每人每週最多送一次) |
| `DEFAULT_CREDIT_LIMIT` | 0 | 新使用者預設信用額度 |
| `MAX_CREDIT_LIMIT` | 2000 | 信用額度上限(已決定);新使用者預設仍為 `DEFAULT_CREDIT_LIMIT` = 0 |
| `DEFAULT_TIMEZONE` | Asia/Taipei | 零用點數的日期邊界 |
| `INVITE_CODE_TTL_DAYS` | 7 | 邀請碼有效天數 |
| `AI_REVIEWS_PER_DAY` | 20 | 每人每天 AI 審查次數上限 |
| `SUPPORT_MESSAGES_PER_DAY` | 30 | 每人每天向「愛愛小幫手」提問的次數上限 |

## 4. 系統架構

```
手機 (PWA, Next.js 畫面)
   │  LINE 登入 (在 LINE 內以 LIFF 自動登入;一般瀏覽器用 LINE Login;皆經 Supabase Auth)
   ▼
Next.js (Vercel)
   ├─ 一般讀取、呼叫資料庫函式(使用者身分的 Supabase client)
   └─ app/api/proposals/*:呼叫 AI 審查,再用 service role 寫入審查結果
   ▼
Supabase
   ├─ Auth
   ├─ Postgres:資料表 + RLS + SECURITY DEFINER 函式
   └─ (MVP 不使用 pg_cron;時間相關處理採「讀取時補處理」,見 5.4)
```

### 兩種 Supabase client

- **使用者 client**:帶使用者 session,受 RLS 約束,呼叫一般函式。
- **admin client**(`src/lib/supabase/admin.ts`,僅伺服器端):使用 service role,
  **只**用來呼叫 `internal_*` 函式(AI 審查結果寫入)。呼叫前,route 必須先用 session 確認操作者身分。

## 5. 點數系統

### 5.1 餘額與可用額度

```
balance(u)   = Σ ledger.delta  WHERE user_id = u
reserved(u)  = Σ orders.price_snapshot  WHERE receiver_id = u AND status IN ('accepted','done_by_giver')
available(u) = balance(u) + credit_limit(u) − reserved(u)
```

- 接受訂單的條件(權威檢查):`available(receiver) ≥ price_snapshot`。
- 完成訂單時**不再檢查額度**(已在接受時預留),避免訂單卡死。
- 調低信用額度只影響之後的新接受,不追溯既有訂單。
- 贈送點數:`balance(sender) − reserved(sender) ≥ amount`,**不可使用信用額度**(暫定,見第 12 節);且**單次 `amount ≤ MAX_GIFT_AMOUNT`**,且送出者**最近 `GIFT_COOLDOWN_DAYS` 天內沒有送過**(違反時回 `GIFT_LIMIT`)。

### 5.2 帳本 (ledger)

每筆分錄:`user_id`、`delta`(非 0 整數)、`reason`、`group_id`(同一次移轉的配對鍵)。

| reason | 分錄 | group_id | 同 group 加總 |
| --- | --- | --- | --- |
| `initial` | 單筆 +INITIAL_GRANT | 新 uuid | 不要求為 0(系統發放) |
| `allowance` | 單筆 +DAILY_ALLOWANCE,`period_key`=日期 | 新 uuid | 不要求為 0 |
| `order` | 兩筆:接受者 −amount、提供者 +amount | = order.id | **必須為 0** |
| `gift` | 兩筆:贈送者 −amount、收禮者 +amount | 新 uuid | **必須為 0** |
| `adjustment` | 人工更正,需 note | 新 uuid | 視情況 |

訂單金額為 0(價格 0 或「這次免費」)時,**不寫任何 ledger**,歷史由 `orders` 表呈現。

### 5.3 零用點數

- 配對完成(第二位成員加入)時,記錄 `couples.paired_at`,並為雙方各寫一筆 `initial`。
- 之後每個「當地日期」(依 `couples.timezone`)每人一筆 `allowance`,`period_key` = `YYYY-MM-DD`。
- 起算日:`paired_at` 當地日期的**隔天**起。
- 補發上限:最近 `ALLOWANCE_CATCH_UP_DAYS` 天內尚未發的日期。
- 冪等:`(user_id, period_key)` 唯一索引保證同一天不會重複發。

### 5.4 讀取時補處理(`touch_couple`)

MVP 不使用排程。使用者開啟 App、重新整理首頁或訂單頁時,先呼叫 `touch_couple()`,它會:

1. 補發零用點數。
2. 找出 `status = 'done_by_giver'` 且 `auto_confirm_at <= now()` 的訂單,依確認流程自動完成。
3. 找出 `status = 'requested'` 且 `expires_at <= now()` 的訂單,標為 `expired`(不影響任何點數)。

這兩件事都必須冪等。若之後需要,再加 pg_cron 呼叫同一個函式。

## 6. 訂單狀態機

```
requested ─ 回應者婉拒 ──────────▶ declined
requested ─ 發起者取消 ──────────▶ cancelled
requested ─ 回應者接受 ──────────▶ accepted         (權威額度檢查;接受者的點數開始預留)
requested ─ 3 天未回應(系統)────▶ expired          (expires_at = 建立時間 + 3 天;不影響點數)
accepted  ─ 任一方取消 ──────────▶ cancelled
accepted  ─ 提供者「做完了」─────▶ done_by_giver     (設定 auto_confirm_at = now + 24h)
done_by_giver ─ 接受者確認 / 24 小時自動 ─▶ completed   (settled_amount = price_snapshot;> 0 則寫 2 筆 ledger)
accepted 或 done_by_giver ─ 提供者「這次免費」─▶ completed  (settled_amount = 0;不寫 ledger)
```

終態:`declined`、`cancelled`、`expired`、`completed`。

`requested` 訂單一旦逾期(`now() >= expires_at`),即使 `touch_couple` 尚未執行,接受、婉拒、取消也都視為 `INVALID_STATE`;下次 `touch_couple` 會把它標為 `expired`。

### 角色與權限

| 動作 | 誰能做 | 允許的來源狀態 |
| --- | --- | --- |
| 建立訂單 | 該情侶任一成員 | (新建 → requested) |
| 接受 / 婉拒 | 回應者 | requested |
| 取消 | 發起者(requested)、任一方(accepted) | requested, accepted |
| 做完了 | 提供者 | accepted |
| 確認 | 接受者 | done_by_giver |
| 這次免費 | 提供者 | accepted, done_by_giver |
| 自動確認 | 系統(touch_couple) | done_by_giver 且逾時 |
| 自動過期 | 系統(touch_couple) | requested 且逾時 |

### 建立訂單

- 項目必須是 `active`,且屬於該情侶。
- 提供者永遠是項目擁有者(`menu_items.owner_id`);接受者是另一位成員。
- 呼叫者是接受者 → 「點單」(initiated_by = 接受者);呼叫者是提供者 → 「主動邀請」(initiated_by = 提供者)。
- 價格、名稱、圖示在建立時快照,之後不變。
- **接受者發起**:建立時就檢查 `available ≥ price`,不足直接拒絕(存夠了再點)。
  **提供者發起**:建立時不檢查(提供者不應得知對方餘額),由接受者接受時檢查。

### 冪等與併發

- 狀態轉換一律用「條件式 UPDATE」:`UPDATE orders SET status = ... WHERE id = $1 AND status = <來源狀態> RETURNING ...`。
  沒更新到列 → 若訂單已在目標狀態,視為成功的無操作;否則回傳 `INVALID_STATE`。
- 接受與完成時,先 `SELECT ... FOR UPDATE` 鎖住訂單列,再鎖接受者的 profile 列,
  在鎖內計算 `available`。鎖定順序固定(orders → profiles,多個 profile 依 id 排序),避免死結。
- DB 層最後防線:`ledger` 對 `(order_id, user_id)`(reason = 'order')有 partial unique index。

## 7. 資料模型

以下為設計目標。T2 實作 migration 時可微調型別與命名,但**不得放寬約束**。需要放寬先討論。

```sql
-- enum
order_status:   requested | accepted | done_by_giver | completed | declined | cancelled | expired
ledger_reason:  initial | allowance | order | gift | adjustment
proposal_status:      pending | countered | agreed | rejected | withdrawn
limit_request_status: pending | approved | declined | withdrawn
ai_verdict:     ok | caution | unavailable

couples (
  id uuid pk,
  invite_code text unique not null,
  invite_expires_at timestamptz not null,
  timezone text not null default 'Asia/Taipei',
  daily_allowance int not null default 500 check (daily_allowance >= 0),
  initial_grant   int not null default 2000 check (initial_grant >= 0),
  paired_at timestamptz,                      -- 第二位成員加入時設定
  created_at timestamptz not null default now()
)

profiles (
  id uuid pk references auth.users,
  couple_id uuid references couples,          -- 配對前為 null
  nickname text not null check (char_length(nickname) between 1 and 20),
  credit_limit int not null default 0 check (credit_limit >= 0),
  created_at timestamptz not null default now(),
  unique (id, couple_id)                      -- 供複合 FK 使用
)
-- 一個 couple 最多 2 位成員(由 join_couple 函式在鎖內保證)

menu_items (
  id uuid pk,
  couple_id uuid not null,
  owner_id uuid not null,
  title text not null check (char_length(title) between 1 and 40),
  emoji text,
  price int not null check (price between 0 and 100000),
  active boolean not null default true,       -- 軟刪除,不提供 DELETE
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, couple_id) references profiles (id, couple_id),
  unique (id, owner_id, couple_id)
)

orders (
  id uuid pk,
  couple_id uuid not null,
  menu_item_id uuid not null,
  giver_id uuid not null,
  receiver_id uuid not null,
  initiated_by uuid not null,
  price_snapshot int not null check (price_snapshot >= 0),
  title_snapshot text not null,
  emoji_snapshot text,
  status order_status not null default 'requested',
  settled_amount int,                         -- 完成時才有值;免費為 0
  note text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  done_at timestamptz,
  auto_confirm_at timestamptz,
  expires_at timestamptz,                     -- requested 的過期時間(建立時設定)
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (giver_id <> receiver_id),
  check (initiated_by in (giver_id, receiver_id)),
  check ((status = 'completed') = (settled_amount is not null)),
  check (settled_amount is null or settled_amount between 0 and price_snapshot),
  foreign key (menu_item_id, giver_id, couple_id) references menu_items (id, owner_id, couple_id),
  foreign key (receiver_id, couple_id) references profiles (id, couple_id)
)

ledger (
  id uuid pk,
  couple_id uuid not null,
  user_id uuid not null,
  delta int not null check (delta <> 0),
  reason ledger_reason not null,
  group_id uuid not null,
  order_id uuid references orders,
  period_key text,                            -- allowance 用,YYYY-MM-DD
  note text,
  created_at timestamptz not null default now(),
  foreign key (user_id, couple_id) references profiles (id, couple_id),
  check (reason <> 'order' or order_id is not null)
)
-- unique (order_id, user_id) where reason = 'order'
-- unique (user_id, period_key) where reason = 'allowance'
-- unique (user_id) where reason = 'initial'
-- index (user_id, created_at)
-- trigger:禁止任何 UPDATE / DELETE(含 service role)

limit_requests (
  id uuid pk, couple_id uuid not null,
  requester_id uuid not null, requested_limit int not null check (requested_limit >= 0),
  reason text, status limit_request_status not null default 'pending',
  decided_by uuid, decided_at timestamptz, created_at timestamptz not null default now()
)
-- unique (requester_id) where status = 'pending'
-- 核准者必須是另一位成員;pending 與 withdrawn 沒有決定者

service_proposals (
  id uuid pk, couple_id uuid not null,
  proposer_id uuid not null,                  -- 提案人
  owner_id uuid not null,                     -- 項目將加入誰的菜單(對方)
  title text not null, emoji text, price int not null check (price between 0 and 100000),
  status proposal_status not null default 'pending',
  counter_price int check (counter_price between 0 and 100000),   -- 還價(只能一次)
  ai_verdict ai_verdict, ai_comment text, ai_reviewed_at timestamptz,
  counter_ai_verdict ai_verdict, counter_ai_comment text,
  menu_item_id uuid,                          -- agreed 後建立的菜單項目
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposer_id <> owner_id)
)

ai_usage (                                    -- 只記次數,不記內容;只能新增,不開放 client 讀寫
  id uuid pk, user_id uuid not null references profiles,
  kind text not null check (kind in ('proposal_review','support')),
  created_at timestamptz not null default now()
)

-- view:balances(user_id, balance)、reserved(user_id, reserved)
```

## 8. 資料庫函式(唯一的寫入入口)

全部 `SECURITY DEFINER`、`SET search_path = ''`,用 `auth.uid()` 取得操作者。
`internal_*` 只授權給 service role,撤銷 anon / authenticated 的執行權。

| 函式 | 說明 |
| --- | --- |
| `create_couple(nickname)` | 建立情侶與邀請碼,建立自己的 profile |
| `join_couple(code, nickname)` | 鎖 couple 列,檢查邀請碼有效且成員未滿 2 人;加入後設 `paired_at`,雙方各寫 `initial` |
| `touch_couple()` | 補發零用點數、自動確認逾時訂單、過期未回應的邀請(冪等) |
| `create_order(menu_item_id, note)` | 見第 6 節「建立訂單」 |
| `respond_order(order_id, accept bool)` | 回應者接受或婉拒;接受時做權威額度檢查 |
| `cancel_order(order_id)` | 取消 |
| `mark_done(order_id)` | 提供者按「做完了」 |
| `confirm_order(order_id)` | 接受者確認並轉點(冪等) |
| `waive_order(order_id)` | 提供者「這次免費」 |
| `send_gift(amount, note)` | 贈送點數給對方,兩筆分錄 |
| `set_credit_limit(limit)` | **對方**直接設定我的額度(只能設定別人的) |
| `request_limit(requested_limit, reason)` / `decide_limit_request(id, approve)` / `withdraw_limit_request(id)` | 額度申請、核准或婉拒(核准者為另一方)、申請人撤回待處理的申請 |
| `respond_proposal(id, action)` | 提案的對方:agree / reject(還價走伺服器 route,先做價格審查) |
| `decide_counter(id, accept bool)` | 提案人對還價:接受或婉拒 |
| `withdraw_proposal(id)` | 提案人撤回 |
| `internal_create_proposal(actor, ..., ai 結果)` | 僅 service role:建立提案並寫入 AI 審查結果 |
| `internal_set_counter_review(id, actor, counter_price, ai 結果)` | 僅 service role:還價(只能一次)並寫入價格審查結果 |
| `internal_reserve_ai_call(actor, kind)` | 僅 service role:預約一次 AI 呼叫並記次數,超過每日上限回 `AI_LIMIT`(kind = proposal_review / support) |

### 錯誤代碼(RAISE EXCEPTION 的 message)

`NOT_PAIRED`、`INVITE_INVALID`、`COUPLE_FULL`、`INVALID_STATE`、`NOT_ALLOWED`、
`ITEM_INACTIVE`、`INSUFFICIENT_CREDIT`、`INSUFFICIENT_BALANCE`、`INVALID_AMOUNT`、
`ALREADY_PENDING`、`LIMIT_TOO_HIGH`、`AI_LIMIT`、`GIFT_LIMIT`(贈送超過單次上限或本週已送過)。UI 依代碼顯示溫暖文案(見 CLAUDE.md 用語表)。

## 9. RLS 與權限

| 表 | SELECT | 寫入 |
| --- | --- | --- |
| couples | 成員 | 無(僅函式) |
| profiles | 同情侶成員 | 僅 `nickname` 可由本人 UPDATE(欄位層級授權);`credit_limit` 只能經函式 |
| menu_items | 擁有者讀全部;對方只讀 `active = true` 的項目 | 擁有者可 INSERT / UPDATE 自己的項目(`owner_id = auth.uid()`);不提供 DELETE |
| orders | 同情侶成員 | 無(僅函式) |
| ledger | **只有本人的列**(`user_id = auth.uid()`) | 無;並有 trigger 禁止 UPDATE / DELETE |
| limit_requests | 同情侶成員 | 無(僅函式) |
| service_proposals | 同情侶成員 | 無(僅函式) |

預設隱私:每個人的餘額與帳本只有自己看得到。對方看得到的只有訂單(含價格與狀態)與 `credit_limit`
(因為額度本來就由對方控制)。

## 10. 畫面與路由(手機優先)

| 路由 | 內容 |
| --- | --- |
| `/login` | LINE 登入 |
| `/pair` | 建立情侶 / 輸入邀請碼 |
| `/` 首頁 | 我的愛心餘額與可用額度、待我回應的訂單、進行中訂單、最接近達成的 3 個願望 |
| `/menu` | 我的愛的菜單(新增、編輯、停用、套用範本) |
| `/partner` | 對方的菜單:瀏覽、點單;價格高於我餘額的項目顯示願望進度條 |
| `/orders`、`/orders/[id]` | 訂單列表與詳情,依狀態顯示對應按鈕 |
| `/ledger` | 我的帳本流水 |
| `/proposals` | 新增服務提案、提案列表、AI 意見、還價 |
| `/settings` | 暱稱、額度申請與核准、贈送點數 |

願望進度條:`progress = clamp(balance / price, 0, 1)`,餘額為負時顯示 0。僅為畫面計算,不新增資料表。
(「最接近達成的 3 個」排序方式為暫定,T6 實作時與使用者確認畫面。)

預設範本(`src/lib/menu/templates.ts`):親親 💋 100、抱抱 🤗 200、按摩 💆 600、開車接送 🚗 400。使用者可自行調整價格(可為 0)。

## 11. 服務提案與 AI 審查

目的:想在**對方的菜單**加項目(例如「出機加酒帶我去日本玩」),需要對方同意。
自己菜單的項目不需要提案,也**不送 AI**。

### 流程

```
提案人建立 ──▶ (伺服器呼叫 AI 審查內容+價格) ──▶ pending
pending   ─ 對方同意 ──▶ agreed   (建立對方的 menu_item,價格 = 提案價)
pending   ─ 對方婉拒 ──▶ rejected
pending   ─ 對方還價(一次) ──▶ countered   (伺服器重新審查價格)
countered ─ 提案人接受 ──▶ agreed   (價格 = counter_price)
countered ─ 提案人婉拒 ──▶ rejected
pending / countered ─ 提案人撤回 ──▶ withdrawn
```

- 還價只能一次。再想改價就婉拒後重新提案。
- AI 只給意見(`ok` / `caution`),**不能否決**,最終由雙方同意。
- AI 失敗或逾時:`ai_verdict = 'unavailable'`,畫面顯示「AI 暫時無法審查」,流程照常進行。

### 實作要點

- `POST /api/proposals`:驗證 session → zod 驗證輸入 → 檢查每日審查次數上限 → 呼叫 AI → 以 admin client 呼叫 `internal_create_proposal`。
- 還價同理:`POST /api/proposals/[id]/counter` → 重新審查價格 → `internal_set_counter_review`。
- 送給 AI 的內容**只有**:名稱、圖示、價格,以及經濟參數(`DAILY_ALLOWANCE`、`INITIAL_GRANT`)作為價格參考。
  不送使用者暱稱、id、現有菜單或任何其他資料。
- AI 回傳要求結構化 JSON:`{ verdict: "ok" | "caution", content_comment, price_comment }`,用 zod 驗證;驗證失敗視為 `unavailable`。
- 模型名稱讀取環境變數 `AI_MODEL`。

## 12. 尚未決定(之後討論,不要自行決定)

1. 信用額度:~~預設值、上限~~(已決定:預設 0、上限 2000)、用量提醒、其他額度玩法。
2. 贈送點數是否允許使用信用額度(目前暫定:不可)。
3. 帳本與餘額對方是否可見(目前預設:不可見)。
4. 零用點數補發天數上限(目前暫定:7 天)。
5. 願望進度條在首頁的排序方式。
6. 解除配對與資料處理。
7. 邀請碼的嘗試次數限制細節。
