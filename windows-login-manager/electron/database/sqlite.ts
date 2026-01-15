/**
 * SQLite 数据库管理器
 * 负责数据库初始化、迁移和连接管理
 * Requirements: Phase 2 - Windows 端本地数据库
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import log from 'electron-log';

/**
 * SQLite 数据库管理器类
 */
class SQLiteManager {
  private static instance: SQLiteManager;
  private db: Database.Database | null = null;
  private dbPath: string = '';
  private initialized: boolean = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): SQLiteManager {
    if (!SQLiteManager.instance) {
      SQLiteManager.instance = new SQLiteManager();
    }
    return SQLiteManager.instance;
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      log.info('SQLite: Already initialized');
      return;
    }

    try {
      log.info('SQLite: Initializing database...');

      // 数据库存储在用户数据目录
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'geo-data.db');

      // 确保目录存在
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log.info(`SQLite: Created directory: ${dir}`);
      }

      log.info(`SQLite: Database path: ${this.dbPath}`);

      // 初始化数据库
      this.db = new Database(this.dbPath);

      // 启用外键约束
      this.db.pragma('foreign_keys = ON');

      // 启用 WAL 模式（提高并发性能）
      this.db.pragma('journal_mode = WAL');

      // 设置同步模式为 NORMAL（平衡性能和安全）
      this.db.pragma('synchronous = NORMAL');

      // 设置缓存大小（负数表示 KB）
      this.db.pragma('cache_size = -64000'); // 64MB

      log.info('SQLite: Database opened successfully');

      // 运行迁移
      await this.runMigrations();

      this.initialized = true;
      log.info('SQLite: Database initialized successfully');
    } catch (error) {
      log.error('SQLite: Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * 运行数据库迁移
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    log.info('SQLite: Running migrations...');

    // 创建迁移记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 获取迁移文件目录
    // 在开发环境和生产环境中路径不同
    let migrationsDir: string;
    
    if (app.isPackaged) {
      // 生产环境：迁移文件在 resources/migrations
      migrationsDir = path.join(process.resourcesPath, 'migrations');
    } else {
      // 开发环境：迁移文件在 electron/database/migrations
      migrationsDir = path.join(__dirname, 'migrations');
    }

    log.info(`SQLite: Migrations directory: ${migrationsDir}`);

    // 如果迁移目录不存在，创建它
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
      log.info('SQLite: Created migrations directory');
    }

    // 获取所有迁移文件
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    log.info(`SQLite: Found ${migrationFiles.length} migration files`);

    // 执行未应用的迁移
    for (const file of migrationFiles) {
      const applied = this.db.prepare(
        'SELECT 1 FROM _migrations WHERE name = ?'
      ).get(file);

      if (!applied) {
        log.info(`SQLite: Applying migration: ${file}`);
        
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        
        // 使用事务执行迁移
        const transaction = this.db.transaction(() => {
          this.db!.exec(sql);
          this.db!.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
        });

        try {
          transaction();
          log.info(`SQLite: Applied migration: ${file}`);
        } catch (error) {
          log.error(`SQLite: Failed to apply migration ${file}:`, error);
          throw error;
        }
      }
    }

    log.info('SQLite: Migrations completed');
  }

  /**
   * 获取数据库实例
   */
  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * 获取数据库路径
   */
  getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * 检查数据库是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      log.info('SQLite: Closing database connection');
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * 备份数据库
   */
  async backup(backupPath: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    log.info(`SQLite: Backing up database to: ${backupPath}`);

    // 确保备份目录存在
    const dir = path.dirname(backupPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 使用 better-sqlite3 的 backup API
    await this.db.backup(backupPath);

    log.info('SQLite: Backup completed');
  }

  /**
   * 从备份恢复数据库
   */
  async restore(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    log.info(`SQLite: Restoring database from: ${backupPath}`);

    // 关闭当前连接
    this.close();

    // 备份当前数据库
    const currentBackup = `${this.dbPath}.bak.${Date.now()}`;
    if (fs.existsSync(this.dbPath)) {
      fs.copyFileSync(this.dbPath, currentBackup);
      log.info(`SQLite: Current database backed up to: ${currentBackup}`);
    }

    try {
      // 复制备份文件到数据库路径
      fs.copyFileSync(backupPath, this.dbPath);

      // 重新初始化
      await this.initialize();

      log.info('SQLite: Restore completed');
    } catch (error) {
      log.error('SQLite: Restore failed, rolling back:', error);

      // 恢复原数据库
      if (fs.existsSync(currentBackup)) {
        fs.copyFileSync(currentBackup, this.dbPath);
        await this.initialize();
      }

      throw error;
    }
  }

  /**
   * 获取数据库统计信息
   */
  getStats(): {
    path: string;
    size: number;
    tables: string[];
    migrationCount: number;
  } {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // 获取文件大小
    const stats = fs.statSync(this.dbPath);

    // 获取所有表名
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_migrations'
      ORDER BY name
    `).all() as { name: string }[];

    // 获取迁移数量
    const migrationCount = this.db.prepare(
      'SELECT COUNT(*) as count FROM _migrations'
    ).get() as { count: number };

    return {
      path: this.dbPath,
      size: stats.size,
      tables: tables.map(t => t.name),
      migrationCount: migrationCount.count
    };
  }
}

// 导出单例实例
export const sqliteManager = SQLiteManager.getInstance();

// 导出数据库获取函数（便捷方法）
export function getDb(): Database.Database {
  return sqliteManager.getDatabase();
}

export { SQLiteManager };
