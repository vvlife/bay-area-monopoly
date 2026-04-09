const { chromium } = require('playwright');
const BASE_URL = 'http://localhost:3001';

class GameTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = [];
    this.errors = [];
  }

  async setup() {
    console.log('🔧 初始化测试环境...');
    this.browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    this.page = await this.browser.newPage({ viewport: { width: 390, height: 844 } });
    this.page.on('console', msg => { if (msg.type() === 'error') this.errors.push(msg.text()); });
    this.page.on('pageerror', err => { this.errors.push(err.message); });
  }

  async teardown() { if (this.browser) await this.browser.close(); }

  async test(name, fn) {
    try {
      await fn();
      this.results.push({ name, status: 'PASS' });
      console.log(`  ✅ ${name}`);
    } catch (err) {
      this.results.push({ name, status: 'FAIL', error: err.message });
      console.log(`  ❌ ${name}: ${err.message}`);
    }
  }

  async initGame() {
    await this.page.goto(BASE_URL);
    await this.page.fill('#nm', '回归测试');
    await this.page.click('.btn');
    await this.page.waitForTimeout(4000);
    await this.page.evaluate(() => {
      if (typeof endTutorial === 'function') endTutorial();
      if (typeof skipTutorial === 'function') skipTutorial();
      localStorage.setItem('tutorialSeen', 'true');
    });
  }

  report() {
    console.log('\n' + '='.repeat(55));
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    console.log(`📊 结果: ${passed} 通过 / ${failed} 失败 / 共 ${this.results.length}`);
    if (failed > 0) {
      console.log('\n❌ 失败列表:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  • ${r.name}: ${r.error}`));
    }
    if (this.errors.length > 0) {
      console.log('\n⚠️ 页面错误:');
      this.errors.slice(0, 10).forEach(e => console.log(`  • ${e.substring(0, 80)}`));
    }
    console.log('='.repeat(55) + '\n');
    return failed === 0;
  }
}

