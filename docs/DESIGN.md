# 愛愛銀行 設計準則

本文件記錄視覺與動態效果的方向。規則與功能仍以 `docs/SPEC.md` 為準;這裡只管「長相與手感」。

## 視覺基調

- 名稱:愛愛銀行(內部識別碼仍為 lovebank)。
- 配色:淺藍與淺色系為主,色彩 token 見 `src/app/globals.css`。
- 字型:粗圓體(jf open 粉圓,見 `src/app/fonts/`),圓角偏大。
- 手機優先,語氣溫暖,用語依 CLAUDE.md 用語表。

## 用詞統一(畫面文字都照這個)

| 概念 | 用語 | 說明 |
| --- | --- | --- |
| 點數 | 愛心 | 送出愛心、收下愛心(不說付款、扣款) |
| 菜單上的一項 | **服務** | 「目前可以提供的服務」「先暫停這個服務」。不要叫「小心願」 |
| 一次的往來 | **邀請** | 「我們的邀請」「等我回應」。不要叫「訂單」 |
| 請對方提供服務 | 我想要 | 被服務的人送出愛心 |
| 主動提供服務 | 我想為你做 | 對方送出愛心 |
| 想在對方菜單加新服務 | 想要他提供的服務 | 服務提案,經對方同意 |
| 愛心不夠時先用 | **愛心貸款額度** | 可以「預先使用」(預支),之後賺到愛心再補回。申請標題:「想要預支我的愛心額度」;對方調整:「直接調整他可預支的額度」 |
| 把愛心給對方 | **轉讓愛心** | 不說「送愛心」(「送出愛心」只用在完成邀請時的付出) |
| 對方 | 他(或暱稱) | 不要用「TA」 |
| 不接受 | 婉拒 | 婉拒永遠沒有代價 |

## 動態效果參考清單(按鈕與互動設計時多加參考)

### 基本 12 種
1. 按下的手感:切換開關(toggle switch)、載入按鈕(loading button)、漣漪(ripple effect)
2. 等待的時候:進度條(progress bar)、輸入中提示(typing indicator)、轉圈載入(spinner)
3. 叫出、收起:底部面板(bottom sheet)、吐司通知(toast)、側邊選單(navigation drawer)
4. 用手指操作:輪播(carousel)、下拉更新(pull to refresh)、滑動操作(swipe actions)

### 專業感 12 種
5. 彈簧與獎勵:按讚彈跳(like animation)、彈簧動畫(spring animation)、彩紙特效(confetti)
6. 貼心的呈現方式:搖晃動畫(shake animation)、浮動標籤(floating label)、骨架畫面(skeleton screen)
7. 串連畫面:圓形展開轉場(circular reveal)、共用元素轉場(shared element)、交錯出場(stagger animation)
8. 抓住拖動:長按選單(context menu)、橡皮筋效果(rubber band effect)、拖曳排序(drag to reorder)

(原圖說明文字被播放列擋住,只記名稱與英文術語。)

## 建議對應(實作各任務時再與使用者確認,不是承諾)

| 場景 | 可用效果 |
| --- | --- |
| 按下接受、確認、做完了(T7) | loading button、ripple;同時達成「重複點擊防呆」 |
| 訂單完成、願望達成 | confetti、spring |
| 愛心還不夠(INSUFFICIENT_CREDIT) | shake,但文案必須溫暖,不可有責備感 |
| 願望進度條(T6、T12) | progress bar,帶緩動 |
| 列表載入(菜單、訂單、帳本) | skeleton screen、stagger |
| 操作結果回饋 | toast |
| 點單、贈送的確認 | bottom sheet |
| 訂單列表快捷操作(T7) | swipe actions(婉拒不得做成顯眼的負面操作) |
| 重新整理(呼叫 `touch_couple`,T9) | pull to refresh |
| 愛心數字變動 | spring、like animation |

## 約束

- 一律尊重 `prefers-reduced-motion`:使用者關閉動態時,改為淡入淡出或無動畫。
- 優先用 CSS / Tailwind 實作。需要動畫套件時,**先討論再新增**(CLAUDE.md:不新增套件)。
- 動畫不得擋住操作,也不得暗示「付了點數就必須答應」。
- 清單中與 SPEC 功能無關的項目(例如拖曳排序菜單、輪播)不自行新增功能,有需要先討論。
- 大規模套用留到 T13;T6、T7 做按鈕時可先採用基本款(loading button、ripple、toast)。
