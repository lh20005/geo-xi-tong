/**
 * 本地知识库 IPC 处理器
 * 处理知识库的本地 CRUD 操作
 * Requirements: Phase 6 - 注册 IPC 处理器
 */

import { ipcMain, app } from 'electron';
import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs';
import { knowledgeBaseService, CreateKnowledgeBaseParams } from '../../services';
import { storageManager } from '../../storage/manager';

/**
 * 注册本地知识库相关 IPC 处理器
 * 注意：这些处理器使用 'knowledge:local:' 前缀，与现有的服务器知识库处理器区分
 */
export function registerLocalKnowledgeHandlers(): void {
  log.info('Registering local knowledge base IPC handlers...');

  // 创建知识库
  ipcMain.handle('knowledge:local:create', async (_event, params: Omit<CreateKnowledgeBaseParams, 'user_id'>) => {
    try {
      log.info('IPC: knowledge:local:create');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const kb = knowledgeBaseService.create({
        ...params,
        user_id: user.id
      });

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

      const kbs = knowledgeBaseService.findAll(user.id);
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
      const kb = knowledgeBaseService.findById(id);
      
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
      const kb = knowledgeBaseService.update(id, params);
      
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

      const success = knowledgeBaseService.delete(id, user.id);
      
      if (!success) {
        return { success: false, error: '知识库不存在或无权删除' };
      }

      return { success: true };
    } catch (error: any) {
      log.error('IPC: knowledge:local:delete failed:', error);
      return { success: false, error: error.message || '删除知识库失败' };
    }
  });

  // 上传文档
  ipcMain.handle('knowledge:local:upload', async (_event, kbId: string, files: Array<{
    name: string;
    path: string;
    type: string;
  }>) => {
    try {
      log.info(`IPC: knowledge:local:upload - KB: ${kbId}, files: ${files.length}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const kb = knowledgeBaseService.findById(kbId);
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

      for (const file of files) {
        try {
          // 读取文件内容
          const content = fs.readFileSync(file.path);
          
          // 生成新文件名
          const ext = path.extname(file.name);
          const baseName = path.basename(file.name, ext);
          const newFileName = `${baseName}-${Date.now()}${ext}`;
          const destPath = path.join(kbStoragePath, newFileName);
          
          // 复制文件到知识库目录
          fs.writeFileSync(destPath, content);
          
          // 解析文档内容（简单实现，实际应使用 mammoth/pdf-parse）
          let parsedContent = '';
          if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
            parsedContent = content.toString('utf-8');
          } else if (file.name.endsWith('.md')) {
            parsedContent = content.toString('utf-8');
          }
          // TODO: 添加 docx/pdf 解析支持

          // 创建文档记录
          const doc = knowledgeBaseService.uploadDocument({
            knowledge_base_id: kbId,
            filename: file.name,
            file_type: file.type,
            file_size: content.length,
            content: parsedContent
          });

          uploadedDocs.push(doc);
        } catch (err: any) {
          log.error(`Failed to upload file ${file.name}:`, err);
        }
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
      
      const kbWithDocs = knowledgeBaseService.getWithDocuments(kbId);
      return { success: true, data: kbWithDocs?.documents || [] };
    } catch (error: any) {
      log.error('IPC: knowledge:local:getDocuments failed:', error);
      return { success: false, error: error.message || '获取文档列表失败' };
    }
  });

  // 获取文档详情
  ipcMain.handle('knowledge:local:getDocument', async (_event, docId: string) => {
    try {
      log.info(`IPC: knowledge:local:getDocument - ${docId}`);
      
      const doc = knowledgeBaseService.findDocumentById(docId);
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
      
      const success = knowledgeBaseService.deleteDocument(docId);
      return { success };
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
      
      const results = knowledgeBaseService.searchDocuments(user.id, query);
      // 过滤出属于指定知识库的文档
      const filtered = results.filter(doc => doc.knowledge_base_id === kbId);
      return { success: true, data: filtered };
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

      const content = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      let parsedContent = '';
      
      if (ext === '.txt' || ext === '.md') {
        parsedContent = content.toString('utf-8');
      } else if (ext === '.json') {
        parsedContent = JSON.stringify(JSON.parse(content.toString('utf-8')), null, 2);
      }
      // TODO: 添加 docx/pdf 解析支持

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

      const stats = knowledgeBaseService.getStats(user.id);
      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: knowledge:local:getStats failed:', error);
      return { success: false, error: error.message || '获取统计失败' };
    }
  });

  log.info('Local knowledge base IPC handlers registered');
}
