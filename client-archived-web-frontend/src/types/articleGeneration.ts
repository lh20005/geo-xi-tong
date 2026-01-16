// 任务配置
export interface TaskConfig {
  distillationId: number;
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  conversionTargetId?: number;  // 可选：转化目标ID
  articleCount: number;
}

// 生成任务
export interface GenerationTask {
  id: number;
  distillationId: number;
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  conversionTargetId?: number | null;  // 可选：转化目标ID
  requestedCount: number;
  generatedCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  conversionTargetName?: string | null;  // 转化目标名称
  articleSettingName?: string | null;  // 文章设置名称
  albumName?: string | null;  // 企业图库名称
  knowledgeBaseName?: string | null;  // 企业知识库名称
  keyword: string;  // 关键词
  provider: string;  // AI提供商
  distillationResult?: string | null;  // 蒸馏结果
}

// 生成的文章
export interface GeneratedArticle {
  id: number;
  title: string;
  keyword: string;
  imageUrl: string | null;
  createdAt: string;
}

// 任务详情（包含生成的文章）
export interface TaskDetail extends GenerationTask {
  generatedArticles: GeneratedArticle[];
}

// 蒸馏历史
export interface DistillationHistory {
  id: number;
  keyword: string;
  provider: string;
  created_at: string;
}

// 相册
export interface Album {
  id: number;
  name: string;
  image_count: number;
  cover_image: string | null;
  created_at: string;
}

// 知识库
export interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
}

// 文章设置
export interface ArticleSetting {
  id: number;
  name: string;
  prompt: string;
  created_at: string;
  updated_at: string;
}

// 转化目标
export interface ConversionTarget {
  id: number;
  company_name: string;
  industry: string;
  company_size: string;
  features: string | null;
  contact_info: string;
  website: string | null;
  target_audience: string | null;
  core_products: string | null;
  created_at: string;
  updated_at: string;
}

// API响应类型
export interface CreateTaskResponse {
  taskId: number;
  status: string;
  createdAt: string;
}

export interface TaskListResponse {
  tasks: GenerationTask[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskDetailResponse extends TaskDetail {}

export interface ArticleListResponse {
  articles: Article[];
  total: number;
  page: number;
  pageSize: number;
}

// 文章
export interface Article {
  id: number;
  title: string;
  keyword: string;
  distillationId: number | null;
  taskId: number | null;
  provider: string;
  imageUrl: string | null;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

// 文章详情
export interface ArticleDetail {
  id: number;
  title: string;
  keyword: string;
  distillationId: number | null;
  taskId: number | null;
  requirements: string | null;
  content: string;
  imageUrl: string | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
}
