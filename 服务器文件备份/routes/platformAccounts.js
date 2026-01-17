"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const AccountService_1 = require("../services/AccountService");
const database_1 = require("../db/database");
const WebSocketService_1 = require("../services/WebSocketService");
const adminAuth_1 = require("../middleware/adminAuth");
const tenantContext_1 = require("../middleware/tenantContext");
const UsageTrackingService_1 = require("../services/UsageTrackingService");
const router = express_1.default.Router();
// 所有路由都需要认证和租户上下文
router.use(adminAuth_1.authenticate);
router.use(tenantContext_1.setTenantContext);
router.use(tenantContext_1.requireTenantContext);
/**
 * 获取所有平台配置
 */
router.get('/platforms', async (req, res) => {
    try {
        const result = await database_1.pool.query('SELECT * FROM platforms_config WHERE is_enabled = true ORDER BY platform_name');
        res.json({
            success: true,
            data: result.rows
        });
    }
    catch (error) {
        console.error('获取平台配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取平台配置失败'
        });
    }
});
/**
 * 获取所有账号
 */
router.get('/accounts', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const accounts = await AccountService_1.accountService.getAllAccounts(userId);
        res.json({
            success: true,
            data: accounts
        });
    }
    catch (error) {
        console.error('获取账号列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取账号列表失败'
        });
    }
});
/**
 * 根据平台ID获取账号
 */
router.get('/accounts/platform/:platformId', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const { platformId } = req.params;
        const accounts = await AccountService_1.accountService.getAccountsByPlatform(platformId, userId);
        res.json({
            success: true,
            data: accounts
        });
    }
    catch (error) {
        console.error('获取平台账号失败:', error);
        res.status(500).json({
            success: false,
            message: '获取平台账号失败'
        });
    }
});
/**
 * 获取账号详情（包含凭证）
 */
router.get('/accounts/:id', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const accountId = parseInt(req.params.id);
        const includeCredentials = req.query.includeCredentials === 'true';
        const account = await AccountService_1.accountService.getAccountById(accountId, userId, includeCredentials);
        if (!account) {
            return res.status(404).json({
                success: false,
                message: '账号不存在或无权访问'
            });
        }
        res.json({
            success: true,
            data: account
        });
    }
    catch (error) {
        console.error('获取账号详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取账号详情失败'
        });
    }
});
/**
 * 创建账号
 */
