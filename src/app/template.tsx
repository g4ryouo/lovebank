/** 每次換頁都重新進場:內容輕輕往上浮出(尊重「減少動態效果」) */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="fade-up flex flex-1 flex-col">{children}</div>;
}
