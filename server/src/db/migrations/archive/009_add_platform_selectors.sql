-- 添加平台选择器配置字段
-- 用于 Windows 登录管理器提取用户信息

-- 1. 添加 selectors 字段（JSONB 类型，支持复杂的选择器配置）
ALTER TABLE platforms_config 
ADD COLUMN IF NOT EXISTS selectors JSONB DEFAULT '{}'::jsonb;

-- 2. 添加 login_url 字段（如果不存在）
ALTER TABLE platforms_config 
ADD COLUMN IF NOT EXISTS login_url VARCHAR(255);

-- 3. 更新各平台的选择器配置和登录URL
-- 头条号
UPDATE platforms_config 
SET 
  login_url = 'https://mp.toutiao.com/auth/page/login',
  selectors = '{
    "username": [
      ".auth-avator-name",
      ".user-name",
      ".username",
      ".account-name",
      "[class*=\"username\"]",
      "[class*=\"user-name\"]",
      ".semi-navigation-header-username"
    ],
    "loginSuccess": [
      ".user-avatar",
      ".auth-avator-name",
      ".semi-navigation-header-username"
    ]
  }'::jsonb
WHERE platform_id = 'toutiao';

-- 抖音号
UPDATE platforms_config 
SET 
  login_url = 'https://creator.douyin.com/',
  selectors = '{
    "username": [
      ".name-_lSSDc",
      ".header-_F2uzl .name-_lSSDc",
      ".left-zEzdJX .name-_lSSDc",
      "[class*=\"name-\"][class*=\"_\"]",
      ".semi-navigation-header-username",
      ".username",
      ".user-name",
      "[class*=\"username\"]",
      "[class*=\"user-name\"]"
    ],
    "loginSuccess": [
      ".name-_lSSDc",
      ".semi-navigation-header-username",
      "[class*=\"name-\"]"
    ]
  }'::jsonb
WHERE platform_id = 'douyin';

-- 百家号
UPDATE platforms_config 
SET 
  login_url = 'https://baijiahao.baidu.com/builder/author/register/index',
  selectors = '{
    "username": [
      ".author-name",
      ".user-name",
      ".username"
    ],
    "loginSuccess": [
      ".author-name",
      ".user-info"
    ]
  }'::jsonb
WHERE platform_id = 'baijiahao';

-- 网易号
UPDATE platforms_config 
SET 
  login_url = 'https://mp.163.com/login.html',
  selectors = '{
    "username": [
      ".user-info .name",
      ".user-name",
      ".username"
    ],
    "loginSuccess": [
      ".user-info",
      ".user-name"
    ]
  }'::jsonb
WHERE platform_id = 'wangyi';

-- 搜狐号
UPDATE platforms_config 
SET 
  login_url = 'https://mp.sohu.com/login',
  selectors = '{
    "username": [
      ".user-name",
      ".username",
      ".account-name"
    ],
    "loginSuccess": [
      ".user-name",
      ".user-info"
    ]
  }'::jsonb
WHERE platform_id = 'souhu';

-- 企鹅号
UPDATE platforms_config 
SET 
  login_url = 'https://om.qq.com/userAuth/index',
  selectors = '{
    "username": [
      ".user-info-name",
      ".user-name",
      ".username"
    ],
    "loginSuccess": [
      ".user-info-name",
      ".user-info"
    ]
  }'::jsonb
WHERE platform_id = 'qie';

-- 微信公众号
UPDATE platforms_config 
SET 
  login_url = 'https://mp.weixin.qq.com/',
  selectors = '{
    "username": [
      ".account_info_title",
      ".user-name",
      ".username"
    ],
    "loginSuccess": [
      ".account_info_title",
      ".account_setting"
    ]
  }'::jsonb
WHERE platform_id = 'wechat';

-- 小红书
UPDATE platforms_config 
SET 
  login_url = 'https://creator.xiaohongshu.com/login',
  selectors = '{
    "username": [
      ".username",
      ".user-name",
      ".nickname"
    ],
    "loginSuccess": [
      ".username",
      ".user-info"
    ]
  }'::jsonb
WHERE platform_id = 'xiaohongshu';

-- 哔哩哔哩
UPDATE platforms_config 
SET 
  login_url = 'https://passport.bilibili.com/login',
  selectors = '{
    "username": [
      ".user-name",
      ".username",
      ".uname"
    ],
    "loginSuccess": [
      ".user-name",
      ".header-info-ctnr"
    ]
  }'::jsonb
WHERE platform_id = 'bilibili';

-- 知乎
UPDATE platforms_config 
SET 
  login_url = 'https://www.zhihu.com/signin',
  selectors = '{
    "username": [
      ".AppHeader-profile",
      ".username",
      ".user-name"
    ],
    "loginSuccess": [
      ".AppHeader-profile",
      ".Avatar"
    ]
  }'::jsonb
WHERE platform_id = 'zhihu';

-- 简书
UPDATE platforms_config 
SET 
  login_url = 'https://www.jianshu.com/sign_in',
  selectors = '{
    "username": [
      ".user-name",
      ".username",
      ".nickname"
    ],
    "loginSuccess": [
      ".user-name",
      ".avatar"
    ]
  }'::jsonb
WHERE platform_id = 'jianshu';

-- CSDN
UPDATE platforms_config 
SET 
  login_url = 'https://passport.csdn.net/login',
  selectors = '{
    "username": [
      ".user-name",
      ".username",
      ".nick-name"
    ],
    "loginSuccess": [
      ".user-name",
      ".user-info"
    ]
  }'::jsonb
WHERE platform_id = 'csdn';

-- 添加注释
COMMENT ON COLUMN platforms_config.selectors IS '平台选择器配置，包含 username（用户名提取）和 loginSuccess（登录成功检测）选择器数组';
COMMENT ON COLUMN platforms_config.login_url IS '平台登录页面URL';
