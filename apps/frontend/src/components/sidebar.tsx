"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Home, FileText, Clock, BarChart3, Settings, LogOut, User } from "lucide-react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/components/language-provider";

export function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const { username, logout, isAuthenticated } = useAuth();
  const { t } = useTranslations("sidebar");

  const handleLogout = async () => {
    await logout();
  };

  const navLinkClass = useCallback(
    (href: string) =>
      `flex items-center gap-2 p-2 rounded-md hover:bg-accent transition-colors ${
        pathname === href ? "bg-accent text-accent-foreground" : ""
      }`,
    [pathname]
  );

  return (
    <>
      {/* Mobile trigger */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-6 w-6" aria-label="Open navigation menu" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">YouWorker.AI</h2>
                <ThemeToggle />
              </div>
              {isAuthenticated && username && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{username}</span>
                </div>
              )}
            </div>
            <nav className="flex-1 p-4 space-y-2" role="navigation" aria-label="Main navigation">
              <Link href="/" className={navLinkClass("/")} aria-current={pathname === "/" ? "page" : undefined}>
                <Home className="h-4 w-4" />
                Chat
              </Link>
              <Link href="/documents" className={navLinkClass("/documents")} aria-current={pathname === "/documents" ? "page" : undefined}>
                <FileText className="h-4 w-4" />
                Documents
              </Link>
              <Link href="/sessions" className={navLinkClass("/sessions")} aria-current={pathname === "/sessions" ? "page" : undefined}>
                <Clock className="h-4 w-4" />
                Sessions
              </Link>
              <Link href="/analytics" className={navLinkClass("/analytics")} aria-current={pathname === "/analytics" ? "page" : undefined}>
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
              <Link href="/settings" className={navLinkClass("/settings")} aria-current={pathname === "/settings" ? "page" : undefined}>
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </nav>
            {isAuthenticated && (
              <div className="p-4 border-t">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleLogout}
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden md:block w-64 border-r bg-background">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{t("title")}</h2>
              <ThemeToggle />
            </div>
            {isAuthenticated && username && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{username}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span>Connected</span>
                </div>
              </div>
            )}
          </div>
          <nav className="flex-1 p-4 space-y-2" role="navigation" aria-label="Main navigation">
              <Link href="/" className={navLinkClass("/")} aria-current={pathname === "/" ? "page" : undefined}>
                <Home className="h-4 w-4" />
                {t("links.chat")}
              </Link>
              <Link href="/documents" className={navLinkClass("/documents")} aria-current={pathname === "/documents" ? "page" : undefined}>
                <FileText className="h-4 w-4" />
                {t("links.documents")}
              </Link>
              <Link href="/sessions" className={navLinkClass("/sessions")} aria-current={pathname === "/sessions" ? "page" : undefined}>
                <Clock className="h-4 w-4" />
                {t("links.sessions")}
              </Link>
              <Link href="/analytics" className={navLinkClass("/analytics")} aria-current={pathname === "/analytics" ? "page" : undefined}>
                <BarChart3 className="h-4 w-4" />
                {t("links.analytics")}
              </Link>
              <Link href="/settings" className={navLinkClass("/settings")} aria-current={pathname === "/settings" ? "page" : undefined}>
                <Settings className="h-4 w-4" />
                {t("links.settings")}
              </Link>
          </nav>
          {isAuthenticated && (
            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleLogout}
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t("logout")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
