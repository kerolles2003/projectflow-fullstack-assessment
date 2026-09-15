'use client';

import { useId, useState } from 'react';
import { toast } from 'sonner';
import { isElevatedOrganizationRole, ProjectRole, type TaskDetail } from '@projectflow/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentUser } from '@/features/auth/hooks';
import { useProject, useProjectMembers } from '@/features/projects/hooks';
import { useUpdateTaskAssignee } from '../hooks';

const UNASSIGNED = 'unassigned';

export function TaskAssigneeSelect({ task }: { task: TaskDetail }) {
  const id = useId();
  const [search, setSearch] = useState('');
  const members = useProjectMembers(task.projectId);
  const project = useProject(task.projectId);
  const currentUser = useCurrentUser();
  const mutation = useUpdateTaskAssignee(task.id, task.projectId);
  const entries = members.data ?? [];
  const actor = currentUser.data;
  const actorMembership = entries.find((entry) => entry.user.id === actor?.id);
  const organizationRole = actor?.organizations.find(
    (organization) => organization.id === project.data?.organizationId,
  )?.role;
  const canManage =
    isElevatedOrganizationRole(organizationRole) ||
    actorMembership?.role === ProjectRole.PROJECT_MANAGER;
  const canAssign = canManage || actorMembership !== undefined;
  const canClear = canManage || task.assigneeId === actor?.id || task.assigneeId === null;
  const loading = members.isPending || project.isPending || currentUser.isPending;
  const loadError = members.error ?? project.error ?? currentUser.error;
  const disabled = loading || !!loadError || !canAssign || mutation.isPending;
  const assignee = entries.find((entry) => entry.user.id === task.assigneeId)?.user;
  const currentLabel =
    task.assigneeId === null
      ? 'Unassigned'
      : (assignee?.name ?? (task.assigneeId === actor?.id ? actor.name : 'Unknown user'));
  const filter = search.trim().toLocaleLowerCase();
  const options = entries.filter(
    (entry) =>
      (canManage || entry.user.id === actor?.id) &&
      `${entry.user.name} ${entry.user.email}`.toLocaleLowerCase().includes(filter),
  );

  return (
    <section
      className="min-w-0 space-y-2"
      aria-label="Assignee"
      aria-busy={loading || mutation.isPending}
    >
      <Label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-wide text-subtle-foreground"
      >
        Assignee
      </Label>
      <Select
        value={task.assigneeId ?? UNASSIGNED}
        disabled={disabled || (!canClear && options.length === 0)}
        onValueChange={(value) =>
          mutation.mutate(
            { assigneeId: value === UNASSIGNED ? null : value },
            {
              onError: (error) => toast.error(error.message),
            },
          )
        }
      >
        <SelectTrigger id={id} className="min-w-0" aria-describedby={`${id}-state`}>
          <SelectValue>
            <span className="block truncate">{currentLabel}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-64 max-w-[calc(100vw-2rem)] overflow-y-auto">
          {canClear && <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>}
          {options.map((entry) => (
            <SelectItem key={entry.user.id} value={entry.user.id} textValue={entry.user.name}>
              <span
                className="block max-w-[200px] truncate"
                title={`${entry.user.name} — ${entry.user.email}`}
              >
                {entry.user.name} — {entry.user.email}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor={`${id}-search`} className="text-xs text-muted-foreground">
        Search members
      </Label>
      <Input
        id={`${id}-search`}
        type="search"
        value={search}
        disabled={disabled}
        placeholder="Name or email"
        onChange={(event) => setSearch(event.target.value)}
        className="h-8 min-w-0 text-[13px]"
      />
      <div
        id={`${id}-state`}
        className="space-y-1 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {loading && <p>Loading members…</p>}
        {loadError && (
          <>
            <p role="alert">{loadError.message}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void members.refetch();
                void project.refetch();
                void currentUser.refetch();
              }}
            >
              Retry
            </Button>
          </>
        )}
        {!loading && !loadError && (
          <>
            {!canAssign && <p>You cannot change this assignment.</p>}
            {entries.length === 0 && <p>No project members.</p>}
            {canAssign && entries.length > 0 && options.length === 0 && <p>No members found.</p>}
          </>
        )}
        {mutation.isPending && <p>Saving assignment…</p>}
        {mutation.isError && (
          <p role="alert">{mutation.error.message} Choose an assignee again to retry.</p>
        )}
      </div>
    </section>
  );
}
