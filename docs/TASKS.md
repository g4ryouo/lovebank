# LoveBank TASKS

狀態:`[ ]` 未開始、`[~]` 進行中、`[x]` 完成。一次只做一個任務。
每個任務:先提計畫 → 使用者確認 → 實作 → `pnpm lint` / `typecheck` / `test`(動到資料庫再加 `db:test`)全綠 → 更新本檔。

## 順序與相依

```
T1 → T2 → T3a → T3b → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14
```

---

## [x] T1 專案初始化

**目標**:可執行的空專案,工具鏈齊全。

**步驟**
1. `git init`;用 pnpm 建立 Next.js(App Router、TypeScript、Tailwind、ESLint)。
2. `tsconfig.json`:`strict: true`、`noUncheckedIndexedAccess: true`。
3. 設定 Vitest(`vitest.config.ts`),放一個冒煙測試。
4. `package.json` scripts:`dev`、`lint`、`typecheck`、`test`。
5. 放入 `CLAUDE.md`、`docs/SPEC.md`、`docs/TASKS.md`、`.env.example`、`.gitignore`。
6. Playwright 只裝設定檔,不寫測試。
7. 建立 `src/lib/config.ts`(SPEC 第 3 節常數)與空的目錄結構。

**驗收**:`pnpm lint`、`typecheck`、`test` 全綠;`pnpm dev` 能開首頁;已 commit。

---

## [~] T2 資料庫遷移與 RLS

**前置**:本機 Docker。

**進度備註**:migration 0001–0003、pgTAP(96 項)與 `src/types/database.ts` 已完成。雲端環境無法拉 Supabase 映像,改用本機 PostgreSQL + pgTAP + `supabase/local/shim.sql`(模擬 auth / 角色)驗證,指令 `pnpm db:test:local`,全部通過。**待辦**:在有 Docker 的機器上跑 `pnpm db:start && pnpm db:reset && pnpm db:test`,確認後改為 `[x]`。

**檔案(依序)**
1. `supabase init` → `supabase/config.toml`;加入 `db:*` scripts。
2. `migrations/0001_core_tables.sql`:enum 與七張資料表(SPEC 第 7 節),含所有約束、複合 FK。
3. `migrations/0002_indexes_views.sql`:partial unique index、`balances`、`reserved` view、ledger 禁止 UPDATE/DELETE 的 trigger。
4. `migrations/0003_rls_policies.sql`:啟用所有表 RLS、policy、欄位層級授權、撤銷多餘權限。
5. `supabase/tests/rls.test.sql`(pgTAP)。
6. `pnpm db:types` → `src/types/database.ts`。

**驗收(pgTAP)**
- 使用者 A 看不到其他情侶的任何資料。
- 使用者不能 UPDATE 自己的 `credit_limit`。
- 使用者不能直接 INSERT / UPDATE `orders`、`ledger`。
- `ledger` 的 UPDATE / DELETE 一律失敗。
- `ledger` 只能讀到自己的列。
- 各項 check / unique 約束在違反時失敗(價格範圍、giver ≠ receiver、重複 allowance 等)。

---

## [ ] T3a 點數純邏輯(TypeScript)

**位置**:`src/lib/points/`,每個檔案配 `*.test.ts`。不依賴 React 與 Supabase。

**檔案**
1. `types.ts`:狀態、動作、角色型別。
2. `balance.ts`:`computeBalance(entries)`。
3. `credit.ts`:`availableCredit(balance, limit, reserved)`、`canAfford(...)`。
4. `order-state.ts`:狀態轉換表、`canTransition(state, action, actor, order)`。
5. `settle.ts`:`buildSettlementEntries(order)`;金額為 0 回傳空陣列;兩筆加總必為 0。
6. `allowance.ts`:`periodKeys(pairedAt, now, tz, maxDays)`,回傳待補發的日期。
7. `progress.ts`:`wishProgress(balance, price)`。

**用途與界線**:這些函式供 UI 預覽與共用型別。**權威檢查在資料庫函式(T3b)**,兩邊規則須一致。

**驗收**:涵蓋狀態轉換的每條合法與非法路徑、免費訂單、價格 0、餘額為負、跨日與時區邊界、補發上限。

---

## [ ] T3b 資料庫函式與整合測試

**檔案**
1. `migrations/0004_functions_core.sql`:`create_order`、`respond_order`、`cancel_order`、`mark_done`、`confirm_order`、`waive_order`。
2. `migrations/0005_functions_points.sql`:`touch_couple`、`send_gift`。
3. `supabase/tests/functions.test.sql`(pgTAP)與 `src/lib/points/db.integration.test.ts`(對本機 Supabase)。

**驗收(必須)**
- 同一筆訂單**連續兩次或同時兩次** `confirm_order`:ledger 只有 2 筆,第二次為無副作用的成功。
- 兩筆訂單合計超過可用額度,同時被接受:恰好一筆成功、一筆 `INSUFFICIENT_CREDIT`。
- 非權限方呼叫任何轉換:`NOT_ALLOWED`;非法來源狀態:`INVALID_STATE`。
- 免費訂單不寫 ledger,`settled_amount = 0`。
- `touch_couple` 連呼叫兩次,零用點數與自動確認只發生一次。
- 自動確認於 `auto_confirm_at` 之後才發生。
- 所有 `order` / `gift` group 的 ledger 加總為 0。

