/**
 * 本地文件协议处理器
 * 用于安全地在渲染进程中加载本地图片文件
 */
import { protocol, net, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { Logger } from '../logger/logger';

const logger = Logger.getInstance();

// 自定义协议名称
export const LOCAL_FILE_PROTOCOL = 'local-file';

/**
 * 注册本地文件协议
 * 必须在 app.whenReady() 之后调用
 */
export function registerLocalFileProtocol(): void {
  // 注册为特权协议（需要在 app ready 之前调用）
  // 但由于我们使用 handle 方式，可以在 ready 之后注册
  
  protocol.handle(LOCAL_FILE_PROTOCOL, async (request) => {
    try {
      // 解析请求的文件路径
      // URL 格式: local-file:///path/to/file.png
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);
      
      // Windows 路径处理：移除开头的斜杠
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }
      
      logger.debug(`Local file protocol request: ${filePath}`);
      
      // 安全检查：只允许访问特定目录下的文件
      const userDataPath = app.getPath('userData');
      const galleryPath = path.join(userDataPath, 'gallery');
      const knowledgePath = path.join(userDataPath, 'knowledge');
      
      // 规范化路径
      const normalizedPath = path.normalize(filePath);
      const normalizedGalleryPath = path.normalize(galleryPath);
      const normalizedKnowledgePath = path.normalize(knowledgePath);
      
      // 检查文件是否在允许的目录内
      const isInGallery = normalizedPath.startsWith(normalizedGalleryPath);
      const isInKnowledge = normalizedPath.startsWith(normalizedKnowledgePath);
      
      if (!isInGallery && !isInKnowledge) {
        logger.warn(`Access denied: ${filePath} is not in allowed directories`);
        return new Response('Access denied', { status: 403 });
      }
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        logger.warn(`File not found: ${filePath}`);
        return new Response('File not found', { status: 404 });
      }
      
      // 获取文件的 MIME 类型
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.txt': 'text/plain',
      };
      
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      
      // 使用 net.fetch 读取本地文件
      return net.fetch(`file://${filePath}`);
    } catch (error) {
      logger.error('Error handling local file protocol:', error);
      return new Response('Internal error', { status: 500 });
    }
  });
  
  logger.info('Local file protocol registered');
}

/**
 * 将本地文件路径转换为协议 URL
 * @param filePath 本地文件路径
 * @returns 协议 URL
 */
export function getLocalFileUrl(filePath: string): string {
  // 确保路径使用正斜杠
  let normalizedPath = filePath.replace(/\\/g, '/');
  // 确保路径以斜杠开头（对于绝对路径）
  // URL 格式应该是 local-file:///path/to/file（三个斜杠）
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  return `${LOCAL_FILE_PROTOCOL}://${normalizedPath}`;
}
