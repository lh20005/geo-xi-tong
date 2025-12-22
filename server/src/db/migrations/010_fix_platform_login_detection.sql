-- 修复平台登录检测配置
-- 问题：Windows 登录管理器的登录检测过于严格，导致登录成功但检测失败
-- 解决：简化检测逻辑，主要依赖 URL 变化检测（参考网页端成功经验）

-- 更新头条号配置：添加 successUrls 用于 URL 变化检测
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["mp.toutiao.com/profile_v4", "mp.toutiao.com/creator"]'::jsonb
)
WHERE platform_id = 'toutiao';

-- 更新抖音号配置：添加 successUrls
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["creator.douyin.com/creator-micro", "creator.douyin.com/home"]'::jsonb
)
WHERE platform_id = 'douyin';

-- 更新百家号配置：添加 successUrls
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["baijiahao.baidu.com/builder/rc/home"]'::jsonb
)
WHERE platform_id = 'baijiahao';

-- 更新网易号配置：添加 successUrls
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["mp.163.com/v3/main"]'::jsonb
)
WHERE platform_id = 'wangyi';

-- 更新搜狐号配置：添加 successUrls
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["mp.sohu.com/v2/main"]'::jsonb
)
WHERE platform_id = 'souhu';

-- 更新企鹅号配置：添加 successUrls
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["om.qq.com/article"]'::jsonb
)
WHERE platform_id = 'qie';

-- 更新微信公众号配置：添加 successUrls
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["mp.weixin.qq.com/cgi-bin"]'::jsonb
)
WHERE platform_id = 'wechat';

-- 更新小红书配置：添加 successUrls
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["creator.xiaohongshu.com/creator"]'::jsonb
)
WHERE platform_id = 'xiaohongshu';

-- 更新哔哩哔哩配置：添加 successUrls
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["member.bilibili.com/platform"]'::jsonb
)
WHERE platform_id = 'bilibili';

-- 更新知乎配置：添加 successUrls
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["www.zhihu.com/creator"]'::jsonb
)
WHERE platform_id = 'zhihu';

-- 更新简书配置：添加 successUrls
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["www.jianshu.com/writer"]'::jsonb
)
WHERE platform_id = 'jianshu';

-- 更新 CSDN 配置：添加 successUrls
UPDATE platforms_config 
SET selectors = jsonb_set(
  selectors,
  '{successUrls}',
  '["mp.csdn.net", "blog.csdn.net"]'::jsonb
)
WHERE platform_id = 'csdn';

-- 添加注释
COMMENT ON COLUMN platforms_config.selectors IS '平台选择器配置，包含：
- username: 用户名提取选择器数组
- loginSuccess: 登录成功检测选择器数组（元素检测）
- successUrls: 登录成功 URL 模式数组（URL 检测，优先级更高）';
