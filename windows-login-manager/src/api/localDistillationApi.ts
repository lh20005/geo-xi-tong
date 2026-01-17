/**
 * 本地蒸馏记录 API
 * 通过 IPC 调用本地 PostgreSQL 服务
 */

export interface LocalDistillation {
  id: number;
  user_id: number;
  keyword: string;
  industry?: string;
  target_audience?: string;
  topic_count: number;
  provider?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDistillationInput {
  keyword: string;
  industry?: string;
  target_audience?: string;
  topic_count: number;
  provider?: string;
}

export interface UpdateDistillationInput {
  keyword?: string;
  industry?: string;
  target_audience?: string;
}

/**
 * 本地蒸馏记录操作 API
 */
export const localDistillationApi = {
  /**
   * 获取所有蒸馏记录（分页）
   */
  findAll: async (params?: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ success: boolean; data?: { items: LocalDistillation[]; total: number }; error?: string }> => {
    return window.electron.invoke('distillation:local:findAll', params);
  },

  /**
   * 根据 ID 获取蒸馏记录
   */
  findById: async (id: number): Promise<{ success: boolean; data?: LocalDistillation; error?: string }> => {
    return window.electron.invoke('distillation:local:findById', id);
  },

  /**
   * 创建蒸馏记录
   */
  create: async (data: CreateDistillationInput): Promise<{ success: boolean; data?: LocalDistillation; error?: string }> => {
    return window.electron.invoke('distillation:local:create', data);
  },

  /**
   * 更新蒸馏记录
   */
  update: async (id: number, data: UpdateDistillationInput): Promise<{ success: boolean; data?: LocalDistillation; error?: string }> => {
    return window.electron.invoke('distillation:local:update', id, data);
  },

  /**
   * 删除蒸馏记录
   */
  delete: async (id: number): Promise<{ success: boolean; error?: string }> => {
    return window.electron.invoke('distillation:local:delete', id);
  },

  /**
   * 批量删除蒸馏记录
   */
  deleteBatch: async (ids: number[]): Promise<{ success: boolean; data?: { deletedCount: number }; error?: string }> => {
    return window.electron.invoke('distillation:local:deleteBatch', ids);
  },

  /**
   * 根据关键词获取蒸馏记录
   */
  getByKeyword: async (keyword: string): Promise<{ success: boolean; data?: LocalDistillation[]; error?: string }> => {
    return window.electron.invoke('distillation:local:getByKeyword', keyword);
  },

  /**
   * 搜索蒸馏记录
   */
  search: async (searchTerm: string): Promise<{ success: boolean; data?: LocalDistillation[]; error?: string }> => {
    return window.electron.invoke('distillation:local:search', searchTerm);
  },

  /**
   * 获取最近的蒸馏记录
   */
  findRecent: async (limit: number = 10): Promise<{ success: boolean; data?: LocalDistillation[]; error?: string }> => {
    return window.electron.invoke('distillation:local:findRecent', limit);
  },

  /**
   * 获取统计信息
   */
  getStats: async (): Promise<{ success: boolean; data?: any; error?: string }> => {
    return window.electron.invoke('distillation:local:getStats');
  },

  /**
   * 检查蒸馏记录是否存在
   */
  exists: async (id: number): Promise<{ success: boolean; data?: { exists: boolean }; error?: string }> => {
    return window.electron.invoke('distillation:local:exists', id);
  },
};
