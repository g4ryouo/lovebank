/**
 * 大頭貼:圓形。圖片載入失敗或沒有圖片時,顯示暱稱的第一個字(圖片疊在文字上面,壞掉就自然露出文字)。
 * 網址只會是 LINE 官方圖片(資料庫已限制),並且不帶 referrer。
 */
export function Avatar({ url, name }: { url: string | null; name: string }) {
  const initial = Array.from(name.trim())[0] ?? "💙";
  return (
    <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-3xl text-primary-strong shadow-md ring-4 ring-white">
      <span aria-hidden>{initial}</span>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- LINE 官方圖片,不需要 Next 的圖片最佳化
        <img src={url} alt="" referrerPolicy="no-referrer" loading="eager" className="absolute inset-0 size-full object-cover" />
      )}
    </div>
  );
}

/** 一個人:大頭貼加名字 */
export function Person({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="flex w-24 flex-col items-center gap-2">
      <Avatar url={url} name={name} />
      <p className="w-full truncate text-center text-foreground">{name}</p>
    </div>
  );
}

/** 配對的兩人:左邊是我、右邊是對方,中間一顆會輕輕跳動的愛心(尊重「減少動態效果」) */
export function CouplePair({ me, partner }: { me: { name: string; url: string | null }; partner: { name: string; url: string | null } }) {
  return (
    <div className="flex items-start justify-center gap-1" aria-label={`${me.name} 與 ${partner.name}`}>
      <Person url={me.url} name={me.name} />
      <span aria-hidden className="mt-5 animate-pulse text-4xl motion-reduce:animate-none">
        💙
      </span>
      <Person url={partner.url} name={partner.name} />
    </div>
  );
}