async function runTests() {
  const t = new GameTester();
  try {
    await t.setup();

    // ========== 1. UI基础 ==========
    console.log('\n📱 [1/8] UI基础测试');
    await t.test('页面加载', async () => {
      await t.page.goto(BASE_URL);
      await t.page.waitForSelector('#nm', { timeout: 5000 });
    });
    await t.test('名称输入框存在', async () => {
      if (!await t.page.$('#nm')) throw '缺少输入框';
    });
    await t.test('开始按钮存在', async () => {
      if (!await t.page.$('.btn')) throw '缺少开始按钮';
    });

    // ========== 2. 游戏初始化 ==========
    console.log('\n🎮 [2/8] 游戏初始化测试');
    await t.initGame();
    await t.test('游戏对象初始化', async () => {
      const ok = await t.page.evaluate(() => typeof G !== 'undefined' && typeof CITIES !== 'undefined' && typeof INDUSTRY_TYPES !== 'undefined');
      if (!ok) throw 'G/CITIES/INDUSTRY_TYPES 未定义';
    });
    await t.test('城市数量=11', async () => {
      const n = await t.page.evaluate(() => CITIES.length);
      if (n !== 11) throw `城市数=${n}`;
    });
    await t.test('玩家数量=2', async () => {
      const n = await t.page.evaluate(() => G.ps.length);
      if (n !== 2) throw `玩家数=${n}`;
    });
    await t.test('初始年份=1990', async () => {
      const y = await t.page.evaluate(() => G.year);
      if (y !== 1990) throw `年份=${y}`;
    });
    await t.test('初始行动点=1', async () => {
      const a = await t.page.evaluate(() => G.ap);
      if (a !== 1) throw `行动点=${a}`;
    });
    await t.test('起始城市=香港', async () => {
      const c = await t.page.evaluate(() => CITIES[G.ps[0].pos].n);
      if (c !== '香港') throw `起始城市=${c}`;
    });

    // ========== 3. 移动功能 ==========
    console.log('\n🚶 [3/8] 移动功能测试');
    await t.test('点击移动进入move阶段', async () => {
      await t.page.click('#btn-move');
      await t.page.waitForTimeout(500);
      const p = await t.page.evaluate(() => G.ph);
      if (p !== 'move') throw `phase=${p}`;
    });
    await t.test('高亮相邻城市', async () => {
      const h = await t.page.evaluate(() => G.highlighted);
      if (!h || h.length === 0) throw `高亮数=${h?.length || 0}`;
    });
    await t.test('相邻城市包含深圳(0)', async () => {
      const adj = await t.page.evaluate(() => CITIES[G.ps[0].pos].adj);
      if (!adj.includes(0)) throw `adj=${JSON.stringify(adj)}`;
    });
    await t.test('直接调用handleCityClick(0)移动成功', async () => {
      await t.page.evaluate(() => handleCityClick(0));
      await t.page.waitForTimeout(300);
      const pos = await t.page.evaluate(() => G.ps[0].pos);
      if (pos !== 0) throw `pos=${pos}`;
    });
    await t.test('移动后行动点-1', async () => {
      // 需要重新初始化来测试
      await t.initGame();
      await t.page.evaluate(() => handleCityClick(0));
      const ap = await t.page.evaluate(() => G.ap);
      if (ap !== 0) throw `ap=${ap}`;
    });

    // ========== 4. 自动结束回合 ==========
    console.log('\n⏭️ [4/8] 自动结束回合测试');
    await t.test('checkAutoEndTurn函数存在', async () => {
      const ok = await t.page.evaluate(() => typeof checkAutoEndTurn === 'function');
      if (!ok) throw '函数不存在';
    });
    await t.test('行动点为0时自动结束', async () => {
      await t.page.evaluate(() => { G.ap = 0; G.ph = 'action'; checkAutoEndTurn(); });
      await t.page.waitForTimeout(500);
      const cp = await t.page.evaluate(() => G.cp);
      if (cp !== 1) throw `cp=${cp}, 未切换到AI`;
    });

    // ========== 5. 城市面板与产业 ==========
    console.log('\n🏗️ [5/8] 城市面板与产业测试');
    await t.initGame();
    await t.test('showCityPanel函数存在', async () => {
      const ok = await t.page.evaluate(() => typeof showCityPanel === 'function');
      if (!ok) throw '函数不存在';
    });
    await t.test('城市面板可打开', async () => {
      await t.page.evaluate(() => showCityPanel(CITIES[0]));
      await t.page.waitForTimeout(300);
      const vis = await t.page.evaluate(() => document.getElementById('city-panel').style.display !== 'none');
      if (!vis) throw '面板未显示';
    });
    await t.test('产业类型=5种', async () => {
      const n = await t.page.evaluate(() => Object.keys(INDUSTRY_TYPES).length);
      if (n !== 5) throw `产业数=${n}`;
    });
    await t.test('深圳科技适配+50%', async () => {
      const b = await t.page.evaluate(() => INDUSTRY_TYPES.tech.cityBonus['深圳']);
      if (b !== 1.5) throw `bonus=${b}`;
    });
    await t.test('香港金融适配+60%', async () => {
      const b = await t.page.evaluate(() => INDUSTRY_TYPES.finance.cityBonus['香港']);
      if (b !== 1.6) throw `bonus=${b}`;
    });
    await t.test('香港制造适配-40%', async () => {
      const b = await t.page.evaluate(() => INDUSTRY_TYPES.manufacturing.cityBonus['香港']);
      if (b !== 0.6) throw `bonus=${b}`;
    });
    await t.test('城市有槽位数据', async () => {
      const ok = await t.page.evaluate(() => CITIES.every(c => Array.isArray(c.slots) && c.slots.length > 0));
      if (!ok) throw '部分城市缺少槽位';
    });

    // ========== 6. 事件系统 ==========
    console.log('\n📢 [6/8] 事件系统测试');
    await t.test('DECADE_EVENTS存在且非空', async () => {
      const n = await t.page.evaluate(() => Object.keys(DECADE_EVENTS).length);
      if (n === 0) throw '无事件数据';
    });
    await t.test('事件有icon和flavor字段', async () => {
      const ok = await t.page.evaluate(() => {
        return Object.values(DECADE_EVENTS).flat().every(e => e.icon && e.flavor);
      });
      if (!ok) throw '部分事件缺少icon/flavor';
    });
    await t.test('事件弹窗可触发', async () => {
      await t.page.evaluate(() => showEventModal({
        title: '测试', desc: '测试', icon: '📢', good: true, cities: ['深圳'], flavor: '测试效果'
      }));
      await t.page.waitForTimeout(300);
      const vis = await t.page.evaluate(() => document.getElementById('modal').classList.contains('show'));
      if (!vis) throw '弹窗未显示';
    });
    await t.test('产业修正变量存在', async () => {
      const ok = await t.page.evaluate(() => typeof industryModifiers === 'object');
      if (!ok) throw 'industryModifiers不存在';
    });

    // ========== 7. 操作记录 ==========
    console.log('\n💬 [7/8] 操作记录测试');
    await t.test('logAction函数存在', async () => {
      const ok = await t.page.evaluate(() => typeof logAction === 'function');
      if (!ok) throw '函数不存在';
    });
    await t.test('getActionIcon函数存在', async () => {
      const ok = await t.page.evaluate(() => typeof getActionIcon === 'function');
      if (!ok) throw '函数不存在';
    });
    await t.test('记录操作后数量增加', async () => {
      const before = await t.page.evaluate(() => gameActions.length);
      await t.page.evaluate(() => logAction('测试', 'move', '测试操作'));
      const after = await t.page.evaluate(() => gameActions.length);
      if (after <= before) throw `before=${before}, after=${after}`;
    });
    await t.test('聊天区显示操作', async () => {
      const chatVisible = await t.page.evaluate(() => document.getElementById('chat-box').classList.contains('show'));
      if (!chatVisible) throw '聊天区未自动展开';
    });

    // ========== 8. 3D场景与新手引导 ==========
    console.log('\n🎨 [8/8] 3D场景与引导测试');
    await t.test('3D场景初始化', async () => {
      const ok = await t.page.evaluate(() => typeof scene !== 'undefined' && typeof camera !== 'undefined' && typeof renderer !== 'undefined');
      if (!ok) throw '3D对象未初始化';
    });
    await t.test('城市3D模型=11个', async () => {
      const n = await t.page.evaluate(() => Object.keys(cityMeshes).length);
      if (n !== 11) throw `模型数=${n}`;
    });
    await t.test('玩家模型存在', async () => {
      const n = await t.page.evaluate(() => playerModels.length);
      if (n !== 2) throw `玩家模型数=${n}`;
    });
    await t.test('startTutorial函数存在', async () => {
      const ok = await t.page.evaluate(() => typeof startTutorial === 'function');
      if (!ok) throw '函数不存在';
    });
    await t.test('引导步骤>=5', async () => {
      const n = await t.page.evaluate(() => TUTORIAL_STEPS.length);
      if (n < 5) throw `步骤数=${n}`;
    });
    await t.test('引导弹窗可打开', async () => {
      await t.page.evaluate(() => startTutorial());
      await t.page.waitForTimeout(300);
      const vis = await t.page.evaluate(() => document.getElementById('tutorial-overlay').style.display !== 'none');
      if (!vis) throw '引导弹窗未显示';
    });
    await t.test('引导可关闭', async () => {
      await t.page.evaluate(() => skipTutorial());
      await t.page.waitForTimeout(300);
      const vis = await t.page.evaluate(() => document.getElementById('tutorial-overlay').style.display === 'none');
      if (!vis) throw '引导弹窗未关闭';
    });

    // ========== 截图 ==========
    console.log('\n📸 截图记录');
    await t.initGame();
    await t.page.screenshot({ path: '/tmp/test-final.png', fullPage: true });
    console.log('  📸 截图保存: /tmp/test-final.png');

  } catch (err) {
    console.error('致命错误:', err);
  } finally {
    await t.teardown();
  }

  const ok = t.report();
  process.exit(ok ? 0 : 1);
}

runTests().catch(console.error);
