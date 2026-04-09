const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 游戏房间管理
const rooms = {};
const socketToRoom = {};

// 生成房间号
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 初始化游戏状态
function initGameState() {
  return {
    ps: [],           // 玩家列表
    cp: 0,            // 当前玩家索引
    ph: 'action',     // 游戏阶段
    own: {},          // 地产所有权
    ap: 1,            // 行动点数
    year: 1990,       // 年份
    turn: 0,          // 回合数
    started: false,   // 游戏是否开始
    highlighted: []   // 高亮的城市
  };
}

// 年代事件系统
const DECADE_EVENTS = {
  1990: [
    {title:'浦东开发',desc:'上海浦东新区开发启动',effect:{gdp:0.1},cities:['香港'],good:true},
    {title:'深圳证券交易所成立',desc:'中国资本市场迈出重要一步',effect:{finance:50},cities:['深圳'],good:true},
    {title:'香港GDP突破',desc:'香港经济蓬勃发展',effect:{money:200},cities:['香港'],good:true}
  ],
  2000: [
    {title:'中国加入WTO',desc:'中国正式加入世界贸易组织',effect:{gdp:0.2},cities:['广州','深圳'],good:true},
    {title:'互联网泡沫',desc:'科技股暴跌',effect:{tech:-30},cities:['深圳'],good:false},
    {title:'CEPA签署',desc:'内地与香港更紧密经贸关系',effect:{trade:40},cities:['香港','深圳'],good:true}
  ],
  2010: [
    {title:'粤港澳大湾区概念提出',desc:'区域一体化加速',effect:{gdp:0.15},cities:['广州','深圳','香港'],good:true},
    {title:'高铁时代',desc:'广深港高铁开通',effect:{logistics:60},cities:['广州','深圳','香港'],good:true},
    {title:'金融危机影响',desc:'全球金融危机波及',effect:{money:-100},cities:['香港'],good:false}
  ],
  2020: [
    {title:'疫情冲击',desc:'新冠疫情影响经济',effect:{gdp:-0.1},cities:['香港','澳门'],good:false},
    {title:'数字经济发展',desc:'数字经济蓬勃发展',effect:{tech:80},cities:['深圳','广州'],good:true},
    {title:'港珠澳大桥',desc:'世界最长跨海大桥通车',effect:{logistics:50},cities:['香港','珠海','澳门'],good:true},
    {title:'前海深港合作区',desc:'前海扩区，深港合作升级',effect:{finance:70},cities:['深圳','前海'],good:true}
  ]
};

function checkDecadeEvent(year, turn) {
  const decade = Math.floor(year / 10) * 10;
  const events = DECADE_EVENTS[decade];
  if (!events || events.length === 0) return null;
  if (turn % 10 === 0) {
    return events[Math.floor(Math.random() * events.length)];
  }
  return null;
}

