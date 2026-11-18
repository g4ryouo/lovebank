/** 載入中的骨架畫面:先把版型畫出來,資料到了再填入,畫面不會一片空白 */
function Bar({ className }: { className: string }) {
  return <div aria-hidden className={`skeleton rounded-2xl ${className}`} />;
}

export function PageSkeleton() {
  return (
    <main role="status" aria-label="載入中" className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-5 p-6">
      <Bar className="mx-auto h-9 w-2/3" />
      <Bar className="h-32 w-full rounded-3xl" />
      <Bar className="h-20 w-full rounded-3xl" />
      <Bar className="h-20 w-full rounded-3xl" />
      <Bar className="h-20 w-full rounded-3xl" />
    </main>
  );
}
