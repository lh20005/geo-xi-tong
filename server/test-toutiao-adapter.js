/**
 * 头条适配器测试脚本
 * 
 * 使用方法：
 * node server/test-toutiao-adapter.js
 */

const { chromium } = require('playwright');
const path = require('path');

// 模拟文章数据
const testArticle = {
  title: '装修公司怎么选？这5个关键点一定要知道',
  content: `装修是一件大事，选择一家靠谱的装修公司至关重要。今天就来分享5个选择装修公司的关键点。

第一，看资质。正规的装修公司必须具备营业执照和建筑装饰装修资质证书。

第二，看口碑。可以通过网络评价、朋友推荐等方式了解装修公司的口碑。

第三，看案例。实地考察装修公司的施工现场和已完工的案例。

第四，看报价。对比多家装修公司的报价，注意是否有隐藏费用。

第五，看服务。了解装修公司的售后服务和保修政策。

![装修效果图](/uploads/test-image.jpg)

选择装修公司不能只看价格，更要看质量和服务。希望这些建议能帮到你！`,
  keyword: '装修公司'
};

async function testToutiaoAdapter() {
  console.log('🚀 开始测试头条适配器...\n');

  const browser = await chromium.launch({
    headless: false, // 显示浏览器窗口
    slowMo: 100 // 放慢操作速度，便于观察
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log('📝 测试文章信息：');
    console.log(`   标题: ${testArticle.title}`);
    console.log(`   关键词: ${testArticle.keyword}`);
    console.log(`   正文长度: ${testArticle.content.length} 字符\n`);

    // 第一步：导航到发布页面
    console.log('第一步：导航到发布页面');
    await page.goto('https://mp.toutiao.com/profile_v4/graphic/publish', { 
      waitUntil: 'networkidle' 
    });
    await page.waitForTimeout(3000);
    console.log('✅ 已到达发布页面\n');

    // 检查是否需要登录
    const needLogin = await page.getByText('登录').isVisible({ timeout: 3000 }).catch(() => false);
    if (needLogin) {
      console.log('⚠️  需要登录，请手动登录后继续...');
      console.log('💡 登录完成后，脚本将自动继续执行\n');
      
      // 等待用户登录（检测"文章"链接出现）
      await page.waitForSelector('a:has-text("文章")', { timeout: 120000 });
      console.log('✅ 登录成功\n');
    }

    // 第一步：点击"文章"链接
    console.log('第一步：点击文章链接');
    await page.waitForTimeout(3000);
    await page.getByRole('link', { name: '文章' }).click();
    console.log('✅ 已点击: 文章链接');
    await page.waitForTimeout(5000);

    // 第二步：关闭可能出现的抽屉遮罩，然后输入标题
    console.log('\n第二步：准备输入标题');
    
    // 尝试关闭抽屉遮罩（如果存在）
    try {
      const drawerMask = page.locator('.byte-drawer-mask');
      const isVisible = await drawerMask.isVisible({ timeout: 2000 }).catch(() => false);
      if (isVisible) {
        await page.waitForTimeout(3000);
        await drawerMask.click();
        console.log('✅ 已关闭抽屉遮罩');
        await page.waitForTimeout(5000);
      }
    } catch (e) {
      console.log('ℹ️  没有抽屉遮罩，继续执行');
    }

    // 点击标题输入框
    const titleInput = page.getByRole('textbox', { name: '请输入文章标题（2～30个字）' });
    await page.waitForTimeout(3000);
    await titleInput.click();
    console.log('✅ 已点击: 标题输入框');
    await page.waitForTimeout(5000);
    
    // 输入标题
    await titleInput.fill(testArticle.title);
    console.log(`✅ 已输入标题: ${testArticle.title}`);
    await page.waitForTimeout(5000);

    // 第三步：输入正文
    console.log('\n第三步：输入正文');
    
    // 点击正文编辑器
    await page.waitForTimeout(3000);
    await page.getByRole('paragraph').first().click();
    console.log('✅ 已点击: 正文编辑器');
    await page.waitForTimeout(5000);
    
    // 清理并输入正文（移除图片标记）
    const cleanContent = testArticle.content
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '') // 移除 Markdown 图片
      .replace(/<img[^>]*>/g, '') // 移除 HTML 图片
      .trim();
    
    const contentEditor = page.locator('.ProseMirror');
    await contentEditor.fill(cleanContent);
    console.log(`✅ 已输入正文 (${cleanContent.length} 字符)`);
    await page.waitForTimeout(5000);

    // 第四步：上传图片
    console.log('\n第四步：上传图片');
    console.log('⚠️  注意：需要准备一张测试图片');
    console.log('💡 请手动点击上传按钮并选择图片，或按 Ctrl+C 跳过此步骤\n');
    
    // 等待用户手动上传图片或跳过
    await page.waitForTimeout(15000);

    // 第五步：选择第一个复选框
    console.log('\n第五步：选择第一个复选框');
    await page.waitForTimeout(3000);
    await page.locator('.byte-checkbox-mask').first().click();
    console.log('✅ 已点击: 第一个复选框');
    await page.waitForTimeout(5000);

    // 第六步：选择第二个复选框
    console.log('\n第六步：选择第二个复选框');
    await page.waitForTimeout(3000);
    await page.locator('.byte-checkbox-group > span > .byte-checkbox > .byte-checkbox-wrapper > .byte-checkbox-mask').first().click();
    console.log('✅ 已点击: 第二个复选框');
    await page.waitForTimeout(5000);

    // 第七步：点击"预览并发布"按钮
    console.log('\n第七步：点击预览并发布');
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: '预览并发布' }).click();
    console.log('✅ 已点击: 预览并发布按钮');
    await page.waitForTimeout(5000);

    // 第八步：点击"确认发布"按钮
    console.log('\n第八步：点击确认发布');
    console.log('⚠️  即将发布文章，请确认是否继续...');
    console.log('💡 如果不想真的发布，请在 5 秒内按 Ctrl+C 终止脚本\n');
    await page.waitForTimeout(5000);
    
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: '确认发布' }).click();
    console.log('✅ 已点击: 确认发布按钮');
    await page.waitForTimeout(5000);

    // 验证发布结果
    console.log('\n验证发布结果...');
    await page.waitForTimeout(3000);
    
    const successTexts = ['发布成功', '发布完成', '已发布', '提交成功'];
    let success = false;
    
    for (const text of successTexts) {
      const hasText = await page.getByText(text).isVisible({ timeout: 3000 }).catch(() => false);
      if (hasText) {
        console.log(`✅ 发布成功（找到文本: ${text}）`);
        success = true;
        break;
      }
    }

    if (!success) {
      const currentUrl = page.url();
      console.log(`当前URL: ${currentUrl}`);
      
      if (currentUrl.includes('mp.toutiao.com')) {
        console.log('✅ 发布成功（停留在头条平台）');
        success = true;
      }
    }

    if (success) {
      console.log('\n🎉 测试完成！头条适配器工作正常');
    } else {
      console.log('\n⚠️  未找到明确的成功标志，请手动检查发布结果');
    }

    // 保持浏览器打开，便于查看结果
    console.log('\n💡 浏览器将保持打开状态，按 Ctrl+C 关闭');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    
    // 截图保存错误状态
    try {
      const screenshotPath = `error-toutiao-test-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 已保存错误截图: ${screenshotPath}`);
    } catch (e) {
      // 忽略截图错误
    }
  } finally {
    // 不自动关闭浏览器，便于查看结果
    // await browser.close();
  }
}

// 运行测试
testToutiaoAdapter().catch(console.error);
