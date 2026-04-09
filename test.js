const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  
  console.log('📱 测试手机端...');
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);
  
  // 检查大厅
  const title = await page.$('#lobby h1');
  if (title) {
    const text = await title.textContent();
    console.log('✅ 大厅标题:', text);
  }
  
  // 输入名字
  await page.fill('#pname', '测试玩家');
  await page.click('.btn-primary');
  console.log('✅ 点击开始游戏');
  
  await page.waitForTimeout(2000);
  
  // 检查3D场景
  const scene = await page.$('#scene');
  if (scene) {
    console.log('✅ 3D场景存在');
  }
  
  // 检查顶部栏
  const topBar = await page.$('#top-bar');
  if (topBar) {
    const text = await topBar.textContent();
    console.log('✅ 顶部栏:', text?.substring(0, 50));
  }
  
  // 检查玩家状态
  const playerCards = await page.$$('#players-bar .player-card');
  console.log('✅ 玩家卡片数量:', playerCards.length);
  
  // 检查骰子
  const dice = await page.$$('.dice');
  console.log('✅ 骰子数量:', dice.length);
  
  // 检查掷骰子按钮
  const rollBtn = await page.$('#btnRoll');
  if (rollBtn) {
    const disabled = await rollBtn.getAttribute('disabled');
    console.log('✅ 掷骰子按钮:', disabled ? '禁用' : '可用');
  }
  
  // 截图
  await page.screenshot({ path: '/tmp/monopoly-test.png' });
  console.log('✅ 截图保存: /tmp/monopoly-test.png');
  
  // 测试掷骰子
  if (rollBtn) {
    const isDisabled = await rollBtn.getAttribute('disabled');
    if (!isDisabled) {
      console.log('🎲 点击掷骰子...');
      await page.click('#btnRoll');
      await page.waitForTimeout(3000);
      
      // 检查移动后状态
      const playerCards2 = await page.$$('#players-bar .player-card');
      if (playerCards2.length > 0) {
        const card = playerCards2[0];
        const text = await card.textContent();
        console.log('✅ 玩家1状态:', text?.replace(/\n/g, ' '));
      }
    }
  }
  
  await page.screenshot({ path: '/tmp/monopoly-test2.png' });
  console.log('✅ 测试完成');
  
  await browser.close();
})();