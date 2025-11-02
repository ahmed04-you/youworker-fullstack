import { apiDelete, apiFetch, apiGet, apiPost } from './client';
import type { Group, GroupWithMembers, GroupMember } from '../types';

function withCsrf(csrfToken?: string): HeadersInit | undefined {
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
}

export interface UpdateGroupPayload {
  name?: string;
  description?: string | null;
}

export interface AddMemberPayload {
  user_id: number;
  role?: 'member' | 'admin';
}

export interface UpdateMemberRolePayload {
  role: 'member' | 'admin';
}

export async function listMyGroups(): Promise<Group[]> {
  return apiGet<Group[]>('/v1/groups/me');
}

export async function getGroup(groupId: number): Promise<GroupWithMembers> {
  return apiGet<GroupWithMembers>(`/v1/groups/${groupId}`);
}

export async function createGroup(payload: CreateGroupPayload, csrfToken?: string): Promise<Group> {
  return apiPost<Group>(
    '/v1/groups',
    payload,
    {
      headers: withCsrf(csrfToken),
    }
  );
}

export async function updateGroup(
  groupId: number,
  payload: UpdateGroupPayload,
  csrfToken?: string
): Promise<Group> {
  return apiFetch<Group>(`/v1/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    headers: withCsrf(csrfToken),
  });
}

export async function deleteGroup(groupId: number, csrfToken?: string): Promise<void> {
  await apiDelete<void>(`/v1/groups/${groupId}`, {
    headers: withCsrf(csrfToken),
  });
}

export async function addGroupMember(
  groupId: number,
  payload: AddMemberPayload,
  csrfToken?: string
): Promise<GroupMember> {
  return apiPost<GroupMember>(
    `/v1/groups/${groupId}/members`,
    payload,
    {
      headers: withCsrf(csrfToken),
    }
  );
}

export async function updateGroupMemberRole(
  groupId: number,
  userId: number,
  payload: UpdateMemberRolePayload,
  csrfToken?: string
): Promise<GroupMember> {
  return apiPost<GroupMember>(
    `/v1/groups/${groupId}/members/${userId}`,
    payload,
    {
      method: 'PUT',
      headers: withCsrf(csrfToken),
    }
  );
}

export async function removeGroupMember(
  groupId: number,
  userId: number,
  csrfToken?: string
): Promise<void> {
  await apiDelete<void>(
    `/v1/groups/${groupId}/members/${userId}`,
    {
      headers: withCsrf(csrfToken),
    }
  );
}
