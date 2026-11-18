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

## [x] T3a 點數純邏輯(TypeScript)

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

## [~] T3b 資料庫函式與整合測試

**檔案**
1. `migrations/0004_functions_core.sql`:`create_order`、`respond_order`、`cancel_order`、`mark_done`、`confirm_order`、`waive_order`。
2. `migrations/0005_functions_points.sql`:`touch_couple`、`send_gift`。
3. `supabase/tests/functions.test.sql`(pgTAP)與 `src/lib/points/db.integration.test.ts`(對本機 Supabase)。

**與 T3a 需一致的規則**(資料庫函式照此實作,並以測試鎖定):
- 價格 0 的訂單接受時不檢查額度(`canAfford` 價格 0 一律為真)。
- 檢查順序:先權限(`NOT_ALLOWED`),再狀態(`INVALID_STATE`);已在目標狀態且有權限 → 無副作用的成功。
- 自動確認:`now() >= auto_confirm_at` 才成立,否則 `INVALID_STATE`。
- 零用點數:起算日為 `paired_at` 當地隔天,只補到當地今天,最近 `ALLOWANCE_CATCH_UP_DAYS` 天內未發者。

**進度備註**:migration 0004、0005,pgTAP(`functions.test.sql`,149 項)與同時執行測試(`db.integration.test.ts`,5 項,以 psql 握住鎖模擬同時連線)都已完成並通過;另有 `config-sync.test.ts` 確保 SQL 常數與 `config.ts` 一致。與 T2 相同,是用本機 PostgreSQL + 模擬層驗證(`pnpm db:test:local`)。**待辦**:在有 Docker 的機器上跑 `pnpm db:reset && pnpm db:test`,再以 `LOVEBANK_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:integration` 跑同時執行測試,確認後改為 `[x]`。

**驗收(必須)**
- 同一筆訂單**連續兩次或同時兩次** `confirm_order`:ledger 只有 2 筆,第二次為無副作用的成功。
- 兩筆訂單合計超過可用額度,同時被接受:恰好一筆成功、一筆 `INSUFFICIENT_CREDIT`。
- 非權限方呼叫任何轉換:`NOT_ALLOWED`;非法來源狀態:`INVALID_STATE`。
- 免費訂單不寫 ledger,`settled_amount = 0`。
- `touch_couple` 連呼叫兩次,零用點數與自動確認只發生一次。
- 自動確認於 `auto_confirm_at` 之後才發生。
- 邀請(`requested`)逾 3 天未回應:`touch_couple` 標為 `expired`,不影響點數;逾期後接受、婉拒、取消皆為 `INVALID_STATE`。
- 所有 `order` / `gift` group 的 ledger 加總為 0。

---

## [x] T4 LINE 登入與配對

**內容**
- LINE Login 設定(LINE Developers channel、redirect URL;LINE 不一定回傳 email,帳號不得只靠 email 辨識)。先確認 Supabase 自訂 OIDC 提供者可用;不可用時列出替代方案與取捨,不自行決定。使用整頁導向流程,不用 popup(iOS 主畫面 PWA 相容)。
- `create_couple`、`join_couple`(migration `0006`)與 pgTAP:成員上限 2 人、邀請碼過期、重複加入、並發加入。
- 畫面:`/login`、`/pair`。配對完成發放 `initial`。
- Playwright 流程:登入 → 建立 → 另一帳號加入(用測試帳號或 mock auth)。