router.post('/accounts', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const { platform_id, account_name, credentials, real_username } = req.body;
        console.log('[创建账号] 开始处理请求');
        console.log('[创建账号] platform_id:', platform_id);
        console.log('[创建账号] account_name:', account_name);
        console.log('[创建账号] real_username:', real_username);
        console.log('[创建账号] userId:', userId);
        console.log('[创建账号] credentials 类型:', typeof credentials);
        console.log('[创建账号] credentials 是否有 cookies:', credentials?.cookies ? 'yes' : 'no');
        console.log('[创建账号] cookies 数量:', credentials?.cookies?.length || 0);
        if (!platform_id || !account_name || !credentials) {
            console.log('[创建账号] 缺少必需参数');
            return res.status(400).json({
                success: false,
                message: '缺少必需参数'
            });
        }
        // ========== 配额检查（仅对新账号） ==========
        // 先检查账号是否已存在
        const uniqueKey = real_username || account_name;
        const existingAccount = await database_1.pool.query('SELECT id FROM platform_accounts WHERE platform_id = $1 AND real_username = $2 AND user_id = $3', [platform_id, uniqueKey, userId]);
        const isNewAccount = existingAccount.rows.length === 0;
        if (isNewAccount) {
            const quota = await UsageTrackingService_1.usageTrackingService.checkQuota(userId, 'platform_accounts');
            console.log('[创建账号] 配额检查结果:', quota);
            // 注意：当 quotaLimit = -1 时表示无限制，remaining 也会是 -1
            // 所以需要特殊处理：只有当 quotaLimit > 0 且 remaining < 1 时才拒绝
            const isQuotaExceeded = quota.quotaLimit !== -1 && (!quota.hasQuota || quota.remaining < 1);
            if (isQuotaExceeded) {
                return res.status(403).json({
                    error: '平台账号配额不足',
                    message: `您的平台账号数量已达上限。当前 ${quota.currentUsage}/${quota.quotaLimit}`,
                    quota: {
                        current: quota.currentUsage,
                        total: quota.quotaLimit
                    }
                });
            }
        }
        console.log('[创建账号] 参数验证通过，开始创建/更新账号');
        // 使用 createOrUpdateAccount 实现去重
        let result;
        if (real_username) {
            result = await AccountService_1.accountService.createOrUpdateAccount({
                platform_id,
                account_name,
                credentials
            }, real_username, userId);
        }
        else {
            // 如果没有 real_username，使用 account_name 作为唯一标识
            result = await AccountService_1.accountService.createOrUpdateAccount({
                platform_id,
                account_name,
                credentials
            }, account_name, userId);
        }
        const { account, isNew } = result;
        console.log('[创建账号] 账号保存成功, ID:', account.id, 'isNew:', isNew);
        // ========== 记录配额使用（仅对新账号） ==========
        if (isNew) {
            await UsageTrackingService_1.usageTrackingService.recordUsage(userId, 'platform_accounts', 'platform_account', account.id, 1);
        }
        // 广播账号事件（只发送给当前用户）
        if (isNew) {
            (0, WebSocketService_1.getWebSocketService)().broadcastAccountEvent('created', account, userId);
        }
        else {
            (0, WebSocketService_1.getWebSocketService)().broadcastAccountEvent('updated', account, userId);
        }
        res.json({
            success: true,
            data: account,
            message: isNew ? '账号创建成功' : '账号已更新',
            isNew
        });
    }
    catch (error) {
        console.error('[创建账号] 失败:', error);
        console.error('[创建账号] 错误堆栈:', error.stack);
        res.status(400).json({
            success: false,
            message: error.message || '创建/更新账号失败',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
/**
 * 更新账号
 */
router.put('/accounts/:id', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const accountId = parseInt(req.params.id);
        const { account_name, credentials, real_username } = req.body;
        const account = await AccountService_1.accountService.updateAccountWithRealUsername(accountId, {
            account_name,
            credentials
        }, real_username || '', userId);
        // 广播账号更新事件（只发送给当前用户）
        (0, WebSocketService_1.getWebSocketService)().broadcastAccountEvent('updated', account, userId);
        res.json({
            success: true,
            data: account,
            message: '账号更新成功'
        });
    }
    catch (error) {
        console.error('更新账号失败:', error);
        res.status(400).json({
            success: false,
            message: error.message || '更新账号失败'
        });
    }
});
/**
 * 删除账号
 */
router.delete('/accounts/:id', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const accountId = parseInt(req.params.id);
        console.log(`[DELETE] 收到删除账号请求: ID=${accountId}, UserID=${userId}`);
        await AccountService_1.accountService.deleteAccount(accountId, userId);
        console.log(`[DELETE] 账号删除成功: ID=${accountId}`);
        // ========== 减少配额使用 ==========
        await UsageTrackingService_1.usageTrackingService.recordUsage(userId, 'platform_accounts', 'platform_account', accountId, -1 // 负数表示减少
        );
        // 广播账号删除事件（只发送给当前用户）
        (0, WebSocketService_1.getWebSocketService)().broadcastAccountEvent('deleted', { id: accountId }, userId);
        console.log(`[DELETE] WebSocket事件已广播: account.deleted, ID=${accountId}, UserID=${userId}`);
        res.json({
            success: true,
            message: '账号删除成功'
        });
    }
    catch (error) {
        console.error('[DELETE] 删除账号失败:', error);
        res.status(400).json({
            success: false,
            message: error.message || '删除账号失败'
        });
    }
});
/**
 * 设置默认账号
 */
router.post('/accounts/:id/set-default', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const accountId = parseInt(req.params.id);
        const { platform_id } = req.body;
        if (!platform_id) {
            return res.status(400).json({
                success: false,
                message: '缺少平台ID'
            });
        }
        await AccountService_1.accountService.setDefaultAccount(platform_id, accountId, userId);
        res.json({
            success: true,
            message: '默认账号设置成功'
        });
    }
    catch (error) {
        console.error('设置默认账号失败:', error);
        res.status(400).json({
            success: false,
            message: error.message || '设置默认账号失败'
        });
    }
});
/**
 * 测试账号登录
 */
router.post('/accounts/:id/test-login', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const accountId = parseInt(req.params.id);
        if (isNaN(accountId)) {
            return res.status(400).json({
                success: false,
                message: '无效的账号ID'
            });
        }
        console.log(`[API] 收到测试登录请求 - 账号ID: ${accountId}, 用户ID: ${userId}`);
        // 调用测试登录服务
        const result = await AccountService_1.accountService.testAccountLogin(accountId, userId);
        res.json(result);
    }
    catch (error) {
        console.error('[API] 测试登录失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '测试登录失败'
        });
    }
});
/**
 * 使用浏览器登录平台
 */
router.post('/browser-login', async (req, res) => {
    try {
        const userId = (0, tenantContext_1.getCurrentTenantId)(req);
        const { platform_id } = req.body;
        if (!platform_id) {
            return res.status(400).json({
                success: false,
                message: '缺少平台ID'
            });
        }
        // 获取平台配置
        const platformResult = await database_1.pool.query('SELECT * FROM platforms_config WHERE platform_id = $1 AND is_enabled = true', [platform_id]);
        if (platformResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '平台不存在或未启用'
            });
        }
        const platform = platformResult.rows[0];
        // 调用浏览器登录服务
        const result = await AccountService_1.accountService.loginWithBrowser(platform, userId);
        res.json(result);
    }
    catch (error) {
        console.error('浏览器登录失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '浏览器登录失败'
        });
    }
});
exports.default = router;
