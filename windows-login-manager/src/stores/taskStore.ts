/**
 * 任务状态管理
 * 使用本地 API（SQLite）存储任务数据
 */

import { create } from 'zustand';
import { localTaskApi, localPublishApi, type LocalTask, type CreateTaskParams } from '../api';

interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface BatchStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface TaskLog {
  id: number;
  taskId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: string;
  createdAt: string;
}

interface TaskState {
  // 数据
  tasks: LocalTask[];
  currentTask: LocalTask | null;
  stats: TaskStats | null;
  logs: TaskLog[];
  
  // 分页
  total: number;
  page: number;
  pageSize: number;
  
  // 状态
  loading: boolean;
  executing: boolean;
  error: string | null;
  
  // 操作
  fetchTasks: (params?: { status?: string; batchId?: string; page?: number; pageSize?: number }) => Promise<void>;
  fetchTask: (id: string) => Promise<void>;
  createTask: (params: CreateTaskParams) => Promise<LocalTask | null>;
  updateStatus: (id: string, status: string, errorMessage?: string) => Promise<boolean>;
  cancelTask: (id: string) => Promise<boolean>;
  deleteTask: (id: string) => Promise<boolean>;
  fetchPending: () => Promise<void>;
  fetchByBatchId: (batchId: string) => Promise<void>;
  cancelBatch: (batchId: string) => Promise<{ success: boolean; cancelledCount: number }>;
  deleteBatch: (batchId: string) => Promise<{ success: boolean; deletedCount: number }>;
  getBatchStats: (batchId: string) => Promise<BatchStats | null>;
  fetchStats: () => Promise<void>;
  fetchLogs: (taskId: string) => Promise<void>;
  
  // 发布执行
  executeSingle: (taskId: string) => Promise<boolean>;
  executeBatch: (batchId: string) => Promise<boolean>;
  stopBatch: (batchId: string) => Promise<boolean>;
  
  // 调度器
  startScheduler: () => Promise<boolean>;
  stopScheduler: () => Promise<boolean>;
  getSchedulerStatus: () => Promise<{ running: boolean; nextRun?: string } | null>;
  
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  tasks: [],
  currentTask: null,
  stats: null,
  logs: [],
  total: 0,
  page: 1,
  pageSize: 10,
  loading: false,
  executing: false,
  error: null,
};

