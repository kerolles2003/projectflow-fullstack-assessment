'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated, TaskDetail, TaskStatus, TaskSummary } from '@projectflow/shared';
import { queryKeys } from '@/lib/query-keys';
import { ApiError } from '@/lib/api-client';
import {
  createTask,
  type CreateTaskPayload,
  fetchProjectTasks,
  fetchTask,
  fetchTaskActivity,
  updateTaskStatus,
  updateTaskAssignee,
  type UpdateTaskAssigneePayload,
} from './api';

export function useTaskActivity(taskId: string, page = 1, pageSize = 25) {
  return useInfiniteQuery({
    queryKey: queryKeys.taskActivityPages(taskId, page, pageSize),
    initialPageParam: page,
    queryFn: ({ pageParam }) => fetchTaskActivity(taskId, pageParam, pageSize),
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined,
    enabled: taskId.length > 0,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.statusCode === 403 || error.statusCode === 401)) &&
      failureCount < 2,
  });
}

export function useProjectTasks(projectId: string) {
  return useQuery<Paginated<TaskSummary>>({
    queryKey: queryKeys.projectTasks(projectId),
    queryFn: () => fetchProjectTasks(projectId),
    enabled: projectId.length > 0,
  });
}

export function useTask(taskId: string) {
  return useQuery<TaskDetail>({
    queryKey: queryKeys.task(taskId),
    queryFn: () => fetchTask(taskId),
    enabled: taskId.length > 0,
  });
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<TaskDetail, Error, CreateTaskPayload>({
    mutationFn: (payload) => createTask(projectId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projectTasks(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
      ]);
    },
  });
}

export function useUpdateTaskAssignee(taskId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<TaskDetail, Error, UpdateTaskAssigneePayload>({
    mutationFn: (payload) => updateTaskAssignee(taskId, payload),
    onSuccess: async (task) => {
      queryClient.setQueryData(queryKeys.task(taskId), task);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projectTasks(task.projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.taskActivity(taskId) }),
      ]);
    },
    onError: async (error) => {
      if (!(error instanceof ApiError) || error.statusCode >= 500) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId), exact: true }),
          queryClient.invalidateQueries({ queryKey: queryKeys.projectTasks(projectId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.taskActivity(taskId) }),
        ]);
      }
    },
  });
}

export function useUpdateTaskStatus(taskId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<TaskDetail, Error, TaskStatus>({
    mutationFn: (status) => updateTaskStatus(taskId, status),
    onSuccess: async (task) => {
      queryClient.setQueryData(queryKeys.task(taskId), task);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projectTasks(projectId) });
    },
  });
}
