"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, activeTab, showNav } from "@/lib/nav";

/** 手機底部導覽列:黏在畫面底部,避開 iPhone 的底部橫條 */
export function BottomNav() {
  const pathname = usePathname();
  return showNav(pathname) ? <BottomNavView pathname={pathname} /> : null;
}

export function BottomNavView({ pathname }: { pathname: string }) {
  const current = activeTab(pathname);
  return (
    <nav
      aria-label="主要導覽"
      className="sticky bottom-0 z-10 mt-auto border-t border-primary-soft bg-white/90 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-sm items-stretch justify-between px-2">
        {NAV_ITEMS.map((item) => {
          const active = current === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`mx-0.5 flex flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[0.7rem] transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${
                  active ? "bg-primary-soft text-primary-strong" : "text-muted"
                }`}
              >
                <span aria-hidden className="text-xl leading-none">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
