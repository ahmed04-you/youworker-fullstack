"use client";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Home, FileText, Clock, BarChart3, Settings } from "lucide-react";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import Link from "next/link";
import { useState } from "react";

export function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">YouWorker.AI</h2>
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
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden md:block w-64 border-r bg-background">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold">YouWorker.AI</h2>
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
        </div>
      </div>
    </>
  );
}