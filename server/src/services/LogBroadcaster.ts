import { Response } from 'express';

/**
 * 日志广播器
 * 使用 Server-Sent Events (SSE) 实时推送发布日志
 */
export class LogBroadcaster {
  private clients: Map<string, Response[]> = new Map();

  /**
   * 添加客户端连接
   */
  addClient(taskId: number, res: Response): void {
    const key = taskId.toString();
    
    if (!this.clients.has(key)) {
      this.clients.set(key, []);
    }
    
    this.clients.get(key)!.push(res);
    console.log(`📡 客户端已连接到任务 #${taskId} 的日志流，当前连接数: ${this.clients.get(key)!.length}`);
  }

  /**
   * 移除客户端连接
   */
  removeClient(taskId: number, res: Response): void {
    const key = taskId.toString();
    const clients = this.clients.get(key);
    
    if (clients) {
      const index = clients.indexOf(res);
      if (index > -1) {
        clients.splice(index, 1);
        console.log(`📡 客户端已断开任务 #${taskId} 的日志流，剩余连接数: ${clients.length}`);
      }
      
      if (clients.length === 0) {
        this.clients.delete(key);
      }
    }
  }

  /**
   * 广播日志消息到所有监听该任务的客户端
   */
  broadcast(taskId: number, log: {
    level: string;
    message: string;
    timestamp: string;
    details?: any;
  }): void {
    const key = taskId.toString();
    const clients = this.clients.get(key);
    
    if (!clients || clients.length === 0) {
      return;
    }

    const data = JSON.stringify(log);
    const message = `data: ${data}\n\n`;

    // 发送给所有连接的客户端
    clients.forEach((client, index) => {
      try {
        client.write(message);
      } catch (error) {
        console.error(`❌ 发送日志到客户端 #${index} 失败:`, error);
        // 移除失败的连接
        clients.splice(index, 1);
      }
    });
  }

  /**
   * 获取当前连接数
   */
  getClientCount(taskId: number): number {
    const key = taskId.toString();
    return this.clients.get(key)?.length || 0;
  }

  /**
   * 清理所有连接
   */
  clearAll(): void {
    this.clients.forEach((clients, taskId) => {
      clients.forEach(client => {
        try {
          client.end();
        } catch (error) {
          console.error(`关闭客户端连接失败:`, error);
        }
      });
    });
    this.clients.clear();
    console.log('📡 所有日志流连接已清理');
  }
}

export const logBroadcaster = new LogBroadcaster();
