"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Home, FileText, Clock, BarChart3, Settings, LogOut, User } from "lucide-react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";

export function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { username, logout, isAuthenticated } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      {/* Mobile trigger */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-6 w-6" />
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
            <nav className="flex-1 p-4 space-y-2">
              <Link href="/" className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
                <Home className="h-4 w-4" />
                Chat
              </Link>
              <Link href="/documents" className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
                <FileText className="h-4 w-4" />
                Documents
              </Link>
              <Link href="/sessions" className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
                <Clock className="h-4 w-4" />
                Sessions
              </Link>
              <Link href="/analytics" className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
              <Link href="/settings" className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
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
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/" className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
              <Home className="h-4 w-4" />
              Chat
            </Link>
            <Link href="/documents" className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
              <FileText className="h-4 w-4" />
              Documents
            </Link>
            <Link href="/sessions" className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
              <Clock className="h-4 w-4" />
              Sessions
            </Link>
            <Link href="/analytics" className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Link>
            <Link href="/settings" className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
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
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
