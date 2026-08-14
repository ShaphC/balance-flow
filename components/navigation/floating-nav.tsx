"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  CircleDollarSign,
  Settings,
  WalletCards,
} from "lucide-react";

const navigation = [
  {
    label: "Cash Flow",
    href: "/cash-flow",
    icon: CircleDollarSign,
    enabled: true,
  },
  {
    label: "Debts",
    href: "#",
    icon: WalletCards,
    enabled: false,
  },
  {
    label: "Income",
    href: "#",
    icon: CircleDollarSign,
    enabled: false,
  },
  {
    label: "Calculator",
    href: "/calculator",
    icon: Calculator,
    enabled: true,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    enabled: true,
  },
];

export function FloatingNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-4 z-50 px-3">
      <div className="mx-auto flex max-w-xl items-center justify-center rounded-2xl border bg-background/95 p-2 shadow-lg backdrop-blur-md">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);

          if (!item.enabled) {
            return (
              <div
                key={item.label}
                className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-muted-foreground/40"
                title="Coming later"
              >
                <Icon className="size-5" />
                <span className="hidden text-[10px] sm:block">
                  {item.label}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={[
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
                "hover:bg-muted",
                active ? "bg-muted text-foreground" : "text-muted-foreground",
              ].join(" ")}
            >
              <Icon className="size-5" />

              <span className="hidden text-[10px] font-medium sm:block">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
