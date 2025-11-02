"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  rotateApiKey,
  purgeHistory,
  exportAccountSnapshot,
  deleteAccount,
} from "../../lib/api/account";
import {
  listMyGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup as deleteGroupApi,
  addGroupMember,
  updateGroupMemberRole,
  removeGroupMember,
} from "../../lib/api/groups";
import type {
  ApiKeyRotateResponse,
  Group,
  GroupWithMembers,
  HistoryPurgeSummary,
} from "../../lib/types";
import { ApiClientError } from "../../lib/api/client";

type Feedback = { type: "success" | "error"; message: string } | null;

export default function Settings() {
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    csrfToken,
    refreshCsrfToken,
    logout,
    refreshUser,
  } = useAuth();

  const [feedback, setFeedback] = useState<Feedback>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [historySummary, setHistorySummary] = useState<HistoryPurgeSummary | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithMembers | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const [createGroupName, setCreateGroupName] = useState("");
  const [createGroupDescription, setCreateGroupDescription] = useState("");
  const [updateGroupName, setUpdateGroupName] = useState("");
  const [updateGroupDescription, setUpdateGroupDescription] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"member" | "admin">("member");

  useEffect(() => {
    return () => {
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
      }
    };
  }, [exportUrl]);

  useEffect(() => {
    if (selectedGroup) {
      setUpdateGroupName(selectedGroup.name);
      setUpdateGroupDescription(selectedGroup.description ?? "");
    }
  }, [selectedGroup]);

  const ensureCsrfToken = async (): Promise<string> => {
    if (csrfToken) {
      return csrfToken;
    }
    return refreshCsrfToken();
  };

  const selectGroup = useCallback(async (groupId: number) => {
    try {
      setGroupsLoading(true);
      const groupDetails = await getGroup(groupId);
      setSelectedGroupId(groupId);
      setSelectedGroup(groupDetails);
    } catch (err) {
      setGroupError(extractError(err));
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      setGroupError(null);
      const groupList = await listMyGroups();
      setGroups(groupList);
      if (groupList.length > 0) {
        const defaultGroupId = selectedGroupId ?? groupList[0].id;
        await selectGroup(defaultGroupId);
      } else {
        setSelectedGroupId(null);
        setSelectedGroup(null);
      }
    } catch (err) {
      setGroupError(extractError(err));
    } finally {
      setGroupsLoading(false);
    }
  }, [selectGroup, selectedGroupId]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void Promise.all([refreshUser(), loadGroups()]);
    }
  }, [authLoading, isAuthenticated, loadGroups, refreshUser]);

  const handleRotateApiKey = async () => {
    try {
      setApiLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();
      const response: ApiKeyRotateResponse = await rotateApiKey(token);
      setApiKey(response.api_key);
      setFeedback({ type: "success", message: "New API key generated. Store it securely." });
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setApiLoading(false);
    }
  };

  const handlePurgeHistory = async () => {
    if (!window.confirm("Delete all chat sessions and messages? This cannot be undone.")) {
      return;
    }

    try {
      setApiLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();
      const summary = await purgeHistory(token);
      setHistorySummary(summary);
      setFeedback({
        type: "success",
        message: `Deleted ${summary.sessions_deleted} session(s) and ${summary.messages_deleted} message(s).`,
      });
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setApiLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      setExporting(true);
      setFeedback(null);
      const blob = await exportAccountSnapshot();
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
      }
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
      setFeedback({ type: "success", message: "Export generated. Use the download link below." });
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "This will permanently delete your account and all associated data. Continue?"
      )
    ) {
      return;
    }

    try {
      setApiLoading(true);
      const token = await ensureCsrfToken();
      await deleteAccount(token);
      setFeedback({ type: "success", message: "Account deleted. Signing out…" });
      await logout();
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setApiLoading(false);
    }
  };

  const handleCreateGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createGroupName.trim()) {
      setFeedback({ type: "error", message: "Group name is required." });
      return;
    }

    try {
      setGroupsLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();
      const group = await createGroup(
        {
          name: createGroupName.trim(),
          description: createGroupDescription.trim() || undefined,
        },
        token
      );
      setCreateGroupName("");
      setCreateGroupDescription("");
      await loadGroups();
      setFeedback({ type: "success", message: `Group "${group.name}" created.` });
      await selectGroup(group.id);
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setGroupsLoading(false);
    }
  };

  const handleUpdateGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedGroupId) {
      return;
    }
    if (!updateGroupName.trim()) {
      setFeedback({ type: "error", message: "Group name cannot be empty." });
      return;
    }

    try {
      setGroupsLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();
      await updateGroup(
        selectedGroupId,
        {
          name: updateGroupName.trim(),
          description: updateGroupDescription.trim() || null,
        },
        token
      );
      await loadGroups();
      setFeedback({ type: "success", message: "Group updated." });
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setGroupsLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!window.confirm("Delete this group? All memberships will be removed.")) {
      return;
    }

    try {
      setGroupsLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();
      await deleteGroupApi(groupId, token);
      await loadGroups();
      setFeedback({ type: "success", message: "Group deleted." });
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setGroupsLoading(false);
    }
  };

  const handleAddMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userId = Number(memberUserId);
    if (!selectedGroupId) {
      return;
    }
    if (!Number.isFinite(userId) || userId <= 0) {
      setFeedback({ type: "error", message: "Enter a valid numeric user ID." });
      return;
    }

    try {
      setGroupsLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();
      await addGroupMember(
        selectedGroupId,
        {
          user_id: userId,
          role: memberRole,
        },
        token
      );
      setMemberUserId("");
      await selectGroup(selectedGroupId);
      setFeedback({ type: "success", message: "Member added to group." });
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setGroupsLoading(false);
    }
  };

  const handleUpdateMemberRole = async (userId: number, role: "member" | "admin") => {
    if (!selectedGroupId) {
      return;
    }
    try {
      setGroupsLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();
      await updateGroupMemberRole(
        selectedGroupId,
        userId,
        { role },
        token
      );
      await selectGroup(selectedGroupId);
      setFeedback({ type: "success", message: "Member role updated." });
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setGroupsLoading(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedGroupId) {
      return;
    }
    if (!window.confirm("Remove this member from the group?")) {
      return;
    }

    try {
      setGroupsLoading(true);
      setFeedback(null);
      const token = await ensureCsrfToken();
      await removeGroupMember(selectedGroupId, userId, token);
      await selectGroup(selectedGroupId);
      setFeedback({ type: "success", message: "Member removed." });
    } catch (err) {
      setFeedback({ type: "error", message: extractError(err) });
    } finally {
      setGroupsLoading(false);
    }
  };

  const memberCount = useMemo(() => selectedGroup?.members.length ?? 0, [selectedGroup]);

  // Show loading while authenticating
  if (!isAuthenticated && authLoading) {
    return (
      <main className="settings-page">
        <div className="card">
          <div className="loading-state">Authenticating...</div>
        </div>
      </main>
    );
  }

  // Show error if authentication failed
  if (!isAuthenticated && !authLoading) {
    return (
      <main className="settings-page">
        <div className="card">
          <div className="banner banner-error">
            Authentication failed. Please check your configuration and try again.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="settings-page">
      <header className="page-section">
        <div>
          <h1 className="page-title">Workspace settings</h1>
          <p className="muted-text">
            Manage authentication, data retention, and collaborative groups linked to your account.
          </p>
        </div>
        <div className="inline-stats">
          <span className="badge badge-muted">
            Signed in as <strong>{user?.username ?? "anonymous"}</strong>
          </span>
          {user?.is_root && <span className="badge badge-info">Root access</span>}
        </div>
      </header>

      {feedback && (
        <div className={`banner ${feedback.type === "success" ? "banner-success" : "banner-error"}`}>
          {feedback.message}
        </div>
      )}

      <section className="settings-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">API access</h2>
              <p className="card-subtitle">
                Rotate API credentials and manage chat history for a clean workspace.
              </p>
            </div>
          </div>
          <div className="action-group">
            <button className="btn btn-primary" onClick={handleRotateApiKey} disabled={apiLoading}>
              Generate new API key
            </button>
            {apiKey && (
              <code className="api-key">
                {apiKey}
              </code>
            )}
          </div>
          <div className="action-group">
            <button className="btn btn-secondary" onClick={handlePurgeHistory} disabled={apiLoading}>
              Purge chat history
            </button>
            {historySummary && (
              <p className="muted-text-small">
                Last purge removed{" "}
                <strong>{historySummary.sessions_deleted} session(s)</strong> and{" "}
                <strong>{historySummary.messages_deleted} message(s)</strong>.
              </p>
            )}
          </div>
          <div className="action-group">
            <button className="btn btn-secondary" onClick={handleExportData} disabled={exporting}>
              {exporting ? "Preparing export…" : "Export my data"}
            </button>
            {exportUrl && (
              <a className="btn btn-link" href={exportUrl} download="youworker-export.json">
                Download export
              </a>
            )}
          </div>
        </div>

        <div className="card danger-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Danger zone</h2>
              <p className="card-subtitle">
                Permanently remove your account and all related resources.
              </p>
            </div>
          </div>
          <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={apiLoading}>
            Delete account
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Group management</h2>
            <p className="card-subtitle">
              Create teams, invite collaborators, and adjust permissions for shared workspaces.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => loadGroups()} disabled={groupsLoading}>
            Refresh
          </button>
        </div>

        {groupError && <div className="banner banner-error">{groupError}</div>}

        <div className="group-layout">
          <div className="group-list">
            <h3 className="section-title">Your groups</h3>
            {groupsLoading && groups.length === 0 ? (
              <div className="loading-state">Loading groups…</div>
            ) : groups.length === 0 ? (
              <div className="empty-state">You have not created or joined any groups yet.</div>
            ) : (
              <ul>
                {groups.map((group) => (
                  <li
                    key={group.id}
                    className={group.id === selectedGroupId ? "group-item active" : "group-item"}
                    onClick={() => selectGroup(group.id)}
                  >
                    <div>
                      <strong>{group.name}</strong>
                      {group.description && (
                        <div className="muted-text-small">{group.description}</div>
                      )}
                    </div>
                    <span className="badge badge-muted">{group.member_count} member(s)</span>
                  </li>
                ))}
              </ul>
            )}

            <form className="form-grid compact" onSubmit={handleCreateGroup}>
              <h4 className="section-title">Create group</h4>
              <label className="form-field">
                <span>Name</span>
                <input
                  type="text"
                  value={createGroupName}
                  onChange={(event) => setCreateGroupName(event.target.value)}
                  placeholder="DevOps"
                  required
                />
              </label>
              <label className="form-field">
                <span>Description</span>
                <input
                  type="text"
                  value={createGroupDescription}
                  onChange={(event) => setCreateGroupDescription(event.target.value)}
                  placeholder="Optional description"
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={groupsLoading}>
                Create group
              </button>
            </form>
          </div>

          <div className="group-details">
            {groupsLoading && !selectedGroup ? (
              <div className="loading-state">Loading group details…</div>
            ) : !selectedGroup ? (
              <div className="empty-state">Select a group to configure members and permissions.</div>
            ) : (
              <>
                <div className="group-header">
                  <div>
                    <h3>{selectedGroup.name}</h3>
                    {selectedGroup.description && (
                      <p className="muted-text">{selectedGroup.description}</p>
                    )}
                  </div>
                  <div className="inline-stats">
                    <span className="badge badge-info">{memberCount} member(s)</span>
                    <button
                      className="btn btn-text"
                      onClick={() => handleDeleteGroup(selectedGroup.id)}
                      disabled={groupsLoading}
                    >
                      Delete group
                    </button>
                  </div>
                </div>

                <form className="form-grid compact" onSubmit={handleUpdateGroup}>
                  <h4 className="section-title">Edit group</h4>
                  <label className="form-field">
                    <span>Name</span>
                    <input
                      type="text"
                      value={updateGroupName}
                      onChange={(event) => setUpdateGroupName(event.target.value)}
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span>Description</span>
                    <input
                      type="text"
                      value={updateGroupDescription}
                      onChange={(event) => setUpdateGroupDescription(event.target.value)}
                    />
                  </label>
                  <button className="btn btn-secondary" type="submit" disabled={groupsLoading}>
                    Save changes
                  </button>
                </form>

                <div className="member-management">
                  <h4 className="section-title">Members</h4>
                  {selectedGroup.members.length === 0 ? (
                    <div className="empty-state">No members yet.</div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Joined</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGroup.members.map((member) => (
                          <tr key={member.user_id}>
                            <td>{member.username}</td>
                            <td>
                              <span className="badge badge-muted">{member.role}</span>
                            </td>
                            <td>{formatDate(member.joined_at)}</td>
                            <td className="text-right">
                              <button
                                className="btn btn-text"
                                onClick={() =>
                                  handleUpdateMemberRole(
                                    member.user_id,
                                    member.role === "admin" ? "member" : "admin"
                                  )
                                }
                                disabled={groupsLoading}
                              >
                                Make {member.role === "admin" ? "member" : "admin"}
                              </button>
                              <button
                                className="btn btn-text"
                                onClick={() => handleRemoveMember(member.user_id)}
                                disabled={groupsLoading}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <form className="form-grid compact" onSubmit={handleAddMember}>
                  <h4 className="section-title">Add member</h4>
                  <label className="form-field">
                    <span>User ID</span>
                    <input
                      type="number"
                      value={memberUserId}
                      onChange={(event) => setMemberUserId(event.target.value)}
                      min={1}
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span>Role</span>
                    <select
                      value={memberRole}
                      onChange={(event) =>
                        setMemberRole(event.target.value as "member" | "admin")
                      }
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <button className="btn btn-primary" type="submit" disabled={groupsLoading}>
                    Add member
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function extractError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.apiError?.message || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
