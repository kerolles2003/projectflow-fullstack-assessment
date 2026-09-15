'use client';

import type { TaskActivityEntry } from '@projectflow/shared';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { useTaskActivity } from '../hooks';

function activityMessage(activity: TaskActivityEntry): string {
  const actor = activity.actor?.name || 'Unknown user';
  const from = activity.from?.name || 'Unknown user';
  const to = activity.to?.name || 'Unknown user';
  if (activity.metadata.to === null) {
    return activity.metadata.from === null
      ? `${actor} unassigned this task`
      : `${actor} unassigned this task from ${from}`;
  }
  if (activity.metadata.from === null) return `${actor} assigned this task to ${to}`;
  return `${actor} changed the assignee from ${from} to ${to}`;
}

export function TaskActivityTimeline({ taskId }: { taskId: string }) {
  const activity = useTaskActivity(taskId, 1, 25);
  const denied =
    activity.error instanceof ApiError &&
    (activity.error.statusCode === 403 || activity.error.statusCode === 401);
  const seen = new Set<string>();
  // Offset pages can overlap after a new event. Keep the first occurrence in server order.
  const items = (activity.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return (
    <section aria-label="Activity" className="min-w-0 space-y-4" aria-busy={activity.isFetching}>
      <h2 className="text-sm font-semibold text-foreground">Activity</h2>
      {denied ? (
        <p className="text-[13px] text-muted-foreground">Activity unavailable.</p>
      ) : (
        <>
          {activity.isPending && (
            <p role="status" className="text-[13px] text-muted-foreground">
              Loading activity…
            </p>
          )}
          {items.length === 0 && activity.data?.pages[0]?.total === 0 && (
            <p className="text-[13px] text-muted-foreground">No activity yet.</p>
          )}
          {items.length > 0 && (
            <ol className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="flex min-w-0 gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-subtle-foreground"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-[13px] leading-5 text-foreground [overflow-wrap:anywhere]">
                      {activityMessage(item)}
                    </p>
                    <time
                      dateTime={item.createdAt}
                      className="block text-[12px] text-subtle-foreground"
                    >
                      {formatDateTime(item.createdAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {activity.isError ? (
            <div className="space-y-2">
              <p role="alert" className="text-[13px] text-danger">
                Unable to load activity.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={activity.isFetching}
                onClick={() => {
                  void (activity.isFetchNextPageError
                    ? activity.fetchNextPage()
                    : activity.refetch());
                }}
              >
                Retry
              </Button>
            </div>
          ) : (
            activity.hasNextPage && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={activity.isFetching}
                loading={activity.isFetchingNextPage}
                onClick={() => {
                  void activity.fetchNextPage();
                }}
              >
                {activity.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )
          )}
        </>
      )}
    </section>
  );
}
