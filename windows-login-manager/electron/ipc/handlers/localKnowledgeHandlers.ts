/**
 * 本地知识库 IPC 处理器
 * 处理知识库的本地 CRUD 操作
 * Requirements: Phase 6 - PostgreSQL 迁移
 */

import { ipcMain, app } from 'electron';
import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { serviceFactory } from '../../services/ServiceFactory';
import { storageManager } from '../../storage/manager';

/**
 * 解析文档内容
 * 支持 txt, md, docx, pdf 格式
 */
async function parseDocumentContent(filePath: string, fileType: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath);
  
  try {
    // 纯文本文件
    if (ext === '.txt' || ext === '.md') {
      return content.toString('utf-8');
    }
    
    // Word 文档
    if (ext === '.docx' || fileType.includes('wordprocessingml')) {
      const result = await mammoth.extractRawText({ buffer: content });
      return result.value;
    }
    
    // PDF 文档
    if (ext === '.pdf' || fileType === 'application/pdf') {
      const result = await pdfParse(content);
      return result.text;
    }
    
    // 其他格式尝试作为文本读取
    return content.toString('utf-8');
  } catch (error: any) {
    log.error(`Failed to parse document ${filePath}:`, error);
    return '';
  }
}

async function parseDocumentContentBuffer(buffer: Buffer, fileName: string, fileType: string): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();

  try {
    if (ext === '.txt' || ext === '.md') {
      return buffer.toString('utf-8');
    }

    if (ext === '.docx' || fileType.includes('wordprocessingml')) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    if (ext === '.pdf' || fileType === 'application/pdf') {
      const result = await pdfParse(buffer);
      return result.text;
    }

    return buffer.toString('utf-8');
  } catch (error: any) {
    log.error(`Failed to parse document buffer ${fileName}:`, error);
    return '';
  }
}

/**
 * 注册本地知识库相关 IPC 处理器
 * 注意：这些处理器使用 'knowledge:local:' 前缀，与现有的服务器知识库处理器区分
 */
