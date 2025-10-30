"use client";

import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, FileText, Settings, User, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/components/language-provider";
import { useChatController } from "@/features/chat";

export function Sidebar() {
  const [mounted, setMounted] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<any>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { username, isAuthenticated } = useAuth();
  const { t } = useTranslations("sidebar");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get chat sessions and controller functions
  const {
    sessions,
    sessionsLoading,
    activeSession,
    handleSelectSession,
    handleDeleteSession,
    renameSession,
    startNewSession,
    deriveSessionName,
  } = useChatController();

  const navLinkClass = useCallback(
    (href: string) =>
      `flex items-center gap-2 p-2 rounded-md hover:bg-accent transition-colors ${
        pathname === href ? "bg-accent text-accent-foreground" : ""
      }`,
    [pathname]
  );

  const closeRenameDialog = () => {
    setRenameTarget(null);
    setRenameValue("");
  };

  const openRenameDialog = (session: any) => {
    setRenameTarget(session);
    setRenameValue(session.title ?? deriveSessionName(session));
  };

  const handleNewSession = () => {
    startNewSession();
    router.push("/");
    setIsMobileOpen(false);
  };

  const handleSessionClick = (session: any) => {
    handleSelectSession(session);
    router.push("/");
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile trigger */}
      {mounted ? (
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" aria-label="Open navigation menu" />
            </Button>
          </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex flex-col h-full">
            <div className="card-padding border-b flex justify-center">
              <Image
                src="/YouWorker.ai-logo.svg"
                alt="YouWorker.AI"
                width={150}
                height={40}
                className="h-8 w-auto"
                priority
              />
            </div>

            {/* New Session Button */}
            <div className="card-padding">
              <Button
                variant="secondary"
                className="w-full inline-sm rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={handleNewSession}
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </div>

            {/* Chat Sessions List */}
            <div className="flex-1 overflow-auto px-4 stack-sm">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Conversations
              </h3>
              {sessionsLoading ? (
                <>
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No sessions yet
                </p>
              ) : (
                sessions.slice(0, 10).map((session) => {
                  const isActive = activeSession?.id === session.id;
                  return (
                    <div
                      key={session.id}
                      className={`relative w-full rounded-xl border px-4 py-3 text-left transition-all duration-200 group overflow-hidden ${
                        isActive
                          ? "border-primary/60 bg-gradient-to-br from-primary/10 to-primary/5 shadow-md"
                          : "border-transparent bg-muted/30 hover:bg-muted/50 hover:border-border/50"
                      }`}
                    >
                      {/* Highlight indicator for active session */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                      )}

                      <div className="flex items-center justify-between gap-3">
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleSessionClick(session)}
                          role="button"
                          tabIndex={0}
                        >
                          <p className="text-sm font-medium truncate">
                            {deriveSessionName(session)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {new Date(session.updated_at).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>

                        {/* More options button */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background/50"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Session options"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openRenameDialog(session);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(session);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Navigation Links */}
            <nav className="card-padding stack-xs border-t" role="navigation" aria-label="Main navigation">
              <Link href="/documents" className={navLinkClass("/documents")} aria-current={pathname === "/documents" ? "page" : undefined}>
                <FileText className="h-4 w-4" />
                Documents
              </Link>
              <Link href="/settings" className={navLinkClass("/settings")} aria-current={pathname === "/settings" ? "page" : undefined}>
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </nav>

            {isAuthenticated && username && (
              <div className="card-padding border-t bg-gradient-to-br from-muted/30 to-background">
                <div className="flex items-center inline-sm p-3 rounded-xl bg-background/50 border border-border/50 hover:border-border transition-colors">
                  {/* Avatar with gradient border */}
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full gradient-accent blur-sm opacity-50" />
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full gradient-accent">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{username}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="relative">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <div className="absolute inset-0 h-2 w-2 rounded-full bg-green-500 animate-ping opacity-75" />
                      </div>
                      <span>Online</span>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => router.push('/settings')}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
        </Sheet>
      ) : (
        <Button variant="ghost" size="icon" className="md:hidden" disabled>
          <Menu className="h-6 w-6" aria-label="Open navigation menu" />
        </Button>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:block w-72 border-r bg-background">
        <div className="flex flex-col h-full">
          <div className="card-padding border-b flex justify-center">
            <Image
              src="/YouWorker.ai-logo.svg"
              alt="YouWorker.AI"
              width={150}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </div>

          {/* New Session Button */}
          <div className="card-padding">
            <Button
              variant="secondary"
              className="w-full inline-sm rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={handleNewSession}
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>

          {/* Chat Sessions List */}
          <div className="flex-1 overflow-auto px-4 pb-4 stack-sm">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Conversations
            </h3>
            {sessionsLoading ? (
              <>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No sessions yet
              </p>
            ) : (
              sessions.map((session) => {
                const isActive = activeSession?.id === session.id;
                return (
                  <div
                    key={session.id}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition group ${
                      isActive
                        ? "border-primary/60 bg-primary/10 shadow-sm"
                        : "border-transparent bg-background/60 hover:border-border/80 hover:bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleSessionClick(session)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSessionClick(session);
                          }
                        }}
                      >
                        <p className="text-sm font-medium truncate">
                          {deriveSessionName(session)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {new Date(session.updated_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Session options"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              openRenameDialog(session);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(session);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Navigation Links */}
          <nav className="card-padding stack-xs border-t" role="navigation" aria-label="Main navigation">
            <Link href="/documents" className={navLinkClass("/documents")} aria-current={pathname === "/documents" ? "page" : undefined}>
              <FileText className="h-4 w-4" />
              {t("links.documents")}
            </Link>
            <Link href="/settings" className={navLinkClass("/settings")} aria-current={pathname === "/settings" ? "page" : undefined}>
              <Settings className="h-4 w-4" />
              {t("links.settings")}
            </Link>
          </nav>

          {isAuthenticated && username && (
            <div className="card-padding border-t">
              <div className="flex items-center inline-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{username}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span>Connected</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rename Dialog */}
      {mounted && (
        <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => (!open ? closeRenameDialog() : undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename conversation</DialogTitle>
              <DialogDescription>
                Choose a concise title so you can recognize this session later.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Team sync notes"
              autoFocus
            />
            <DialogFooter>
              <Button variant="ghost" onClick={closeRenameDialog}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!renameTarget) return;
                  const trimmed = renameValue.trim();
                  if (!trimmed) return;
                  renameSession(renameTarget, trimmed);
                  closeRenameDialog();
                }}
                disabled={!renameValue.trim()}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {mounted && (
        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this session?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget ? deriveSessionName(deleteTarget) : ""} will be removed permanently. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTarget) {
                    handleDeleteSession(deleteTarget);
                  }
                  setDeleteTarget(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