**進度備註**:資料庫(`0006_pairing.sql`,pgTAP 43 項、同時加入並發測試)、`/login`、`/auth/callback`、`/pair`、首頁簡易版、`proxy.ts` 登入保護已完成。Playwright 6 項(登入保護、真的跳到 LINE 登入頁、錯誤訊息、`next` 參數防外跳)通過;雲端環境以 `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e` 執行。LINE 登入設定已用 Supabase 實際驗證會導向 LINE。**登入方式變更(經使用者決定)**:一般瀏覽器的 LINE Login 需輸入 LINE 帳號密碼,體驗不佳,改以 LIFF 為主:在 LINE 內打開 `https://liff.line.me/<LIFF_ID>` 自動登入(`src/lib/auth/liff-login.ts`、`LoginPanel`),一般瀏覽器保留「用 LINE 登入」按鈕。已確認 Supabase 的 `custom:line` 會對 ID token 做驗證;真實 ID token 待手機實測。新增套件 `@line/liff`、環境變數 `NEXT_PUBLIC_LIFF_ID`(Vercel 也要設)。**配對死結修正(經使用者要求)**:兩人各自按「建立」會各成一對且無法離開。`0007_join_switch.sql` 讓 `join_couple` 可放棄「單人且尚未配對」的自己的一對(已配對者仍 `INVALID_STATE`;失敗整筆回復;兩個 couple 依 id 排序加鎖避免互相加入時死結),`/pair` 在等待對方時仍顯示「我有對方的邀請碼」。pgTAP 61 項、並發測試(含兩人同時互相加入)通過。**實測結果**:已在真實 Supabase 套用 migration(0001–0007),用兩支手機經 LIFF 登入、配對成功,顯示 2000 愛心;匿名使用者讀不到任何資料表、呼叫不了任何函式(以公開金鑰實測)。~~待辦~~:(1) 在 Supabase 專案套用 migration(含 0007)(SQL Editor 執行合併檔);(2) Supabase Redirect URLs 加入網站網址;(3) 兩個真實 LINE 帳號完成「登入 → 建立 → 加入 → 各 2000 愛心」實測(完整雙帳號流程無法自動化,需 LINE 登入),通過後改為 `[x]`。

**驗收**:兩個帳號能配成一對;第三人加入失敗;雙方各有 2000 愛心。

---

## [~] T5 我的愛心菜單與範本

- `/menu`:新增、編輯、停用、價格 0 到 100000、emoji。
- `src/lib/menu/templates.ts`:親親 💋 100、抱抱 🤗 200、按摩 💆 600、開車接送 🚗 400,一鍵套用。
- 對方只讀得到 `active` 的項目(RLS,見 `0008_menu_visibility.sql`)。
- 以 RLS 直接寫入;pgTAP 驗證只能改自己的項目。

**驗收**:菜單 CRUD 可用;對方看不到我的停用項目;改價不影響既有訂單(T7 後再驗)。

**進度備註**:`0008_menu_visibility.sql`、`menu.test.sql`(pgTAP 26 項,含對方看不到停用項目、不能改我的菜單、沒有 DELETE)、`/menu` 頁(新增、修改、暫停與恢復、範本一鍵加入)、`templates.ts`、zod 驗證與測試已完成,`/menu` 已納入登入保護測試。**待辦**:在 Supabase 執行 0008,並用手機實測畫面後改為 `[x]`。

---

## [x] T6 瀏覽對方菜單與建立訂單

- `/partner`:瀏覽對方菜單,點單(接受者發起)。
- 主動邀請(提供者發起):從自己的菜單建立邀請。
- 額度不足時顯示溫暖訊息;價格高於餘額的項目顯示願望進度條。
- 首頁的「最接近達成的 3 個願望」(排序與使用者確認)。

**驗收**:兩種發起方式都能建立 `requested` 訂單,價格為快照;接受者發起時額度不足被擋下,提供者發起時不檢查。

**進度備註**:`/partner`(對方的菜單、「我想要」、「我想為你做」、願望進度條)、首頁「最接近實現的願望」(依還差愛心由少到多取 3 個,`closestWishes`,9 項測試)、`create_order` 的 UI 已完成;資料庫規則已由 T3b 的 pgTAP 與並發測試涵蓋。訂單列表在 T7 才有,目前只能看到「已送出」提示。**實測**:兩支手機實測通過。

---

## [~] T7 訂單流程介面

- `/orders`、`/orders/[id]`:依角色與狀態顯示按鈕(接受/婉拒/取消/做完了/確認/這次免費)。
- 進入頁面先呼叫 `touch_couple()`。
- 重複點擊防呆(按鈕 loading、冪等)。
- Playwright:點單 → 接受 → 做完了 → 確認,雙方餘額正確;主動邀請與婉拒流程。

**驗收**:完整流程餘額正確且只轉點一次;婉拒與取消不影響點數。