export function registerLocalKnowledgeHandlers(): void {
  log.info('Registering local knowledge base IPC handlers (PostgreSQL)...');

  // 创建知识库
  ipcMain.handle('knowledge:local:create', async (_event, params: any) => {
    try {
      log.info('IPC: knowledge:local:create');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const knowledgeBaseService = serviceFactory.getKnowledgeBaseService();

      const kb = await knowledgeBaseService.create(params);

      return { success: true, data: kb };
    } catch (error: any) {
      log.error('IPC: knowledge:local:create failed:', error);
      return { success: false, error: error.message || '创建知识库失败' };
    }
  });

  // 获取所有知识库
  ipcMain.handle('knowledge:local:findAll', async () => {
    try {
      log.info('IPC: knowledge:local:findAll');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const knowledgeBaseService = serviceFactory.getKnowledgeBaseService();

      const kbs = await knowledgeBaseService.findAllWithDocumentCount();
      
      return { success: true, data: kbs };
    } catch (error: any) {
      log.error('IPC: knowledge:local:findAll failed:', error);
      return { success: false, error: error.message || '获取知识库列表失败' };
    }
  });

  // 根据 ID 获取知识库
  ipcMain.handle('knowledge:local:findById', async (_event, id: string) => {
    try {
      log.info(`IPC: knowledge:local:findById - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const knowledgeBaseService = serviceFactory.getKnowledgeBaseService();

      const kb = await knowledgeBaseService.findById(id);
      
      if (!kb) {
        return { success: false, error: '知识库不存在' };
      }

      return { success: true, data: kb };
    } catch (error: any) {
      log.error('IPC: knowledge:local:findById failed:', error);
      return { success: false, error: error.message || '获取知识库失败' };
    }
  });

  // 更新知识库
  ipcMain.handle('knowledge:local:update', async (_event, id: string, params: { name?: string; description?: string }) => {
    try {
      log.info(`IPC: knowledge:local:update - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const knowledgeBaseService = serviceFactory.getKnowledgeBaseService();

      const kb = await knowledgeBaseService.update(id, params);
      
      if (!kb) {
        return { success: false, error: '知识库不存在' };
      }

      return { success: true, data: kb };
    } catch (error: any) {
      log.error('IPC: knowledge:local:update failed:', error);
      return { success: false, error: error.message || '更新知识库失败' };
    }
  });

  // 删除知识库
  ipcMain.handle('knowledge:local:delete', async (_event, id: string) => {
    try {
      log.info(`IPC: knowledge:local:delete - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const knowledgeBaseService = serviceFactory.getKnowledgeBaseService();

      await knowledgeBaseService.delete(id);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: knowledge:local:delete failed:', error);
      return { success: false, error: error.message || '删除知识库失败' };
    }
  });

  // 上传文档
  ipcMain.handle('knowledge:local:upload', async (_event, kbId: string, files: Array<{
    name: string;
    path?: string;
    type: string;
    size?: number;
    buffer?: number[];
  }>) => {
    try {
      log.info('========== 知识库上传开始 ==========');
      log.info(`IPC: knowledge:local:upload - KB: ${kbId}, files: ${files.length}`);
      log.info('Files info:', files.map(file => ({
        name: file?.name,
        type: file?.type,
        hasBuffer: !!file?.buffer,
        bufferLength: file?.buffer?.length,
        path: file?.path
      })));

      const user = await storageManager.getUser();
      if (!user) {
        log.error('❌ 用户未登录');
        return { success: false, error: '用户未登录' };
      }

      const validFiles = files.filter(file => (file?.path && fs.existsSync(file.path)) || (file?.buffer && file.buffer.length > 0));
      if (validFiles.length === 0) {
        log.error('❌ 未找到可上传的文件');
        return { success: false, error: '未找到可上传的文件，请重新选择' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const knowledgeBaseService = serviceFactory.getKnowledgeBaseService();

      const kb = await knowledgeBaseService.findById(kbId);
      if (!kb) {
        return { success: false, error: '知识库不存在' };
      }

      // 获取知识库存储目录
      const userDataPath = app.getPath('userData');
      const kbStoragePath = path.join(userDataPath, 'knowledge-base', kbId);
      
      // 确保目录存在
      if (!fs.existsSync(kbStoragePath)) {
        fs.mkdirSync(kbStoragePath, { recursive: true });
      }

      const uploadedDocs: any[] = [];
      const uploadErrors: string[] = [];

      for (const file of validFiles) {
        try {
          log.info(`========== 处理文档: ${file.name} ==========`);
          let contentBuffer: Buffer;

          if (file.buffer && file.buffer.length > 0) {
            contentBuffer = Buffer.from(file.buffer);
            log.info(`Using buffer data for ${file.name}, size: ${contentBuffer.length}`);
          } else if (file.path && fs.existsSync(file.path)) {
            contentBuffer = fs.readFileSync(file.path);
            log.info(`Reading from path ${file.path}, size: ${contentBuffer.length}`);
          } else {
            log.error(`No valid data source for ${file.name}, buffer: ${!!file.buffer}, path exists: ${file.path && fs.existsSync(file.path)}`);
            continue;
          }

          // 生成新文件名
          const ext = path.extname(file.name);
          const baseName = path.basename(file.name, ext);
          const newFileName = `${baseName}-${Date.now()}${ext}`;
          const destPath = path.join(kbStoragePath, newFileName);

          log.info(`Saving to: ${destPath}`);
          // 复制文件到知识库目录
          fs.writeFileSync(destPath, contentBuffer);

          // 解析文档内容（支持 txt, md, docx, pdf）
          const parsedContent = file.path && fs.existsSync(file.path)
            ? await parseDocumentContent(file.path, file.type)
            : await parseDocumentContentBuffer(contentBuffer, file.name, file.type);
          log.info(`Parsed document ${file.name}, content length: ${parsedContent.length}`);

          // 创建文档记录
          const doc = await knowledgeBaseService.uploadDocument({
            knowledgeBaseId: parseInt(kbId),
            filename: file.name,
            filepath: destPath,
            content: parsedContent,
            fileType: file.type,
            fileSize: file.size || contentBuffer.length
          });

          log.info(`Document record created: ${doc.id}`);
          uploadedDocs.push(doc);
        } catch (err: any) {
          const errorMessage = err?.message || '未知错误';
          log.error(`Failed to upload file ${file.name}:`, err);
          log.error('Error stack:', err?.stack);
          uploadErrors.push(`${file.name}: ${errorMessage}`);
        }
      }

      log.info('========== 知识库上传完成 ==========');
      log.info(`Upload complete: ${uploadedDocs.length} documents uploaded`);

      if (uploadedDocs.length === 0) {
        return { success: false, error: uploadErrors[0] ? `上传失败：${uploadErrors[0]}` : '上传失败，未写入任何文档' };
      }

      return { 
        success: true, 
        data: { 
          uploadedCount: uploadedDocs.length,
          documents: uploadedDocs 
        } 
      };
    } catch (error: any) {
      log.error('IPC: knowledge:local:upload failed:', error);
      return { success: false, error: error.message || '上传文档失败' };
    }
  });

  // 获取知识库文档列表
  ipcMain.handle('knowledge:local:getDocuments', async (_event, kbId: string) => {
    try {
      log.info(`IPC: knowledge:local:getDocuments - ${kbId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const knowledgeBaseService = serviceFactory.getKnowledgeBaseService();
      
      const docs = await knowledgeBaseService.getDocuments(parseInt(kbId));
      
      // 为每个文档添加内容预览
      const docsWithPreview = docs.map(doc => ({
        ...doc,
        content_preview: doc.content ? doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : '') : ''
      }));
      
      return { success: true, data: docsWithPreview };
    } catch (error: any) {
      log.error('IPC: knowledge:local:getDocuments failed:', error);
      return { success: false, error: error.message || '获取文档列表失败' };
    }
  });

  // 获取文档详情
  ipcMain.handle('knowledge:local:getDocument', async (_event, docId: string) => {
    try {
      log.info(`IPC: knowledge:local:getDocument - ${docId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const knowledgeBaseService = serviceFactory.getKnowledgeBaseService();
      
      const doc = await knowledgeBaseService.findDocumentById(parseInt(docId));
      if (!doc) {
        return { success: false, error: '文档不存在' };
      }

      return { success: true, data: doc };
    } catch (error: any) {
      log.error('IPC: knowledge:local:getDocument failed:', error);
      return { success: false, error: error.message || '获取文档失败' };
    }
  });

  // 删除文档
  ipcMain.handle('knowledge:local:deleteDocument', async (_event, docId: string) => {
    try {
      log.info(`IPC: knowledge:local:deleteDocument - ${docId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const knowledgeBaseService = serviceFactory.getKnowledgeBaseService();
      
      await knowledgeBaseService.deleteDocument(parseInt(docId));
      return { success: true };
    } catch (error: any) {
      log.error('IPC: knowledge:local:deleteDocument failed:', error);
      return { success: false, error: error.message || '删除文档失败' };
    }
  });

  // 搜索文档
  ipcMain.handle('knowledge:local:search', async (_event, kbId: string, query: string) => {
    try {
      log.info(`IPC: knowledge:local:search - KB: ${kbId}, query: ${query}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const knowledgeBaseService = serviceFactory.getKnowledgeBaseService();
      
      const results = await knowledgeBaseService.searchDocuments(query, parseInt(kbId));
      return { success: true, data: results };
    } catch (error: any) {
      log.error('IPC: knowledge:local:search failed:', error);
      return { success: false, error: error.message || '搜索文档失败' };
    }
  });

  // 解析文档内容
  ipcMain.handle('knowledge:local:parse', async (_event, filePath: string) => {
    try {
      log.info(`IPC: knowledge:local:parse - ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.pdf' ? 'application/pdf' : 
                       ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                       'text/plain';
      
      const parsedContent = await parseDocumentContent(filePath, mimeType);

      return { success: true, data: { content: parsedContent } };
    } catch (error: any) {
      log.error('IPC: knowledge:local:parse failed:', error);
      return { success: false, error: error.message || '解析文档失败' };
    }
  });

  // 获取知识库统计
  ipcMain.handle('knowledge:local:getStats', async () => {
    try {
      log.info('IPC: knowledge:local:getStats');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 设置用户 ID 并获取服务
      serviceFactory.setUserId(user.id);
      const knowledgeBaseService = serviceFactory.getKnowledgeBaseService();

      const stats = await knowledgeBaseService.getStats();
      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: knowledge:local:getStats failed:', error);
      return { success: false, error: error.message || '获取统计失败' };
    }
  });

  log.info('Local knowledge base IPC handlers registered (PostgreSQL)');
}