// Socket.io 连接处理
io.on('connection', (socket) => {
  console.log('玩家连接:', socket.id);

  // 创建房间
  socket.on('createRoom', (data) => {
    const roomId = generateRoomId();
    const playerName = data.name || '玩家' + Math.floor(Math.random() * 1000);
    
    rooms[roomId] = {
      id: roomId,
      players: [{
        id: socket.id,
        name: playerName,
        ready: false,
        isHost: true
      }],
      state: initGameState(),
      createdAt: Date.now()
    };
    
    socketToRoom[socket.id] = roomId;
    socket.join(roomId);
    
    socket.emit('roomCreated', {
      roomId: roomId,
      playerId: socket.id,
      isHost: true
    });
    
    io.to(roomId).emit('roomUpdate', {
      players: rooms[roomId].players,
      roomId: roomId
    });
    
    console.log('房间创建:', roomId, '玩家:', playerName);
  });

  // 加入房间
  socket.on('joinRoom', (data) => {
    const roomId = data.roomId.toUpperCase();
    const playerName = data.name || '玩家' + Math.floor(Math.random() * 1000);
    
    if (!rooms[roomId]) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }
    
    if (rooms[roomId].players.length >= 4) {
      socket.emit('error', { message: '房间已满' });
      return;
    }
    
    if (rooms[roomId].state.started) {
      socket.emit('error', { message: '游戏已开始' });
      return;
    }
    
    // 检查是否已在房间中（断线重连）
    const existingPlayer = rooms[roomId].players.find(p => p.name === playerName);
    if (existingPlayer) {
      // 更新socket id
      existingPlayer.id = socket.id;
      socketToRoom[socket.id] = roomId;
      socket.join(roomId);
      
      socket.emit('roomJoined', {
        roomId: roomId,
        playerId: socket.id,
        isHost: existingPlayer.isHost,
        reconnected: true
      });
      
      // 发送当前游戏状态
      socket.emit('gameState', rooms[roomId].state);
    } else {
      // 新玩家加入
      rooms[roomId].players.push({
        id: socket.id,
        name: playerName,
        ready: false,
        isHost: false
      });
      
      socketToRoom[socket.id] = roomId;
      socket.join(roomId);
      
      socket.emit('roomJoined', {
        roomId: roomId,
        playerId: socket.id,
        isHost: false
      });
    }
    
    io.to(roomId).emit('roomUpdate', {
      players: rooms[roomId].players,
      roomId: roomId
    });
    
    console.log('玩家加入房间:', roomId, '玩家:', playerName);
  });

  // 玩家准备/取消准备
  socket.on('setReady', (data) => {
    const roomId = socketToRoom[socket.id];
    if (!roomId || !rooms[roomId]) return;
    
    const player = rooms[roomId].players.find(p => p.id === socket.id);
    if (player) {
      player.ready = data.ready;
      console.log('玩家准备:', player.name, data.ready ? '已准备' : '取消准备', '房间:', roomId);
      io.to(roomId).emit('roomUpdate', {
        players: rooms[roomId].players,
        roomId: roomId
      });
    }
  });

  // 开始游戏（仅房主）
  socket.on('startGame', () => {
    console.log('收到startGame事件, socket.id:', socket.id);
    const roomId = socketToRoom[socket.id];
    console.log('房间ID:', roomId, '房间存在:', !!rooms[roomId]);
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    const player = room.players.find(p => p.id === socket.id);
    console.log('玩家:', player ? player.name : '未找到', '是否房主:', player ? player.isHost : false);
    
    if (!player || !player.isHost) {
      socket.emit('error', { message: '只有房主可以开始游戏' });
      return;
    }
    
    if (room.players.length < 2) {
      socket.emit('error', { message: '至少需要2名玩家' });
      return;
    }
    
    const allReady = room.players.every(p => p.ready);
    console.log('所有玩家准备:', allReady, '玩家数:', room.players.length);
    if (!allReady) {
      socket.emit('error', { message: '还有玩家未准备' });
      return;
    }
    
    // 初始化游戏状态
    room.state.ps = room.players.map((p, i) => ({
      id: p.id,
      n: p.name,
      m: 15000,
      pos: 0,
      pr: [],
      index: i
    }));
    room.state.cp = 0;
    room.state.started = true;
    room.state.ap = 1;
    room.state.year = 1990;
    room.state.turn = 0;
    
    io.to(roomId).emit('gameStarted', room.state);
    console.log('游戏开始:', roomId);
  });

  // 玩家移动
  socket.on('playerMove', (data) => {
    const roomId = socketToRoom[socket.id];
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    const state = room.state;
    
    // 验证是否是当前玩家
    const currentPlayer = state.ps[state.cp];
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: '不是你的回合' });
      return;
    }
    
    // 验证行动点数
    if (state.ap <= 0) {
      socket.emit('error', { message: '没有行动点数' });
      return;
    }
    
    // 执行移动
    currentPlayer.pos = data.targetCityId;
    state.ap--;
    state.ph = 'action';
    
    // 广播更新
    io.to(roomId).emit('gameState', state);
    io.to(roomId).emit('playerMoved', {
      playerId: socket.id,
      targetCityId: data.targetCityId,
      ap: state.ap
    });
  });

  // 建造工业
  socket.on('buildIndustry', (data) => {
    const roomId = socketToRoom[socket.id];
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    const state = room.state;
    
    const currentPlayer = state.ps[state.cp];
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: '不是你的回合' });
      return;
    }
    
    if (state.ap <= 0) {
      socket.emit('error', { message: '没有行动点数' });
      return;
    }
    
    const cityId = data.cityId;
    if (state.own[cityId]) {
      socket.emit('error', { message: '该城市已有工业' });
      return;
    }
    
    if (currentPlayer.m < 500) {
      socket.emit('error', { message: '资金不足' });
      return;
    }
    
    // 执行建造
    state.own[cityId] = currentPlayer.id;
    currentPlayer.m -= 500;
    state.ap--;
    
    io.to(roomId).emit('gameState', state);
    io.to(roomId).emit('industryBuilt', {
      playerId: socket.id,
      cityId: cityId,
      ap: state.ap
    });
  });

  // 结束回合
  socket.on('endTurn', () => {
    const roomId = socketToRoom[socket.id];
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    const state = room.state;
    
    const currentPlayer = state.ps[state.cp];
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: '不是你的回合' });
      return;
    }
    
    // 切换到下一个玩家
    state.cp = (state.cp + 1) % state.ps.length;
    state.ap = 1;
    state.ph = 'action';
    state.turn++;
    
    // 每2回合推进1年
    if (state.turn % 2 === 0) {
      state.year += 1;
    }
    
    // 检查年代事件
    const event = checkDecadeEvent(state.year, state.turn);
    if (event) {
      io.to(roomId).emit('decadeEvent', event);
      
      // 应用事件效果
      if (event.effect.money) {
        state.ps.forEach(p => {
          p.m += event.effect.money;
        });
      }
    }
    
    io.to(roomId).emit('gameState', state);
    io.to(roomId).emit('turnEnded', {
      nextPlayerId: state.ps[state.cp].id,
      nextPlayerIndex: state.cp,
      year: state.year,
      turn: state.turn
    });
  });

  // 同步高亮城市
  socket.on('highlightCities', (data) => {
    const roomId = socketToRoom[socket.id];
    if (!roomId || !rooms[roomId]) return;
    
    rooms[roomId].state.highlighted = data.cityIds || [];
    socket.to(roomId).emit('citiesHighlighted', {
      cityIds: data.cityIds,
      playerId: socket.id
    });
  });

  // 发送聊天消息
  socket.on('chat', (data) => {
    const roomId = socketToRoom[socket.id];
    if (!roomId) return;
    
    const room = rooms[roomId];
    const player = room.players.find(p => p.id === socket.id);
    
    io.to(roomId).emit('chatMessage', {
      playerName: player ? player.name : '未知玩家',
      message: data.message,
      timestamp: Date.now()
    });
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('玩家断开:', socket.id);
    
    const roomId = socketToRoom[socket.id];
    if (!roomId || !rooms[roomId]) return;
    
    const room = rooms[roomId];
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];
      
      // 如果游戏已开始，标记为离线但不删除
      if (room.state.started) {
        player.online = false;
        io.to(roomId).emit('playerDisconnected', {
          playerId: socket.id,
          playerName: player.name
        });
      } else {
        // 游戏未开始，移除玩家
        room.players.splice(playerIndex, 1);
        
        // 如果房间空了，删除房间
        if (room.players.length === 0) {
          delete rooms[roomId];
          console.log('房间删除:', roomId);
          return;
        }
        
        // 如果房主离开，转让房主
        if (player.isHost && room.players.length > 0) {
          room.players[0].isHost = true;
        }
        
        io.to(roomId).emit('roomUpdate', {
          players: room.players,
          roomId: roomId
        });
      }
    }
    
    delete socketToRoom[socket.id];
  });
});

// 定期清理空房间
setInterval(() => {
  const now = Date.now();
  for (const roomId in rooms) {
    const room = rooms[roomId];
    // 删除创建超过2小时且未开始的房间
    if (!room.state.started && now - room.createdAt > 2 * 60 * 60 * 1000) {
      delete rooms[roomId];
      console.log('清理过期房间:', roomId);
    }
  }
}, 10 * 60 * 1000); // 每10分钟检查一次

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎲 粤港澳大富翁服务器运行在端口 ${PORT}`);
  console.log(`📱 访问 http://localhost:${PORT} 开始游戏`);
});