**進度備註**:`/orders`(等我回應 / 進行中 / 已結束)、`/orders/[id]`(依角色與狀態的按鈕:接受、婉拒、取消、做完了、確認、這次免費)、首頁「等我回應」提醒、進頁面先 `touch_couple`、按鈕按下轉圈並禁用(資料庫保證冪等)、畫面開著每 10 到 15 秒自動更新已完成;按鈕規則 `availableOrderActions`(與 `canTransition` 同源)與文字標籤各有完整測試(共 20 項新增)。資料庫行為沿用 T3b 的 pgTAP 與並發測試。**待辦**:兩支手機實測完整流程(點單 → 接受 → 做完了 → 確認,雙方餘額正確;主動邀請與婉拒),通過後改為 `[x]`。Playwright 的雙人流程需要真實 LINE 登入,無法自動化。

---

## [~] T8 贈送點數

- `/settings` 的贈送功能,呼叫 `send_gift`;不可超過 `balance − reserved`,**且單次不可超過 `MAX_GIFT_AMOUNT`(2000),且最近 `GIFT_COOLDOWN_DAYS`(7)天內沒送過**,違反回 `GIFT_LIMIT`(資料庫函式與 `_cfg` 同步,需新 migration;錯誤代碼要加進 `ErrorCode` 與溫暖文案)。

**驗收**:兩筆分錄加總為 0;超額被擋;金額必須為正整數。

**進度備註**:`0009_gift_limits.sql`(單次 2000、每人 7 天一次、`GIFT_LIMIT`)、`gift.test.sql`(pgTAP,含 6 天 23 小時與 7 天 1 分鐘的冷卻邊界、不可用信用額度)、同一人同時送兩次的並發測試、`/settings` 贈送畫面(顯示可送上限與下次可送時間)、`giftSchema` 與冷卻時間純函式都已完成。**待辦**:在 Supabase 執行 0009,兩支手機實測後改為 `[x]`。

---

## [~] T9 零用點數整合

- 各頁進入時的 `touch_couple` 補發;首頁顯示今日已領取。
- Playwright / 整合測試:模擬跨多日(用可注入的時間)驗證補發天數與上限。

**驗收**:隔日首次開啟補發 500;超過 7 天未開只補最近 7 天;重複開啟不重複發。

**進度備註**:各頁進入時的 `touch_couple`(首頁、小心願、設定)與首頁「今天的零用愛心已入帳」已完成;補發天數、上限、冪等、同時呼叫的行為由 T3b 的 pgTAP(可注入時間的 `_touch_couple_at`)與並發測試涵蓋。**待辦**:手機實測隔日開啟會補發。

---

## [~] T10 信用額度申請與核准

- `/settings`:提出額度申請、對方核准或婉拒、對方直接設定額度。
- 規則:自己不能調自己的額度;每人同時只有一筆待處理申請。
- 上限 `MAX_CREDIT_LIMIT` = 2000、預設 0(已決定);額度用量提醒先不做(見 SPEC 第 12 節)。

**驗收**:核准後 `credit_limit` 更新且可用額度立即反映;自己呼叫 `set_credit_limit` 對自己失敗。

**進度備註**:`0010_credit_limit.sql`(`set_credit_limit`、`request_limit`、`decide_limit_request`;上限 2000、預設 0;核准者必須是另一方;重複核准或婉拒為無操作成功)、`credit_limit.test.sql`(pgTAP 48 項,含「函式只設定對方」「可用額度立即反映」「額度操作不寫 ledger、不動訂單」)、同一人同時申請的並發測試、`/settings` 的額度區塊(我的與他的額度、申請、核准與婉拒、直接調整他的額度)、首頁「他提出了額度申請」提醒已完成。**待辦**:在 Supabase 執行 0010,兩支手機實測後改為 `[x]`。**撤回申請(經使用者要求)**:`0011_withdraw_limit_request.sql` 新增 `withdrawn` 狀態與 `withdraw_limit_request`(只有申請人能撤回、重複撤回為無操作成功、已核准或婉拒的不能撤回),`credit_withdraw.test.sql`(pgTAP 27 項)與撤回和同意同時發生的並發測試已完成;`/settings` 的「撤回申請」按鈕。

