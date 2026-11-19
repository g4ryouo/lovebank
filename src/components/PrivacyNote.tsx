/**
 * 登入頁的個資說明。內容必須和實際保存的資料一致(見 docs/SPEC.md 資料模型):
 * 保存:LINE 提供的名稱與大頭貼、暱稱、愛心與邀請紀錄;
 * 不保存:小幫手的對話內容(只記今天問了幾次);不要求電話、地址。
 */
export function PrivacyNote() {
  return (
    <section aria-label="個資說明" className="rounded-2xl bg-white/70 p-4 text-center">
      <p className="text-sm text-foreground">
        愛愛銀行只用來記錄你們的愛心進度,不會要求你的電話、地址等個人資料,也沒有任何真實金流。請安心使用 💙
      </p>
      <details className="mt-2 text-left">
        <summary className="cursor-pointer text-center text-xs text-primary-strong underline">我們會保存哪些資料?</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs text-muted">
          <li>
            <span className="text-foreground">會保存:</span>LINE 提供的名稱與大頭貼、你取的暱稱、你們的愛心與邀請紀錄。
          </li>
          <li>
            <span className="text-foreground">不會保存:</span>你的電話、地址,以及和愛愛小幫手的對話內容(只會記今天問了幾次)。
          </li>
          <li>
            <span className="text-foreground">AI 的部分:</span>使用小幫手或提出服務提案時,你輸入的內容會送給 AI 產生回覆或意見,不會附上你的名字。
          </li>
        </ul>
      </details>
    </section>
  );
}
