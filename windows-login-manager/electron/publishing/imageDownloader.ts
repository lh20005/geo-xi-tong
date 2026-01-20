/**
 * 图片下载服务
 * 用于从服务器下载图片到本地临时目录
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import axios from 'axios';
import log from 'electron-log';
import { storageManager } from '../storage/manager';

// 获取临时目录路径
function getTempDir(): string {
  const tempDir = path.join(app.getPath('temp'), 'geo-publishing-images');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

// 获取服务器基础 URL
async function getServerBaseUrl(): Promise<string> {
  // 从存储管理器获取配置（与 API 客户端保持一致）
  const config = await storageManager.getConfig();
  if (config && config.serverUrl) {
    return config.serverUrl;
  }
  // 后备：使用环境变量或默认值
  return process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3000';
}

/**
 * 从服务器下载图片到本地临时目录
 * @param imagePath 图片的相对路径（如 /uploads/gallery/xxx.png）
 * @returns 本地文件路径
 */
export async function downloadImage(imagePath: string): Promise<string> {
  // 如果是完整 URL，直接下载
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return downloadFromUrl(imagePath);
  }

  // 构建完整 URL
  const serverBaseUrl = await getServerBaseUrl();
  const fullUrl = `${serverBaseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
  
  return downloadFromUrl(fullUrl, imagePath);
}

/**
 * 从 URL 下载图片
 */
async function downloadFromUrl(url: string, originalPath?: string): Promise<string> {
  const tempDir = getTempDir();
  
  // 生成本地文件名（保留原始文件名）
  const urlPath = originalPath || new URL(url).pathname;
  const fileName = path.basename(urlPath);
  const localPath = path.join(tempDir, fileName);

  // 如果文件已存在且不太旧（1小时内），直接返回
  if (fs.existsSync(localPath)) {
    const stats = fs.statSync(localPath);
    const ageMs = Date.now() - stats.mtimeMs;
    if (ageMs < 3600000) { // 1小时
      log.info(`[图片下载] 使用缓存: ${localPath}`);
      return localPath;
    }
  }

  log.info(`[图片下载] 开始下载: ${url}`);

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    fs.writeFileSync(localPath, Buffer.from(response.data));
    log.info(`[图片下载] 下载成功: ${localPath}`);
    return localPath;
  } catch (error: any) {
    log.error(`[图片下载] 下载失败: ${url}`, error.message);
    throw new Error(`图片下载失败: ${url} - ${error.message}`);
  }
}

/**
 * 批量下载图片
 * @param imagePaths 图片路径数组
 * @returns 原始路径到本地路径的映射
 */
export async function downloadImages(imagePaths: string[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();

  for (const imagePath of imagePaths) {
    try {
      const localPath = await downloadImage(imagePath);
      imageMap.set(imagePath, localPath);
    } catch (error: any) {
      log.error(`[图片下载] 跳过失败的图片: ${imagePath}`, error.message);
    }
  }

  log.info(`[图片下载] 成功下载 ${imageMap.size}/${imagePaths.length} 张图片`);
  return imageMap;
}

/**
 * 清理临时图片目录
 * @param maxAgeMs 最大保留时间（毫秒），默认24小时
 */
export function cleanupTempImages(maxAgeMs: number = 86400000): void {
  const tempDir = getTempDir();
  
  if (!fs.existsSync(tempDir)) {
    return;
  }

  const files = fs.readdirSync(tempDir);
  let cleanedCount = 0;

  for (const file of files) {
    const filePath = path.join(tempDir, file);
    try {
      const stats = fs.statSync(filePath);
      const ageMs = Date.now() - stats.mtimeMs;
      
      if (ageMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        cleanedCount++;
      }
    } catch (error) {
      // 忽略删除失败的文件
    }
  }

  if (cleanedCount > 0) {
    log.info(`[图片清理] 清理了 ${cleanedCount} 个过期图片`);
  }
}

/**
 * 解析图片路径为本地绝对路径
 * 如果是远程路径，会先下载到本地
 * @param imagePath 图片路径（可以是相对路径或完整URL）
 * @returns 本地绝对路径
 */
export async function resolveImagePath(imagePath: string): Promise<string> {
  // 如果是本地绝对路径且文件存在，直接返回
  if (path.isAbsolute(imagePath) && fs.existsSync(imagePath)) {
    return imagePath;
  }

  // 如果是 /uploads/ 开头的相对路径，需要从服务器下载
  if (imagePath.startsWith('/uploads/') || imagePath.startsWith('uploads/')) {
    return downloadImage(imagePath);
  }

  // 如果是完整 URL，下载
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return downloadImage(imagePath);
  }

  // 其他情况，尝试作为相对路径下载
  return downloadImage(imagePath);
}