export const useTaskStore = create<TaskState>((set, get) => ({
  ...initialState,
  
  fetchTasks: async (params) => {
    set({ loading: true, error: null });
    try {
      const result = await localTaskApi.findAll(params);
      if (result.success) {
        set({
          tasks: result.data.tasks || [],
          total: result.data.total || 0,
          page: params?.page || 1,
          pageSize: params?.pageSize || 10,
          loading: false,
        });
      } else {
        set({ error: result.error || '获取任务列表失败', loading: false });
      }
    } catch (error: any) {
      set({ error: error.message || '获取任务列表失败', loading: false });
    }
  },
  
  fetchTask: async (id) => {
    set({ loading: true, error: null });
    try {
      const result = await localTaskApi.findById(id);
      if (result.success) {
        set({ currentTask: result.data, loading: false });
      } else {
        set({ error: result.error || '获取任务详情失败', loading: false });
      }
    } catch (error: any) {
      set({ error: error.message || '获取任务详情失败', loading: false });
    }
  },
  
  createTask: async (params) => {
    set({ loading: true, error: null });
    try {
      const result = await localTaskApi.create(params);
      if (result.success) {
        await get().fetchTasks({ page: get().page, pageSize: get().pageSize });
        set({ loading: false });
        return result.data;
      } else {
        set({ error: result.error || '创建任务失败', loading: false });
        return null;
      }
    } catch (error: any) {
      set({ error: error.message || '创建任务失败', loading: false });
      return null;
    }
  },
  
  updateStatus: async (id, status, errorMessage) => {
    try {
      const result = await localTaskApi.updateStatus(id, status, errorMessage);
      if (result.success) {
        await get().fetchTasks({ page: get().page, pageSize: get().pageSize });
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('更新任务状态失败:', error);
      return false;
    }
  },
  
  cancelTask: async (id) => {
    set({ loading: true, error: null });
    try {
      const result = await localTaskApi.cancel(id);
      if (result.success) {
        await get().fetchTasks({ page: get().page, pageSize: get().pageSize });
        set({ loading: false });
        return true;
      } else {
        set({ error: result.error || '取消任务失败', loading: false });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '取消任务失败', loading: false });
      return false;
    }
  },
  
  deleteTask: async (id) => {
    set({ loading: true, error: null });
    try {
      const result = await localTaskApi.delete(id);
      if (result.success) {
        await get().fetchTasks({ page: get().page, pageSize: get().pageSize });
        set({ loading: false });
        return true;
      } else {
        set({ error: result.error || '删除任务失败', loading: false });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '删除任务失败', loading: false });
      return false;
    }
  },
  
  fetchPending: async () => {
    set({ loading: true, error: null });
    try {
      const result = await localTaskApi.findPending();
      if (result.success) {
        set({ tasks: result.data || [], loading: false });
      } else {
        set({ error: result.error || '获取待处理任务失败', loading: false });
      }
    } catch (error: any) {
      set({ error: error.message || '获取待处理任务失败', loading: false });
    }
  },
  
  fetchByBatchId: async (batchId) => {
    set({ loading: true, error: null });
    try {
      const result = await localTaskApi.findByBatchId(batchId);
      if (result.success) {
        set({ tasks: result.data || [], loading: false });
      } else {
        set({ error: result.error || '获取批次任务失败', loading: false });
      }
    } catch (error: any) {
      set({ error: error.message || '获取批次任务失败', loading: false });
    }
  },
  
  cancelBatch: async (batchId) => {
    set({ loading: true, error: null });
    try {
      const result = await localTaskApi.cancelBatch(batchId);
      if (result.success) {
        await get().fetchTasks({ page: get().page, pageSize: get().pageSize });
        set({ loading: false });
        return { success: true, cancelledCount: result.data?.cancelledCount || 0 };
      } else {
        set({ error: result.error || '取消批次失败', loading: false });
        return { success: false, cancelledCount: 0 };
      }
    } catch (error: any) {
      set({ error: error.message || '取消批次失败', loading: false });
      return { success: false, cancelledCount: 0 };
    }
  },
  
  deleteBatch: async (batchId) => {
    set({ loading: true, error: null });
    try {
      const result = await localTaskApi.deleteBatch(batchId);
      if (result.success) {
        await get().fetchTasks({ page: get().page, pageSize: get().pageSize });
        set({ loading: false });
        return { success: true, deletedCount: result.data?.deletedCount || 0 };
      } else {
        set({ error: result.error || '删除批次失败', loading: false });
        return { success: false, deletedCount: 0 };
      }
    } catch (error: any) {
      set({ error: error.message || '删除批次失败', loading: false });
      return { success: false, deletedCount: 0 };
    }
  },
  
  getBatchStats: async (batchId) => {
    try {
      const result = await localTaskApi.getBatchStats(batchId);
      if (result.success) {
        return result.data;
      }
      return null;
    } catch (error: any) {
      console.error('获取批次统计失败:', error);
      return null;
    }
  },
  
  fetchStats: async () => {
    try {
      const result = await localTaskApi.getStats();
      if (result.success) {
        set({ stats: result.data });
      }
    } catch (error: any) {
      console.error('获取任务统计失败:', error);
    }
  },
  
  fetchLogs: async (taskId) => {
    try {
      const result = await localTaskApi.getLogs(taskId);
      if (result.success) {
        set({ logs: result.data || [] });
      }
    } catch (error: any) {
      console.error('获取任务日志失败:', error);
    }
  },
  
  // 发布执行
  executeSingle: async (taskId) => {
    set({ executing: true, error: null });
    try {
      const result = await localPublishApi.executeSingle(taskId);
      if (result.success) {
        await get().fetchTasks({ page: get().page, pageSize: get().pageSize });
        set({ executing: false });
        return true;
      } else {
        set({ error: result.error || '执行任务失败', executing: false });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '执行任务失败', executing: false });
      return false;
    }
  },
  
  executeBatch: async (batchId) => {
    set({ executing: true, error: null });
    try {
      const result = await localPublishApi.executeBatch(batchId);
      if (result.success) {
        set({ executing: false });
        return true;
      } else {
        set({ error: result.error || '执行批次失败', executing: false });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '执行批次失败', executing: false });
      return false;
    }
  },
  
  stopBatch: async (batchId) => {
    try {
      const result = await localPublishApi.stopBatch(batchId);
      if (result.success) {
        await get().fetchTasks({ page: get().page, pageSize: get().pageSize });
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('停止批次失败:', error);
      return false;
    }
  },
  
  // 调度器
  startScheduler: async () => {
    try {
      const result = await localPublishApi.startScheduler();
      return result.success;
    } catch (error: any) {
      console.error('启动调度器失败:', error);
      return false;
    }
  },
  
  stopScheduler: async () => {
    try {
      const result = await localPublishApi.stopScheduler();
      return result.success;
    } catch (error: any) {
      console.error('停止调度器失败:', error);
      return false;
    }
  },
  
  getSchedulerStatus: async () => {
    try {
      const result = await localPublishApi.getSchedulerStatus();
      if (result.success) {
        return result.data;
      }
      return null;
    } catch (error: any) {
      console.error('获取调度器状态失败:', error);
      return null;
    }
  },
  
  clearError: () => set({ error: null }),
  
  reset: () => set(initialState),
}));
