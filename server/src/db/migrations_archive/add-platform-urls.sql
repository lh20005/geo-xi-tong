-- ==================== UP ====================
-- 添加平台 URL 字段
-- 用于登录和测试登录功能

-- 1. 添加 login_url 和 home_url 字段
ALTER TABLE platforms_config 
ADD COLUMN IF NOT EXISTS login_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS home_url VARCHAR(500);

-- 2. 更新所有平台的 URL 配置

-- 头条号
UPDATE platforms_config 
SET 
  login_url = 'https://mp.toutiao.com/auth/page/login/',
  home_url = 'https://mp.toutiao.com/profile_v4/index'
WHERE platform_id = 'toutiao';

-- 抖音号
UPDATE platforms_config 
SET 
  login_url = 'https://creator.douyin.com/auth',
  home_url = 'https://creator.douyin.com/creator-micro/home'
WHERE platform_id = 'douyin';

-- 小红书
UPDATE platforms_config 
SET 
  login_url = 'https://creator.xiaohongshu.com/login',
  home_url = 'https://creator.xiaohongshu.com/creator/home'
WHERE platform_id = 'xiaohongshu';

-- 微信公众号
UPDATE platforms_config 
SET 
  login_url = 'https://mp.weixin.qq.com/',
  home_url = 'https://mp.weixin.qq.com/'
WHERE platform_id = 'wechat';

-- 百家号
UPDATE platforms_config 
SET 
  login_url = 'https://baijiahao.baidu.com/builder/author/register/index',
  home_url = 'https://baijiahao.baidu.com/builder/rc/home'
WHERE platform_id = 'baijiahao';

-- 简书
UPDATE platforms_config 
SET 
  login_url = 'https://www.jianshu.com/sign_in',
  home_url = 'https://www.jianshu.com/writer'
WHERE platform_id = 'jianshu';

-- 知乎
UPDATE platforms_config 
SET 
  login_url = 'https://www.zhihu.com/signin',
  home_url = 'https://www.zhihu.com/creator'
WHERE platform_id = 'zhihu';

-- 企鹅号
UPDATE platforms_config 
SET 
  login_url = 'https://om.qq.com/userAuth/index',
  home_url = 'https://om.qq.com/article/articlePublish'
WHERE platform_id = 'qie';

-- 搜狐号 ⭐ 关键修复
UPDATE platforms_config 
SET 
  login_url = 'https://mp.sohu.com/mpfe/v4/login',
  home_url = 'https://mp.sohu.com/mpfe/v4/contentManagement/first/page'
WHERE platform_id = 'souhu';

-- 网易号
UPDATE platforms_config 
SET 
  login_url = 'https://mp.163.com/login.html',
  home_url = 'https://mp.163.com/v3/main/index.html'
WHERE platform_id = 'wangyi';

-- CSDN
UPDATE platforms_config 
SET 
  login_url = 'https://passport.csdn.net/login',
  home_url = 'https://mp.csdn.net/'
WHERE platform_id = 'csdn';

-- 哔哩哔哩
UPDATE platforms_config 
SET 
  login_url = 'https://passport.bilibili.com/login',
  home_url = 'https://member.bilibili.com/platform/home'
WHERE platform_id = 'bilibili';

-- 3. 添加注释
COMMENT ON COLUMN platforms_config.login_url IS '平台登录页面 URL';
COMMENT ON COLUMN platforms_config.home_url IS '平台主页/后台首页 URL，用于测试登录';

-- ==================== DOWN ====================
-- Rollback not implemented for this migration