---

## [ ] T4 LINE 登入與配對

**內容**
- LINE Login 設定(LINE Developers channel、redirect URL;LINE 不一定回傳 email,帳號不得只靠 email 辨識)。先確認 Supabase 自訂 OIDC 提供者可用;不可用時列出替代方案與取捨,不自行決定。使用整頁導向流程,不用 popup(iOS 主畫面 PWA 相容)。
- `create_couple`、`join_couple`(migration `0006`)與 pgTAP:成員上限 2 人、邀請碼過期、重複加入、並發加入。
- 畫面:`/login`、`/pair`。配對完成發放 `initial`。
- Playwright 流程:登入 → 建立 → 另一帳號加入(用測試帳號或 mock auth)。

**驗收**:兩個帳號能配成一對;第三人加入失敗;雙方各有 2000 愛心。

---

## [ ] T5 我的愛心菜單與範本

- `/menu`:新增、編輯、停用、價格 0 到 100000、emoji。
- `src/lib/menu/templates.ts`:開車接送、親親、抱抱、按摩,一鍵套用。
- 以 RLS 直接寫入;pgTAP 驗證只能改自己的項目。

**驗收**:菜單 CRUD 可用;對方看不到我的停用項目;改價不影響既有訂單(T7 後再驗)。

---

## [ ] T6 瀏覽對方菜單與建立訂單

- `/partner`:瀏覽對方菜單,點單(接受者發起)。
- 主動邀請(提供者發起):從自己的菜單建立邀請。
- 額度不足時顯示溫暖訊息;價格高於餘額的項目顯示願望進度條。
- 首頁的「最接近達成的 3 個願望」(排序與使用者確認)。

**驗收**:兩種發起方式都能建立 `requested` 訂單,價格為快照;接受者發起時額度不足被擋下,提供者發起時不檢查。

---

## [ ] T7 訂單流程介面

- `/orders`、`/orders/[id]`:依角色與狀態顯示按鈕(接受/婉拒/取消/做完了/確認/這次免費)。
- 進入頁面先呼叫 `touch_couple()`。
- 重複點擊防呆(按鈕 loading、冪等)。
- Playwright:點單 → 接受 → 做完了 → 確認,雙方餘額正確;主動邀請與婉拒流程。

**驗收**:完整流程餘額正確且只轉點一次;婉拒與取消不影響點數。

---

## [ ] T8 贈送點數

- `/settings` 的贈送功能,呼叫 `send_gift`;不可超過 `balance − reserved`。

**驗收**:兩筆分錄加總為 0;超額被擋;金額必須為正整數。

---

## [ ] T9 零用點數整合

- 各頁進入時的 `touch_couple` 補發;首頁顯示今日已領取。
- Playwright / 整合測試:模擬跨多日(用可注入的時間)驗證補發天數與上限。

**驗收**:隔日首次開啟補發 500;超過 7 天未開只補最近 7 天;重複開啟不重複發。

---

## [ ] T10 信用額度申請與核准

- `/settings`:提出額度申請、對方核准或婉拒、對方直接設定額度。
- 規則:自己不能調自己的額度;每人同時只有一筆待處理申請。
- 額度提醒與上限先不做(見 SPEC 第 12 節)。

**驗收**:核准後 `credit_limit` 更新且可用額度立即反映;自己呼叫 `set_credit_limit` 對自己失敗。

---

## [ ] T11 服務提案、AI 審查、還價

- 檔案:`migrations/0007_proposals.sql`、`src/lib/ai/review.ts`、`app/api/proposals/**`、`/proposals` 頁。
- AI:Anthropic API,僅伺服器端;zod 驗證回傳;失敗 → `unavailable`;每日次數上限。
- 流程見 SPEC 第 11 節:建立 → 審查 → 同意 / 婉拒 / 還價一次 → 成立後建立對方菜單項目。
- 測試:AI client 以 mock 測試(成功、格式錯誤、逾時);函式層測試狀態流程與權限。

**驗收**:同意與還價後菜單項目價格正確;還價第二次被拒;送給 AI 的 payload 只含名稱、圖示、價格與經濟參數。

---

## [ ] T12 帳本頁與首頁

- `/ledger`:本人的流水(含訂單名稱快照、贈送、零用點數)。
- 首頁:餘額、可用額度、待回應、進行中、願望進度。

**驗收**:帳本與餘額一致;訂單名稱用快照,改菜單後不變。

---

## [ ] T13 手機介面美化與 PWA

- 手機優先的版面、溫暖視覺、用語依 CLAUDE.md 用語表。
- Web App Manifest、圖示、standalone 模式、可加入主畫面。

**驗收**:iOS Safari 能加入主畫面並以全螢幕開啟;Lighthouse PWA 基本項目通過。

---

## [ ] T14 部署與實際使用測試

- Vercel 部署;環境變數;Supabase 正式專案與 migration;LINE Login 正式 redirect。
- 兩支真機實際使用一週,記錄手感問題。
- 檢查:service role 與 AI 金鑰未進入 client bundle。

**驗收**:兩人能在正式環境完成配對與一輪完整流程。
