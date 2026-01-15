import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import axios from 'axios';
import { Page } from 'playwright';

/**
 * 图片上传服务
 * 负责下载图片并上传到发布平台
 * 
 * 改造说明：从服务器迁移到 Windows 端
 * - 使用 app.getPath('userData') 替代 __dirname
 * - 图片路径使用本地 gallery 目录
 */
export class ImageUploadService {
  private tempDir: string;

  constructor() {
    // 临时目录存储在用户数据目录
    this.tempDir = path.join(app.getPath('userData'), 'temp', 'images');
    
    // 确保临时目录存在
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 从内容中提取图片URL（支持HTML和Markdown格式）
   */
  extractImageUrls(content: string): string[] {
    const urls: string[] = [];
    
    // 1. 提取HTML格式的图片: <img src="...">
    const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let match;
    while ((match = htmlImgRegex.exec(content)) !== null) {
      urls.push(match[1]);
    }
    
    // 2. 提取Markdown格式的图片: ![alt](url)
    const markdownImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = markdownImgRegex.exec(content)) !== null) {
      urls.push(match[2]);
    }

    console.log(`[图片处理] 提取到 ${urls.length} 张图片`);
    if (urls.length > 0) {
      console.log(`[图片处理] 图片列表:`, urls);
    }
    return urls;
  }

  /**
   * 解析图片路径（本地路径或URL）
   */
  resolveImagePath(imagePath: string): string {
    // 如果是本地 gallery 路径
    if (imagePath.startsWith('/gallery/') || imagePath.startsWith('gallery/')) {
      const relativePath = imagePath.replace(/^\/?(gallery\/)/, '');
      return path.join(app.getPath('userData'), 'gallery', relativePath);
    }
    
    // 如果是 uploads 路径（兼容旧数据）
    if (imagePath.startsWith('/uploads/')) {
      const relativePath = imagePath.replace(/^\/uploads\//, '');
      return path.join(app.getPath('userData'), 'uploads', relativePath);
    }
    
    // 如果是绝对路径，直接返回
    if (path.isAbsolute(imagePath)) {
      return imagePath;
    }
    
    // 其他情况，假设是相对于 userData 的路径
    return path.join(app.getPath('userData'), imagePath);
  }

  /**
   * 下载图片到本地（用于远程URL）
   */
  async downloadImage(imageUrl: string): Promise<string | null> {
    try {
      console.log(`[图片下载] 开始下载: ${imageUrl}`);

      // 如果是本地路径，直接返回解析后的路径
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        const localPath = this.resolveImagePath(imageUrl);
        if (fs.existsSync(localPath)) {
          console.log(`[图片下载] 本地文件存在: ${localPath}`);
          return localPath;
        }
        console.log(`[图片下载] 本地文件不存在: ${localPath}`);
        return null;
      }

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000
      });

      // 生成文件名
      const ext = this.getImageExtension(imageUrl, response.headers['content-type']);
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const filepath = path.join(this.tempDir, filename);

      // 保存文件
      fs.writeFileSync(filepath, response.data);
      console.log(`[图片下载] ✅ 保存到: ${filepath}`);

      return filepath;
    } catch (error: any) {
      console.error(`[图片下载] ❌ 失败: ${imageUrl}`, error.message);
      return null;
    }
  }

  /**
   * 获取图片扩展名
   */
  private getImageExtension(url: string, contentType?: string): string {
    // 先从URL获取
    const urlExt = path.extname(url).toLowerCase().replace('.', '');
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(urlExt)) {
      return urlExt;
    }

    // 从Content-Type获取
    if (contentType) {
      if (contentType.includes('jpeg')) return 'jpg';
      if (contentType.includes('png')) return 'png';
      if (contentType.includes('gif')) return 'gif';
      if (contentType.includes('webp')) return 'webp';
    }

    // 默认
    return 'jpg';
  }

  /**
   * 上传图片到平台（通用方法）
   */
  async uploadImageToPlatform(
    page: Page,
    imagePath: string,
    uploadButtonSelector?: string
  ): Promise<string | null> {
    try {
      console.log(`[图片上传] 开始上传: ${imagePath}`);

      // 查找文件上传输入框
      const fileInputSelectors = [
        'input[type="file"]',
        'input[accept*="image"]',
        '[data-testid="image-upload"]'
      ];

      let fileInput = null;
      for (const selector of fileInputSelectors) {
        try {
          fileInput = await page.$(selector);
          if (fileInput) {
            console.log(`[图片上传] 找到上传输入框: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!fileInput) {
        // 尝试点击上传按钮触发文件选择
        if (uploadButtonSelector) {
          console.log(`[图片上传] 尝试点击上传按钮: ${uploadButtonSelector}`);
          await page.click(uploadButtonSelector);
          await new Promise(resolve => setTimeout(resolve, 1000));
          fileInput = await page.$('input[type="file"]');
        }
      }

      if (!fileInput) {
        console.log('[图片上传] ⚠️ 未找到文件上传输入框');
        return null;
      }

      // 上传文件
      await (fileInput as any).setInputFiles(imagePath);
      console.log('[图片上传] ✅ 文件已选择，等待上传完成...');

      // 等待上传完成
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 尝试获取上传后的图片URL
      const uploadedUrl = await this.getUploadedImageUrl(page);
      if (uploadedUrl) {
        console.log(`[图片上传] ✅ 上传成功: ${uploadedUrl}`);
        return uploadedUrl;
      }

      console.log('[图片上传] ✅ 上传完成（未获取到URL）');
      return 'uploaded';
    } catch (error: any) {
      console.error('[图片上传] ❌ 失败:', error.message);
      return null;
    }
  }

  /**
   * 获取上传后的图片URL（平台特定）
   */
  private async getUploadedImageUrl(page: Page): Promise<string | null> {
    try {
      // 在浏览器上下文中执行，使用 Function 构造避免 TypeScript 检查
      const imageUrl = await page.evaluate(new Function(`
        const images = document.querySelectorAll('img');
        if (images.length > 0) {
          const lastImage = images[images.length - 1];
          return lastImage.src;
        }
        return null;
      `) as () => string | null);

      return imageUrl;
    } catch (error) {
      return null;
    }
  }

  /**
   * 批量下载图片
   */
  async downloadImages(imageUrls: string[]): Promise<Map<string, string>> {
    const imageMap = new Map<string, string>();

    for (const url of imageUrls) {
      const localPath = await this.downloadImage(url);
      if (localPath) {
        imageMap.set(url, localPath);
      }
    }

    console.log(`[图片下载] 成功下载 ${imageMap.size}/${imageUrls.length} 张图片`);
    return imageMap;
  }

  /**
   * 清理临时文件
   */
  cleanupTempFiles(filePaths: string[]): void {
    for (const filepath of filePaths) {
      try {
        if (fs.existsSync(filepath) && filepath.startsWith(this.tempDir)) {
          fs.unlinkSync(filepath);
          console.log(`[清理] 删除临时文件: ${filepath}`);
        }
      } catch (error) {
        console.error(`[清理] 删除失败: ${filepath}`);
      }
    }
  }

  /**
   * 清理所有临时文件
   */
  cleanupAllTempFiles(): void {
    try {
      if (!fs.existsSync(this.tempDir)) return;
      
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        const filepath = path.join(this.tempDir, file);
        fs.unlinkSync(filepath);
      }
      console.log(`[清理] 清理了 ${files.length} 个临时文件`);
    } catch (error) {
      console.error('[清理] 清理临时文件失败:', error);
    }
  }
}

export const imageUploadService = new ImageUploadService();
