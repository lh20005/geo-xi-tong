// 文章设置实体
export interface ArticleSetting {
  id: number;
  name: string;
  prompt: string;
  created_at: string;
  updated_at: string;
}

// 创建/更新表单数据
export interface ArticleSettingFormData {
  name: string;
  prompt: string;
}

// API响应类型
export interface ArticleSettingsListResponse {
  settings: ArticleSetting[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ArticleSettingResponse {
  id: number;
  name: string;
  prompt: string;
  created_at: string;
  updated_at: string;
}

export interface DeleteResponse {
  success: boolean;
}
