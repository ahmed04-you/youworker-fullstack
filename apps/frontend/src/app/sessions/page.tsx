"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, Trash2, Eye, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Session {
  id: number;
  external_id: string;
  created_at: string;
  message_count: number;
  last_activity: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function SessionsPage() {
  const { apiKey, isAuthenticated } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/settings");
      return;
    }
    fetchSessions();
  }, [isAuthenticated, router, limit, offset]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8001/v1/sessions?limit=${limit}&offset=${offset}`, {
        headers: {
          "X-API-Key": apiKey || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }

      const data = await response.json();
      setSessions(data.sessions);
      setTotal(data.total);
    } catch (error) {
      toast.error("Failed to load sessions: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionMessages = async (sessionId: string) => {
    setViewLoading(true);
    try {
      const response = await fetch(`http://localhost:8001/v1/sessions/${sessionId}/messages`, {
        headers: {
          "X-API-Key": apiKey || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const data = await response.json();
      setSessionMessages(data.messages);
    } catch (error) {
      toast.error("Failed to load messages: " + (error as Error).message);
    } finally {
      setViewLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    setDeleteLoading(true);
    try {
      const response = await fetch(`http://localhost:8001/v1/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          "X-API-Key": apiKey || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      const data = await response.json();
      toast.success(`Session deleted. Removed ${data.deleted_messages} messages.`);
      fetchSessions(); // Refresh list
      setSelectedSession(null);
      setSessionMessages([]);
    } catch (error) {
      toast.error("Failed to delete session: " + (error as Error).message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleViewSession = (session: Session) => {
    setSelectedSession(session);
    fetchSessionMessages(session.external_id);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading sessions...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Chat Sessions
          </CardTitle>
          <CardDescription>Manage your conversation sessions. View details or delete old ones.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No sessions found. Start a chat to create one.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.external_id}</TableCell>
                      <TableCell>{new Date(session.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{session.message_count}</TableCell>
                      <TableCell>{new Date(session.last_activity).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewSession(session)}
                            disabled={viewLoading}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteSession(session.external_id)}
                            disabled={deleteLoading}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} sessions
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Session Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Session: {selectedSession?.external_id}</DialogTitle>
            <DialogDescription>Messages from this session.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4 p-4">
            {viewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading messages...
              </div>
            ) : sessionMessages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No messages in this session.</p>
            ) : (
              sessionMessages.map((msg) => (
                <Card key={msg.id} className={`w-full ${msg.role === "user" ? "bg-primary/10 ml-auto max-w-lg" : "bg-secondary/10"}`}>
                  <CardContent className="p-4">
                    <div className={`text-sm space-y-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                      <p className="font-medium">{msg.role.toUpperCase()}</p>
                      <p>{msg.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(msg.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 p-4 border-t">
            <Button variant="outline" onClick={() => setSelectedSession(null)}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedSession) deleteSession(selectedSession.external_id);
              }}
              disabled={deleteLoading}
            >
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}