---

## [~] T11 服務提案、AI 審查、還價

- 檔案:`migrations/0007_proposals.sql`、`src/lib/ai/review.ts`、`app/api/proposals/**`、`/proposals` 頁。
- AI:Anthropic API,僅伺服器端;zod 驗證回傳;失敗 → `unavailable`;每日次數上限。
- 流程見 SPEC 第 11 節:建立 → 審查 → 同意 / 婉拒 / 還價一次 → 成立後建立對方菜單項目。
- 測試:AI client 以 mock 測試(成功、格式錯誤、逾時);函式層測試狀態流程與權限。

**驗收**:同意與還價後菜單項目價格正確;還價第二次被拒;送給 AI 的 payload 只含名稱、圖示、價格與經濟參數。

**加入範圍(經使用者決定)**:**愛愛小幫手**(`/help`、`/api/support`、`src/lib/ai/support.ts`、`src/lib/support/knowledge.ts`):只回答愛愛銀行的玩法與規則,每人每天 30 則,只送對話內容。**AI 使用次數**以新資料表 `ai_usage`(只記誰、哪一種、何時,只能新增)計次,審查每人每天 20 次。

**進度備註**:
- 資料庫 `0012_proposals_and_ai_usage.sql`:`internal_reserve_ai_call`、`internal_create_proposal`、`internal_set_counter_review`(還價只能一次)、`respond_proposal`(同意/婉拒;還價走伺服器 route)、`decide_counter`、`withdraw_proposal`;成立時在擁有者菜單建立項目(價格 = 同意或還價後的價格)。pgTAP 82 項。
- 伺服器:`/api/proposals`、`/api/proposals/[id]/counter`、`/api/support`(先確認 session、再用 admin client 呼叫 internal 函式;請求必須是同源 JSON)。
- AI:以強制工具呼叫取得結構化輸出,zod 驗證,失敗一律 `unavailable`;已用真實 API 實測(含提示注入與離題)。
- 畫面:`/proposals`(提案、AI 意見、同意/婉拒/還價/撤回)、`/help`(聊天)、首頁入口與提醒。
- 測試:AI 模擬(成功、格式錯誤、逾時、HTTP 錯誤、沒金鑰)、payload 隱私、handler 邏輯、並發(同意與婉拒同時、25 個呼叫搶 20 次額度)、API 沒登入回 401。
- **正式環境實測**:愛愛小幫手已用手機實測通過(回答正確),代表三個環境變數與 0012 都已設定成功。
- **待辦(需要使用者)**:提案流程的兩支手機實測;~~(1) 在 Supabase 執行 0012~~;(2) 在 Vercel 設定環境變數 `ANTHROPIC_API_KEY`、`AI_MODEL`、`SUPABASE_SERVICE_ROLE_KEY`(皆**不可**加 `NEXT_PUBLIC_`);(3) 兩支手機實測。

---

## [~] T12 帳本頁與首頁

- `/ledger`:本人的流水(含訂單名稱快照、贈送、零用點數)。
- 首頁:餘額、可用額度、待回應、進行中、願望進度。

**驗收**:帳本與餘額一致;訂單名稱用快照,改菜單後不變。

**進度備註**:`/ledger`(本人的流水:配對禮、零用愛心、小心願、贈送、調整;每筆顯示「這筆之後剩多少」,由目前餘額倒推,所以與餘額必定一致;訂單名稱用建立當下的快照;只有本人看得到)、首頁顯示可用愛心 / 預留 / 額度與帳本入口已完成,`ledger-view.ts` 有 13 項測試。**首頁配對卡(經使用者要求)**:顯示雙方暱稱與 LINE 大頭貼、中間一顆愛心(`0013_avatar.sql`、`sync_my_avatar`、`Avatar` / `CouplePair`)。大頭貼只能從已驗證的登入憑證同步,且只接受 `https://profile.line-scdn.net/` 開頭的網址(使用者不能自己填);沒有圖片就顯示暱稱第一個字。pgTAP 28 項、元件測試 7 項。**待辦**:在 Supabase 執行 0013(與先前未執行的 0011),手機實測後改為 `[x]`。

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
