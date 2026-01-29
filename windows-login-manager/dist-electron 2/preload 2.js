"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// 创建 API 对象
const electronAPI = {
    // 系统功能
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
    // 系统登录
    login: (username, password) => electron_1.ipcRenderer.invoke('login', username, password),
    logout: () => electron_1.ipcRenderer.invoke('logout'),
    checkAuth: () => electron_1.ipcRenderer.invoke('check-auth'),
    // 平台登录
    loginPlatform: (platformId) => electron_1.ipcRenderer.invoke('login-platform', platformId),
    cancelLogin: (platformId) => electron_1.ipcRenderer.invoke('cancel-login', platformId),
    getLoginStatus: () => electron_1.ipcRenderer.invoke('get-login-status'),
    testAccountLogin: (accountId) => electron_1.ipcRenderer.invoke('test-account-login', accountId),
    // 平台列表
    getPlatforms: () => electron_1.ipcRenderer.invoke('get-platforms'),
    // 服务连通性
    checkServerHealth: () => electron_1.ipcRenderer.invoke('check-server-health'),
    // Dashboard
    getDashboardAllData: (params) => electron_1.ipcRenderer.invoke('dashboard:get-all', params),
    // 转化目标
    getConversionTargets: (params) => electron_1.ipcRenderer.invoke('conversion-targets:list', params),
    createConversionTarget: (payload) => electron_1.ipcRenderer.invoke('conversion-targets:create', payload),
    updateConversionTarget: (id, payload) => electron_1.ipcRenderer.invoke('conversion-targets:update', id, payload),
    deleteConversionTarget: (id) => electron_1.ipcRenderer.invoke('conversion-targets:delete', id),
    getConversionTarget: (id) => electron_1.ipcRenderer.invoke('conversion-targets:get', id),
    // 知识库管理
    getKnowledgeBases: () => electron_1.ipcRenderer.invoke('knowledge-base:list'),
    getKnowledgeBase: (id) => electron_1.ipcRenderer.invoke('knowledge-base:get', id),
    createKnowledgeBase: (payload) => electron_1.ipcRenderer.invoke('knowledge-base:create', payload),
    updateKnowledgeBase: (id, payload) => electron_1.ipcRenderer.invoke('knowledge-base:update', id, payload),
    deleteKnowledgeBase: (id) => electron_1.ipcRenderer.invoke('knowledge-base:delete', id),
    uploadKnowledgeBaseDocuments: (id, files) => electron_1.ipcRenderer.invoke('knowledge-base:upload-documents', id, files),
    getKnowledgeBaseDocument: (docId) => electron_1.ipcRenderer.invoke('knowledge-base:get-document', docId),
    deleteKnowledgeBaseDocument: (docId) => electron_1.ipcRenderer.invoke('knowledge-base:delete-document', docId),
    searchKnowledgeBaseDocuments: (id, query) => electron_1.ipcRenderer.invoke('knowledge-base:search-documents', id, query),
    // 账号管理
    getAccounts: () => electron_1.ipcRenderer.invoke('get-accounts'),
    deleteAccount: (accountId) => electron_1.ipcRenderer.invoke('delete-account', accountId),
    setDefaultAccount: (platformId, accountId) => electron_1.ipcRenderer.invoke('set-default-account', platformId, accountId),
    refreshAccounts: () => electron_1.ipcRenderer.invoke('refresh-accounts'),
    // 配置管理
    getConfig: () => electron_1.ipcRenderer.invoke('get-config'),
    setConfig: (config) => electron_1.ipcRenderer.invoke('set-config', config),
    clearCache: () => electron_1.ipcRenderer.invoke('clear-cache'),
    clearAllData: () => electron_1.ipcRenderer.invoke('clear-all-data'),
    // 日志管理
    getLogs: () => electron_1.ipcRenderer.invoke('get-logs'),
    exportLogs: () => electron_1.ipcRenderer.invoke('export-logs'),
    clearLogs: () => electron_1.ipcRenderer.invoke('clear-logs'),
    // 同步管理
    getSyncStatus: () => electron_1.ipcRenderer.invoke('get-sync-status'),
    triggerSync: () => electron_1.ipcRenderer.invoke('trigger-sync'),
    clearSyncQueue: () => electron_1.ipcRenderer.invoke('clear-sync-queue'),
    // WebSocket管理
    getWebSocketStatus: () => electron_1.ipcRenderer.invoke('get-websocket-status'),
    reconnectWebSocket: () => electron_1.ipcRenderer.invoke('reconnect-websocket'),
    onAccountEvent: (callback) => {
        const listener = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('account-event', listener);
        // 返回清理函数
        return () => {
            electron_1.ipcRenderer.removeListener('account-event', listener);
        };
    },
    // 存储管理
    storage: {
        getTokens: () => electron_1.ipcRenderer.invoke('storage:get-tokens'),
        saveTokens: (tokens) => electron_1.ipcRenderer.invoke('storage:save-tokens', tokens),
        clearTokens: () => electron_1.ipcRenderer.invoke('storage:clear-tokens'),
    },
    // 事件监听
    onTokensSaved: (callback) => {
        const listener = (_event, tokens) => callback(tokens);
        electron_1.ipcRenderer.on('tokens-saved', listener);
        // 返回清理函数
        return () => {
            electron_1.ipcRenderer.removeListener('tokens-saved', listener);
        };
    },
    // 软件更新
    updater: {
        getVersion: () => electron_1.ipcRenderer.invoke('updater:get-version'),
        getStatus: () => electron_1.ipcRenderer.invoke('updater:get-status'),
        checkForUpdates: () => electron_1.ipcRenderer.invoke('updater:check'),
        downloadUpdate: () => electron_1.ipcRenderer.invoke('updater:download'),
        installUpdate: () => electron_1.ipcRenderer.invoke('updater:install'),
        getInfo: () => electron_1.ipcRenderer.invoke('updater:get-info'),
        onStatusChanged: (callback) => {
            const listener = (_event, status) => callback(status);
            electron_1.ipcRenderer.on('updater:status-changed', listener);
            return () => {
                electron_1.ipcRenderer.removeListener('updater:status-changed', listener);
            };
        },
        onNavigateToUpdate: (callback) => {
            const listener = () => callback();
            electron_1.ipcRenderer.on('navigate-to-update', listener);
            return () => {
                electron_1.ipcRenderer.removeListener('navigate-to-update', listener);
            };
        },
    },
};
// 通过contextBridge安全地暴露API
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
// 同时暴露为 electron 别名，以兼容现有代码
electron_1.contextBridge.exposeInMainWorld('electron', electronAPI);
// 发布任务管理 API
const publishingAPI = {
    // 队列控制
    startQueue: () => electron_1.ipcRenderer.invoke('publishing:start-queue'),
    stopQueue: () => electron_1.ipcRenderer.invoke('publishing:stop-queue'),
    getQueueStatus: () => electron_1.ipcRenderer.invoke('publishing:get-queue-status'),
    // 任务执行
    executeTask: (taskId) => electron_1.ipcRenderer.invoke('publishing:execute-task', taskId),
    executeBatch: (batchId) => electron_1.ipcRenderer.invoke('publishing:execute-batch', batchId),
    stopTask: (taskId) => electron_1.ipcRenderer.invoke('publishing:stop-task', taskId),
    stopBatch: (batchId) => electron_1.ipcRenderer.invoke('publishing:stop-batch', batchId),
    // 状态管理
    forceCleanup: () => electron_1.ipcRenderer.invoke('publishing:force-cleanup'),
    getExecutionState: () => electron_1.ipcRenderer.invoke('publishing:get-execution-state'),
    // 事件监听
    onTaskLog: (callback) => {
        const listener = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('publishing:task-log', listener);
        return () => {
            electron_1.ipcRenderer.removeListener('publishing:task-log', listener);
        };
    },
    onTaskStatus: (callback) => {
        const listener = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('publishing:task-status', listener);
        return () => {
            electron_1.ipcRenderer.removeListener('publishing:task-status', listener);
        };
    },
    onQueueStatus: (callback) => {
        const listener = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('publishing:queue-status', listener);
        return () => {
            electron_1.ipcRenderer.removeListener('publishing:queue-status', listener);
        };
    },
};
// 暴露发布任务管理 API
electron_1.contextBridge.exposeInMainWorld('publishing', publishingAPI);
