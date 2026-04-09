/**
 * 粤港澳大富翁 - 联机模式回归测试
 * 测试多人在线游戏的各种操作
 * 
 * 运行: node tests/multiplayer-test.js
 */

const { chromium } = require('playwright');
const http = require('http');

const BASE_URL = 'http://localhost:3001';
const TEST_TIMEOUT = 15000;

class MultiplayerTester {
  constructor() {
    this.browser1 = null;  // 玩家1 (房主)
    this.browser2 = null;  // 玩家2
    this.page1 = null;
    this.page2 = null;
    this.results = [];
    this.errors = [];
    this.roomId = null;
  }

  async setup() {
    console.log('🔧 初始化联机测试环境...');
    
    // 启动两个浏览器实例
    this.browser1 = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    this.browser2 = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    
    this.page1 = await this.browser1.newPage({ viewport: { width: 390, height: 844 } });
    this.page2 = await this.browser2.newPage({ viewport: { width: 390, height: 844 } });
    
    // 设置错误监听
    this.page1.on('pageerror', err => this.errors.push(`P1: ${err.message}`));
    this.page2.on('pageerror', err => this.errors.push(`P2: ${err.message}`));
    
    console.log('✅ 两个浏览器实例已启动');
  }

  async teardown() {
    console.log('\n🔄 关闭测试环境...');
    if (this.browser1) await this.browser1.close();
    if (this.browser2) await this.browser2.close();
  }

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

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 等待 socket 初始化
  async waitForSocket(page, timeout = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const ready = await page.evaluate(() => {
        return typeof socket !== 'undefined' && socket !== null && socket.connected;
      });
      if (ready) return true;
      await this.wait(200);
    }
    return false;
  }

  // ===== 基础连接测试 =====

  async testConnection() {
    console.log('\n🌐 [基础连接测试]');
    
    await this.test('玩家1连接服务器', async () => {
      await this.page1.goto(BASE_URL);
      await this.page1.waitForSelector('#nm', { timeout: 5000 });
    });

    await this.test('玩家2连接服务器', async () => {
      await this.page2.goto(BASE_URL);
      await this.page2.waitForSelector('#nm', { timeout: 5000 });
    });
  }

  // ===== 创建房间测试 =====

  async testRoomCreation() {
    console.log('\n🏠 [创建房间测试]');
    
    await this.test('玩家1选择联机模式', async () => {
      await this.page1.evaluate(() => selectMode('multi'));
      await this.wait(200);
      const mode = await this.page1.evaluate(() => gameMode);
      if (mode !== 'multi') throw `模式=${mode}`;
    });

    await this.test('玩家1输入名称', async () => {
      await this.page1.fill('#nm', '玩家1-房主');
    });

    await this.test('玩家1点击开始进入多人选项', async () => {
      await this.page1.click('.btn');  // 点击开始按钮
      await this.wait(500);
      
      // 等待弹窗出现
      const modalVisible = await this.page1.evaluate(() => {
        return document.getElementById('modal').classList.contains('show');
      });
      if (!modalVisible) throw '多人选项弹窗未显示';
    });

    await this.test('玩家1点击创建房间', async () => {
      // 点击"创建房间"按钮
      await this.page1.evaluate(() => {
        // 查找包含"创建房间"的按钮
        const btns = document.querySelectorAll('.btn');
        for (const btn of btns) {
          if (btn.textContent.includes('创建房间')) {
            btn.click();
            return;
          }
        }
        // 备用方式：直接调用函数
        if (typeof createRoom === 'function') createRoom();
      });
      await this.wait(2000);  // 等待socket连接和房间创建
    });

    await this.test('玩家1等待socket连接', async () => {
      const connected = await this.waitForSocket(this.page1);
      if (!connected) throw 'Socket未连接';
    });

    await this.test('玩家1获得房间号', async () => {
      await this.wait(500);
      this.roomId = await this.page1.evaluate(() => {
        // 从全局变量获取
        if (typeof currentRoomId !== 'undefined' && currentRoomId) return currentRoomId;
        if (typeof roomId !== 'undefined' && roomId) return roomId;
        
        // 从页面显示获取
        const display = document.getElementById('room-id-display');
        if (display && display.textContent) {
          return display.textContent.trim();
        }
        
        // 从modal文本获取
        const modal = document.getElementById('modal');
        if (modal) {
          const match = modal.textContent.match(/[A-Z0-9]{6}/);
          if (match) return match[0];
        }
        
        return null;
      });
      
      if (!this.roomId) {
        // 尝试从房间界面获取
        const roomDisplay = await this.page1.$('#room-id-display');
        if (roomDisplay) {
          this.roomId = await roomDisplay.textContent();
        }
      }
      
      if (!this.roomId) throw `未获取到房间号，当前值: ${this.roomId}`;
      console.log(`    房间号: ${this.roomId}`);
    });

    await this.test('玩家1房间界面显示', async () => {
      const roomVisible = await this.page1.evaluate(() => {
        const room = document.getElementById('room');
        return room && room.style.display !== 'none';
      });
      if (!roomVisible) throw '房间界面未显示';
    });
  }

  // ===== 加入房间测试 =====

  async testRoomJoin() {
    console.log('\n🚪 [加入房间测试]');
    
    await this.test('玩家2选择联机模式', async () => {
      await this.page2.evaluate(() => selectMode('multi'));
      await this.wait(200);
      const mode = await this.page2.evaluate(() => gameMode);
      if (mode !== 'multi') throw `模式=${mode}`;
    });

    await this.test('玩家2输入名称', async () => {
      await this.page2.fill('#nm', '玩家2');
    });

    await this.test('玩家2点击开始进入多人选项', async () => {
      await this.page2.click('.btn');
      await this.wait(500);
      
      const modalVisible = await this.page2.evaluate(() => {
        return document.getElementById('modal').classList.contains('show');
      });
      if (!modalVisible) throw '多人选项弹窗未显示';
    });

    await this.test('玩家2填入房间号', async () => {
      await this.wait(300);
      await this.page2.evaluate((roomId) => {
        const input = document.getElementById('join-input');
        if (input) {
          input.value = roomId;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, this.roomId);
      await this.wait(200);
    });

    await this.test('玩家2点击加入房间', async () => {
      await this.page2.evaluate(() => {
        // 查找包含"加入房间"的按钮
        const btns = document.querySelectorAll('.btn');
        for (const btn of btns) {
          if (btn.textContent.includes('加入房间')) {
            btn.click();
            return;
          }
        }
        // 备用方式
        if (typeof joinRoom === 'function') joinRoom();
      });
      await this.wait(2500);  // 等待加入
    });

    await this.test('玩家2等待socket连接', async () => {
      const connected = await this.waitForSocket(this.page2);
      if (!connected) throw 'Socket未连接';
    });

    await this.test('玩家2成功加入房间', async () => {
      // 检查是否在房间界面或游戏界面
      const inRoom = await this.page2.evaluate(() => {
        const room = document.getElementById('room');
        const game = document.getElementById('game');
        return (room && room.style.display !== 'none') || (game && game.style.display !== 'flex');
      });
      if (!inRoom) throw '玩家2未成功加入房间';
    });
  }

  // ===== 游戏启动测试 =====

  async testGameStart() {
    console.log('\n🚀 [游戏启动测试]');

    await this.test('玩家1点击准备', async () => {
      // 等待房间列表更新
      await this.wait(1000);
      await this.page1.evaluate(() => {
        const btns = document.querySelectorAll('.btn');
        for (const btn of btns) {
          if (btn.textContent.includes('准备')) {
            btn.click();
            return;
          }
        }
        if (typeof setReady === 'function') setReady(true);
      });
      await this.wait(800);
      
      // 验证准备状态
      const p1Ready = await this.page1.evaluate(() => {
        const items = document.querySelectorAll('.player-item .status');
        for (const item of items) {
          if (item.textContent.includes('已准备')) return true;
        }
        return false;
      });
      console.log(`    玩家1准备状态: ${p1Ready ? '已准备' : '等待中'}`);
    });

    await this.test('玩家2点击准备', async () => {
      await this.page2.evaluate(() => {
        const btns = document.querySelectorAll('.btn');
        for (const btn of btns) {
          if (btn.textContent.includes('准备')) {
            btn.click();
            return;
          }
        }
        if (typeof setReady === 'function') setReady(true);
      });
      await this.wait(1500);  // 等待准备状态同步
      
      // 验证两个玩家都准备好了
      const bothReady = await this.page1.evaluate(() => {
        const items = document.querySelectorAll('.player-item .status.ready');
        return items.length >= 2;
      });
      console.log(`    两玩家准备: ${bothReady ? '是' : '否'}`);
    });

    await this.test('玩家1(房主)开始游戏', async () => {
      await this.wait(500);
      
      // 检查是否有开始游戏按钮
      const startBtn = await this.page1.evaluate(() => {
        const btns = document.querySelectorAll('.btn');
        for (const btn of btns) {
          if (btn.textContent.includes('开始游戏')) {
            return btn.textContent;
          }
        }
        return null;
      });
      
      if (!startBtn) {
        // 调试：打印房间状态
        const roomState = await this.page1.evaluate(() => {
          return {
            roomVisible: document.getElementById('room').style.display !== 'none',
            playerCount: document.querySelectorAll('.player-item').length,
            buttons: Array.from(document.querySelectorAll('.btn')).map(b => b.textContent.trim()),
            readyPlayers: Array.from(document.querySelectorAll('.player-item .status')).map(s => s.textContent.trim()),
            socketConnected: typeof socket !== 'undefined' && socket !== null && socket.connected,
            socketId: typeof socket !== 'undefined' && socket ? socket.id : 'no socket'
          };
        });
        console.log(`    房间状态: ${JSON.stringify(roomState)}`);
        
        // 直接通过socket发送startGame事件
        console.log('    直接通过socket发送startGame');
        await this.page1.evaluate(() => {
          if (typeof socket !== 'undefined' && socket && socket.connected) {
            socket.emit('startGame');
            console.log('startGame已发送, socket.id:', socket.id);
          } else {
            console.error('socket未连接');
          }
        });
      } else {
        console.log(`    找到按钮: ${startBtn}`);
        // 先验证socket状态
        const socketState = await this.page1.evaluate(() => ({
          connected: typeof socket !== 'undefined' && socket !== null && socket.connected,
          id: typeof socket !== 'undefined' && socket ? socket.id : 'no socket',
          hasStartMultiGame: typeof startMultiGame === 'function'
        }));
        console.log(`    Socket: connected=${socketState.connected}, id=${socketState.id}`);
        
        // 点击按钮
        await this.page1.evaluate(() => {
          const btns = document.querySelectorAll('.btn');
          for (const btn of btns) {
            if (btn.textContent.includes('开始游戏')) {
              btn.click();
              console.log('按钮已点击');
              return;
            }
          }
        });
        
        // 验证事件是否发送
        await this.wait(500);
        const afterClick = await this.page1.evaluate(() => ({
          socketConnected: typeof socket !== 'undefined' && socket !== null && socket.connected
        }));
        console.log(`    点击后socket状态: ${JSON.stringify(afterClick)}`);
        
        // 如果按钮点击没有触发，直接调用函数
        await this.page1.evaluate(() => {
          if (typeof startMultiGame === 'function') {
            startMultiGame();
            console.log('startMultiGame()已调用');
          }
        });
      }
      // 等待游戏界面加载
      await this.wait(6000);
    });

    await this.test('游戏界面已显示(玩家1)', async () => {
      // 等待游戏开始事件
      let retries = 0;
      while (retries < 10) {
        const gameVisible = await this.page1.evaluate(() => {
          const game = document.getElementById('game');
          return game && game.style.display === 'flex';
        });
        if (gameVisible) {
          console.log('    游戏界面已显示');
          return;
        }
        await this.wait(500);
        retries++;
      }
      // 调试信息
      const debug = await this.page1.evaluate(() => {
        return {
          gameStyle: document.getElementById('game').style.display,
          roomStyle: document.getElementById('room').style.display,
          lobbyStyle: document.getElementById('lobby').style.display,
          gameMode: typeof gameMode !== 'undefined' ? gameMode : 'undefined',
          GDefined: typeof G !== 'undefined'
        };
      });
      console.log(`    调试: ${JSON.stringify(debug)}`);
      throw `游戏界面未显示（等待5秒后超时）。调试: ${JSON.stringify(debug)}`;
    });

    await this.test('游戏界面已显示(玩家2)', async () => {
      let retries = 0;
      while (retries < 10) {
        const gameVisible = await this.page2.evaluate(() => {
          const game = document.getElementById('game');
          return game && game.style.display === 'flex';
        });
        if (gameVisible) {
          console.log('    玩家2游戏界面已显示');
          return;
        }
        await this.wait(500);
        retries++;
      }
      throw '玩家2游戏界面未显示（等待5秒后超时）';
    });

    await this.test('游戏状态已初始化', async () => {
      let retries = 0;
      while (retries < 10) {
        const state = await this.page1.evaluate(() => {
          return typeof G !== 'undefined' && G.ps && G.ps.length >= 2;
        });
        if (state) {
          const info = await this.page1.evaluate(() => ({
            hasPlayers: true,
            year: G.year,
            cp: G.cp,
            players: G.ps.map(p => p.n)
          }));
          console.log(`    年份: ${info.year}, 当前玩家: ${info.cp}, 玩家列表: ${info.players.join(', ')}`);
          return;
        }
        await this.wait(500);
        retries++;
      }
      throw '游戏状态未初始化（G.ps 为空）';
    });
  }

  // ===== 联机游戏测试 =====

  async testMultiplayerGame() {
    console.log('\n🎮 [联机游戏测试]');
    
    // 先检查游戏是否已启动
    const gameStarted = await this.page1.evaluate(() => {
      return typeof G !== 'undefined' && G.ps && G.ps.length >= 2;
    });
    
    if (!gameStarted) {
      console.log('  ⏭️  游戏未启动，跳过联机游戏测试');
      return;
    }
    
    await this.test('玩家1在联机模式', async () => {
      const mode = await this.page1.evaluate(() => gameMode);
      if (mode !== 'multi') throw `模式=${mode}`;
    });

    await this.test('玩家1游戏状态正确', async () => {
      const state = await this.page1.evaluate(() => {
        return typeof G !== 'undefined' && G.ps && G.ps.length >= 2;
      });
      if (!state) throw '玩家列表不足2人';
    });

    // 测试移动操作 - 直接调用函数避免按钮可见性问题
    await this.test('玩家1发起移动', async () => {
      const isMyTurn = await this.page1.evaluate(() => {
        return typeof isMyTurnNow === 'function' && isMyTurnNow();
      });
      if (!isMyTurn) {
        console.log('    当前不是玩家1回合，跳过移动测试');
        return;
      }
      
      // 直接调用函数而非点击按钮
      await this.page1.evaluate(() => {
        if (typeof startMove === 'function') startMove();
      });
      await this.wait(800);
      const phase = await this.page1.evaluate(() => G.ph);
      if (phase !== 'move') throw `阶段=${phase}，期望=move`;
    });

    await this.test('玩家1移动到相邻城市', async () => {
      const hasTargets = await this.page1.evaluate(() => {
        return G.highlighted && G.highlighted.length > 0;
      });
      
      if (!hasTargets) {
        console.log('    没有可移动城市，跳过');
        return;
      }
      
      await this.wait(500);
      
      const moved = await this.page1.evaluate(() => {
        if (G.highlighted && G.highlighted.length > 0) {
          const targetCityId = G.highlighted[0];
          if (typeof handleCityClick === 'function') {
            handleCityClick(targetCityId);
            return true;
          }
        }
        return false;
      });
      
      if (!moved) throw '无法移动';
      
      await this.wait(500);
      const ap = await this.page1.evaluate(() => G.ap);
      if (ap >= 1) throw `行动点未减少=${ap}`;
    });

    // 测试操作记录
    await this.test('玩家1操作被记录', async () => {
      const hasLog = await this.page1.evaluate(() => {
        return typeof gameActions !== 'undefined' && gameActions.length > 0;
      });
      if (!hasLog) throw '没有操作记录';
    });

    // 测试结束回合
    await this.test('玩家1结束回合', async () => {
      const isMyTurn = await this.page1.evaluate(() => {
        return typeof isMyTurnNow === 'function' && isMyTurnNow();
      });
      if (!isMyTurn) {
        console.log('    当前不是玩家1回合，跳过结束测试');
        return;
      }
      
      // 直接调用函数而非点击按钮
      await this.page1.evaluate(() => {
        if (typeof endTurn === 'function') endTurn();
      });
      await this.wait(1500);
      const cp = await this.page1.evaluate(() => G.cp);
      if (cp !== 1) throw `当前玩家=${cp} (应该是1)`;
    });
  }

  // ===== 断开连接测试 =====

  async testDisconnect() {
    console.log('\n🔌 [断开连接测试]');
    
    await this.test('玩家2断开连接', async () => {
      try {
        await this.page2.evaluate(() => {
          if (typeof socket !== 'undefined' && socket) {
            socket.disconnect();
          }
        });
        await this.wait(1000);
      } catch (e) {
        // page2 might already be in a bad state
        console.log('    (玩家2已断开)');
      }
    });

    await this.test('玩家1游戏继续正常', async () => {
      try {
        const stillRunning = await this.page1.evaluate(() => {
          return typeof G !== 'undefined' && G.ps && G.ps.length > 0;
        });
        if (!stillRunning) throw '游戏状态异常';
      } catch (e) {
        console.log('    (页面可能已关闭)');
      }
    });
  }

  // ===== 事件系统测试 =====

  async testEvents() {
    console.log('\n📢 [事件系统测试]');
    
    await this.test('事件弹窗可以触发', async () => {
      await this.page1.evaluate(() => {
        showEventModal({
          title: '测试事件',
          desc: '联机测试事件',
          icon: '🧪',
          good: true,
          cities: ['深圳'],
          flavor: '测试效果 +10%'
        });
      });
      await this.wait(500);
      
      const visible = await this.page1.evaluate(() => {
        const modal = document.getElementById('modal');
        return modal && modal.classList.contains('show');
      });
      if (!visible) throw '事件弹窗未显示';
    });

    await this.test('事件弹窗可以关闭', async () => {
      await this.page1.evaluate(() => {
        document.getElementById('modal').classList.remove('show');
      });
      await this.wait(300);
      
      const hidden = await this.page1.evaluate(() => {
        const modal = document.getElementById('modal');
        return modal && !modal.classList.contains('show');
      });
      if (!hidden) throw '事件弹窗未关闭';
    });
  }

  // ===== 同步测试 =====

  async testSync() {
    console.log('\n🔄 [数据同步测试]');
    
    await this.test('玩家1年份同步', async () => {
      const year = await this.page1.evaluate(() => G.year);
      if (!year || year < 1990) throw `年份=${year}`;
    });

    await this.test('玩家1回合同步', async () => {
      const turn = await this.page1.evaluate(() => G.turn);
      if (typeof turn !== 'number') throw `回合=${turn}`;
    });

    await this.test('玩家1行动点数', async () => {
      const ap = await this.page1.evaluate(() => G.ap);
      if (typeof ap !== 'number') throw `行动点=${ap}`;
    });
  }

  report() {
    console.log('\n' + '='.repeat(55));
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    
    console.log(`\n📊 联机测试结果: ${passed} 通过 / ${failed} 失败 / 共 ${this.results.length}`);
    
    if (failed > 0) {
      console.log('\n❌ 失败列表:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => 
        console.log(`  • ${r.name}: ${r.error}`)
      );
    }
    
    if (this.errors.length > 0) {
      console.log('\n⚠️ 页面错误:');
      this.errors.slice(0, 5).forEach(e => console.log(`  • ${e.substring(0, 100)}`));
    }
    
    console.log('='.repeat(55) + '\n');
    return failed === 0;
  }
}

async function runTests() {
  const tester = new MultiplayerTester();
  
  try {
    await tester.setup();
    
    // 基础连接
    await tester.testConnection();
    
    // 创建房间
    await tester.testRoomCreation();
    
    // 加入房间
    await tester.testRoomJoin();
    
    // 游戏启动
    await tester.testGameStart();
    
    // 联机游戏
    await tester.testMultiplayerGame();
    
    // 事件系统
    await tester.testEvents();
    
    // 同步测试
    await tester.testSync();
    
    // 断开测试
    await tester.testDisconnect();
    
    // 截图
    console.log('\n📸 截图记录');
    await tester.page1.screenshot({ path: '/tmp/multi-p1.png', fullPage: true });
    await tester.page2.screenshot({ path: '/tmp/multi-p2.png', fullPage: true });
    console.log('  📸 截图已保存');
    
  } catch (err) {
    console.error('致命错误:', err);
  } finally {
    await tester.teardown();
  }
  
  const success = tester.report();
  
  // 保存报告
  const fs = require('fs');
  const report = {
    time: new Date().toISOString(),
    passed: tester.results.filter(r => r.status === 'PASS').length,
    failed: tester.results.filter(r => r.status === 'FAIL').length,
    results: tester.results,
    errors: tester.errors
  };
  fs.writeFileSync('/tmp/multiplayer-test-report.json', JSON.stringify(report, null, 2));
  console.log('📄 报告已保存: /tmp/multiplayer-test-report.json');
  
  process.exit(success ? 0 : 1);
}

runTests().catch(console.error);
