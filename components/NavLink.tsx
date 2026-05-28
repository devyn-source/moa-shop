"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  muted = false
}: {
  href: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  const pathname = usePathname();

  const active =
    href === "/"
      ? pathname === "/" || pathname.startsWith("/p/") || pathname === "/cart" || pathname === "/checkout"
      : href === "/admin"
        ? pathname === "/admin"
        : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link href={href} className={`nav-link${active ? " nav-link--active" : ""}${muted ? " nav-link--muted" : ""}`}>
      {children}
    </Link>
  );
}
