const puppeteer = require('puppeteer');
const axios = require('axios');

async function sendTelegramMessage(botToken, chatId, message) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown'
  }).catch(error => {
    console.error('Telegram 通知失败:', error.message);
  });
}

// 替代 waitForTimeout 的辅助函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 模拟人类行为的函数
async function simulateHumanBehavior(page) {
  console.log('开始模拟人类行为...');
  
  // 随机滚动页面
  await page.evaluate(() => {
    window.scrollTo(0, Math.random() * 300);
  });
  await delay(500 + Math.random() * 1000);
  
  console.log('人类行为模拟完成');
}

// 检查是否在 Cloudflare 挑战页面
async function isCloudflareChallenge(page) {
  const title = await page.title();
  const url = page.url();
  const pageContent = await page.content();
  
  return title.includes('Just a moment') || 
         title.includes('Checking') || 
         title.includes('Please Wait') ||
         url.includes('challenges') ||
         pageContent.includes('cf-browser-verification') ||
         pageContent.includes('cf_chl_prog');
}

// 等待 Cloudflare 挑战通过
async function waitForCloudflareChallenge(page, timeout = 60000) {
  console.log('等待 Cloudflare 挑战...');
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const isChallenge = await isCloudflareChallenge(page);
    
    if (!isChallenge) {
      console.log('Cloudflare 挑战已通过');
      return true;
    }
    
    console.log(`等待挑战中... (${Date.now() - startTime}ms)`);
    await delay(3000);
  }
  
  throw new Error(`Cloudflare 挑战超时 (${timeout}ms)`);
}

async function login() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });
  
  const page = await browser.newPage();
  
  // 隐藏自动化特征
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    
    Object.defineProperty(navigator, 'languages', {
      get: () => ['zh-CN', 'zh', 'en'],
    });
  });

  try {
    console.log('正在访问登录页面...');
    
    // 直接访问登录页面
    const loginUrl = `${process.env.WEBSITE_URL}/login`;
    await page.goto(loginUrl, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });

    // 等待 Cloudflare 挑战
    await waitForCloudflareChallenge(page);
    
    // 模拟人类行为
    await simulateHumanBehavior(page);
    
    // 等待登录表单加载
    console.log('等待登录表单...');
    
    // 尝试多种选择器
    const emailSelectors = ['#email', 'input[type="email"]', 'input[name="email"]', '[id*="email"]'];
    const passwordSelectors = ['#password', 'input[type="password"]', 'input[name="password"]', '[id*="password"]'];
    
    let emailField = null;
    let passwordField = null;
    
    for (const selector of emailSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        emailField = selector;
        break;
      } catch (e) {
        // 继续尝试下一个选择器
      }
    }
    
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        passwordField = selector;
        break;
      } catch (e) {
        // 继续尝试下一个选择器
      }
    }
    
    if (!emailField || !passwordField) {
      throw new Error('未找到登录表单');
    }
    
    console.log('输入邮箱...');
    await page.click(emailField);
    await delay(500);
    
    // 清空字段并输入
    await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) element.value = '';
    }, emailField);
    
    // 模拟人类输入
    const username = process.env.USERNAME;
    for (let char of username) {
      await page.type(emailField, char, { delay: 50 + Math.random() * 100 });
    }
    
    await delay(1000 + Math.random() * 1000);
    
    console.log('输入密码...');
    await page.click(passwordField);
    await delay(500);
    
    await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) element.value = '';
    }, passwordField);
    
    // 模拟人类输入
    const password = process.env.PASSWORD;
    for (let char of password) {
      await page.type(passwordField, char, { delay: 50 + Math.random() * 100 });
    }
    
    // 再次模拟人类行为
    await simulateHumanBehavior(page);
    
    console.log('寻找登录按钮...');
    
    // 尝试多种登录按钮选择器
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[type="button"]',
      '.btn',
      '.button',
      '[class*="login"]',
      '[class*="submit"]',
      '[onclick*="login"]'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      const button = await page.$(selector);
      if (button) {
        const isVisible = await button.isIntersectingViewport();
        if (isVisible) {
          submitButton = selector;
          break;
        }
      }
    }
    
    if (!submitButton) {
      throw new Error('未找到登录按钮');
    }
    
    console.log('点击登录按钮...');
    
    // 在点击登录前保存当前状态
    const beforeLoginUrl = page.url();
    
    await page.click(submitButton);
    
    // 等待可能的导航或页面变化
    console.log('等待登录处理...');
    await delay(5000);
    
    // 检查是否出现了 Cloudflare 挑战
    const hasChallengeAfterLogin = await isCloudflareChallenge(page);
    
    if (hasChallengeAfterLogin) {
      console.log('登录后出现 Cloudflare 挑战，等待通过...');
      await waitForCloudflareChallenge(page, 30000);
    }
    
    // 等待更长时间确保登录完成
    await delay(5000);
    
    // 检查当前页面状态
    const currentUrl = page.url();
    const title = await page.title();
    
    console.log('登录后 URL:', currentUrl);
    console.log('登录后标题:', title);
    
    // 如果还在登录页面，尝试直接访问目标页面
    if (currentUrl.includes('/login') || await isCloudflareChallenge(page)) {
      console.log('仍在登录页面或挑战页面，尝试直接访问目标服务器页面...');
      
      const targetUrl = `${process.env.WEBSITE_URL}/servers/45376`;
      await page.goto(targetUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      // 再次等待可能的挑战
      await waitForCloudflareChallenge(page, 30000);
      
      await delay(3000);
    }
    
    // 最终状态检查
    const finalUrl = page.url();
    const finalTitle = await page.title();
    const finalContent = await page.content();
    
    console.log('最终 URL:', finalUrl);
    console.log('最终标题:', finalTitle);
    
    // 检查登录成功的指标
    const isSuccess = 
      (finalUrl.includes('/servers/') || 
       finalUrl.includes('/dashboard') ||
       !finalUrl.includes('/login')) &&
      !finalTitle.includes('Just a moment') &&
      (finalContent.includes('Server Control') || 
       finalContent.includes('Betadash') ||
       finalContent.includes('Lunes') ||
       finalContent.includes('Panel') ||
       finalContent.includes('Dashboard'));
    
    if (isSuccess) {
      await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, 
        `*登录成功！*\n时间: ${new Date().toISOString()}\n最终页面: ${finalUrl}\n标题: ${finalTitle}`);
      console.log('登录成功！');
    } else {
      // 检查是否有错误信息
      const hasError = await page.evaluate(() => {
        const errorSelectors = ['.error', '.alert-danger', '.text-danger', '[class*="error"]'];
        for (const selector of errorSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) return element.textContent;
        }
        return null;
      });
      
      if (hasError) {
        throw new Error(`登录失败: ${hasError}`);
      } else if (await isCloudflareChallenge(page)) {
        throw new Error('登录被 Cloudflare 挑战阻挡');
      } else {
        throw new Error(`登录状态不确定。最终 URL: ${finalUrl}, 标题: ${finalTitle}`);
      }
    }

    console.log('脚本执行完成。');
    
  } catch (error) {
    // 保存截屏和页面HTML用于调试
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ path: `login-failure-${timestamp}.png`, fullPage: true });
    const htmlContent = await page.content();
    require('fs').writeFileSync(`login-debug-${timestamp}.html`, htmlContent);
    
    await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, 
      `*登录失败！*\n时间: ${new Date().toISOString()}\n错误: ${error.message}\n已保存调试信息`);
    
    console.error('登录失败：', error.message);
    console.error('截屏和HTML已保存');
    throw error;
  } finally {
    await browser.close();
  }
}

// 添加错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

login();
