const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// V1.4: 添加 genshin-3d-models 静态文件服务
app.use('/genshin-3d-models', express.static(path.join(__dirname, '../genshin-3d-models')));

// ==================== 游戏数据 ====================

const PROPERTIES = [
  { id:0,  type:'start',   name:'起点',       emoji:'🏁', color:'#FFD700' },
  { id:1,  type:'prop',    name:'维多利亚港', emoji:'🌊', price:600,  rent:30,  group:0, city:'香港' },
  { id:2,  type:'chance',  name:'机会',       emoji:'❓', color:'#6B3FA0' },
  { id:3,  type:'prop',    name:'太平山顶',   emoji:'⛰️', price:600,  rent:30,  group:0, city:'香港' },
  { id:4,  type:'tax',     name:'所得税',     emoji:'💰', tax:2000 },
  { id:5,  type:'station', name:'港珠澳大桥', emoji:'🌉', price:2000, rent:250, city:'交通' },
  { id:6,  type:'prop',    name:'中环IFC',    emoji:'🏢', price:1000, rent:50,  group:0, city:'香港' },
  { id:7,  type:'chance',  name:'命运',       emoji:'🎴', color:'#6B3FA0' },
  { id:8,  type:'prop',    name:'铜锣湾',     emoji:'🛍️', price:1000, rent:50,  group:0, city:'香港' },
  { id:9,  type:'prop',    name:'兰桂坊',     emoji:'🍺', price:1200, rent:60,  group:0, city:'香港' },
  { id:10, type:'jail',    name:'监狱',       emoji:'🚔', color:'#555' },
  { id:11, type:'prop',    name:'深圳湾',     emoji:'🌃', price:1400, rent:70,  group:1, city:'深圳' },
  { id:12, type:'prop',    name:'平安金融',   emoji:'🏦', price:1400, rent:70,  group:1, city:'深圳' },
  { id:13, type:'prop',    name:'华强北',     emoji:'📱', price:1600, rent:80,  group:1, city:'深圳' },
  { id:14, type:'station', name:'深圳地铁',   emoji:'🚇', price:2000, rent:250, city:'交通' },
  { id:15, type:'prop',    name:'世界之窗',   emoji:'🗼', price:1800, rent:90,  group:1, city:'深圳' },
  { id:16, type:'chance',  name:'机会',       emoji:'❓', color:'#6B3FA0' },
  { id:17, type:'prop',    name:'深圳北站',   emoji:'🚄', price:1800, rent:90,  group:1, city:'深圳' },
  { id:18, type:'prop',    name:'东门老街',   emoji:'🏪', price:2000, rent:100, group:1, city:'深圳' },
  { id:19, type:'free',    name:'免费停车',   emoji:'🅿️', color:'#4CAF50' },
  { id:20, type:'prop',    name:'广州塔',     emoji:'🗼', price:2200, rent:110, group:2, city:'广州' },
  { id:21, type:'chance',  name:'命运',       emoji:'🎴', color:'#6B3FA0' },
  { id:22, type:'prop',    name:'珠江新城',   emoji:'🌆', price:2200, rent:110, group:2, city:'广州' },
  { id:23, type:'prop',    name:'白云山',     emoji:'🌿', price:2400, rent:120, group:2, city:'广州' },
  { id:24, type:'station', name:'白云机场',   emoji:'✈️', price:2000, rent:250, city:'交通' },
  { id:25, type:'prop',    name:'琶洲会展',   emoji:'🏛️', price:2600, rent:130, group:2, city:'广州' },
  { id:26, type:'prop',    name:'北京路',     emoji:'🛒', price:2600, rent:130, group:2, city:'广州' },
  { id:27, type:'prop',    name:'上下九',     emoji:'🏮', price:2800, rent:140, group:2, city:'广州' },
  { id:28, type:'tax',     name:'奢侈税',     emoji:'💎', tax:3000 },
  { id:29, type:'goto',    name:'入狱',       emoji:'👮', color:'#AA2222' },
  { id:30, type:'prop',    name:'珠海渔女',   emoji:'🗿', price:3000, rent:150, group:3, city:'珠海' },
  { id:31, type:'prop',    name:'横琴新区',   emoji:'🏗️', price:3000, rent:150, group:3, city:'珠海' },
  { id:32, type:'chance',  name:'机会',       emoji:'❓', color:'#6B3FA0' },
  { id:33, type:'prop',    name:'大三巴',     emoji:'⛪', price:3200, rent:160, group:3, city:'澳门' },
  { id:34, type:'station', name:'澳门轻轨',   emoji:'🚃', price:2000, rent:250, city:'交通' },
  { id:35, type:'chance',  name:'命运',       emoji:'🎴', color:'#6B3FA0' },
  { id:36, type:'prop',    name:'威尼斯人',   emoji:'🎰', price:3500, rent:175, group:3, city:'澳门' },
  { id:37, type:'prop',    name:'港珠澳口岸', emoji:'🛅', price:4000, rent:200, group:3, city:'珠海' },
  { id:38, type:'tax',     name:'超级税',     emoji:'💸', tax:5000 },
  { id:39, type:'prop',    name:'澳门塔',     emoji:'🎡', price:5000, rent:250, group:3, city:'澳门' },
];

const CHANCE_CARDS = [
  { text:'银行股息，获得 $500',   action:'money', value:500 },
  { text:'超速罚款，支付 $200',   action:'money', value:-200 },
  { text:'前进到起点，获得 $2000', action:'goto',  value:0 },
  { text:'彩票中奖！获得 $1000',  action:'money', value:1000 },
  { text:'医疗费，支付 $800',     action:'money', value:-800 },
  { text:'生日快乐！获得 $300',   action:'money', value:300 },
  { text:'入狱！直接进监狱',      action:'jail',  value:10 },
  { text:'慈善捐款，支付 $500',   action:'money', value:-500 },
  { text:'投资回报，获得 $1500',  action:'money', value:1500 },
  { text:'交通罚款，支付 $150',   action:'money', value:-150 },
];

// ==================== 房间管理 ====================

const rooms = new Map();

function createRoom(roomId) {
  return {
    id: roomId,
    players: [],
    state: 'waiting',
    currentPlayer: 0,
    properties: {},
    turn: 0,
    phase: 'roll',
  };
}

function createPlayer(id, name, emoji) {
  return {
    id,
    name,
    emoji,
    money: 15000,
    position: 0,
    inJail: false,
    jailTurns: 0,
    properties: [],
    bankrupt: false,
    ws: null,
  };
}

function broadcast(room, msg, excludeId = null) {
  room.players.forEach(p => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN && p.id !== excludeId) {
      p.ws.send(JSON.stringify(msg));
    }
  });
}

function broadcastAll(room, msg) {
  room.players.forEach(p => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(msg));
    }
  });
}

function getGameState(room) {
  return {
    type: 'state',
    room: room.id,
    state: room.state,
    currentPlayer: room.currentPlayer,
    phase: room.phase,
    turn: room.turn,
    properties: room.properties,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      money: p.money,
      position: p.position,
      inJail: p.inJail,
      properties: p.properties,
      bankrupt: p.bankrupt,
    })),
    tiles: PROPERTIES,
  };
}

// ==================== WebSocket 处理 ====================

wss.on('connection', (ws) => {
  let playerId = null;
  let roomId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const room = rooms.get(msg.roomId || roomId);

    switch (msg.type) {

      case 'join': {
        roomId = msg.roomId || 'room1';
        if (!rooms.has(roomId)) rooms.set(roomId, createRoom(roomId));
        const r = rooms.get(roomId);

        if (r.state === 'playing') {
          ws.send(JSON.stringify({ type:'error', msg:'游戏已开始' }));
          return;
        }
        if (r.players.length >= 4) {
          ws.send(JSON.stringify({ type:'error', msg:'房间已满' }));
          return;
        }

        const emojis = ['🔴','🔵','🟢','🟡'];
        playerId = 'p' + Date.now();
        const player = createPlayer(playerId, msg.name || '玩家', emojis[r.players.length]);
        player.ws = ws;
        r.players.push(player);

        ws.send(JSON.stringify({ type:'joined', playerId, roomId, emoji: player.emoji }));
        broadcastAll(r, getGameState(r));
        broadcastAll(r, { type:'log', text:`${player.emoji} ${player.name} 加入了房间` });
        break;
      }

      case 'start': {
        if (!room || room.players.length < 2) {
          ws.send(JSON.stringify({ type:'error', msg:'至少需要2名玩家' }));
          return;
        }
        room.state = 'playing';
        room.currentPlayer = 0;
        room.phase = 'roll';
        broadcastAll(room, getGameState(room));
        broadcastAll(room, { type:'log', text:'🎮 游戏开始！' });
        broadcastAll(room, { type:'log', text:`轮到 ${room.players[0].emoji} ${room.players[0].name} 掷骰子` });
        break;
      }

      case 'roll': {
        if (!room || room.state !== 'playing') return;
        const cp = room.players[room.currentPlayer];
        if (cp.id !== playerId) return;
        if (room.phase !== 'roll') return;

        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2;

        broadcastAll(room, { type:'dice', d1, d2, total, playerId });
        broadcastAll(room, { type:'log', text:`${cp.emoji} ${cp.name} 掷出 ${d1}+${d2}=${total}` });

        if (cp.inJail) {
          if (d1 === d2) {
            cp.inJail = false;
            broadcastAll(room, { type:'log', text:`${cp.emoji} ${cp.name} 掷出双数，出狱！` });
          } else {
            cp.jailTurns++;
            if (cp.jailTurns >= 3) {
              cp.money -= 500;
              cp.inJail = false;
              broadcastAll(room, { type:'log', text:`${cp.emoji} ${cp.name} 缴纳 $500 出狱` });
            } else {
              broadcastAll(room, { type:'log', text:`${cp.emoji} ${cp.name} 在监狱中（第${cp.jailTurns}回合）` });
              endTurn(room);
              return;
            }
          }
        }

        const oldPos = cp.position;
        cp.position = (cp.position + total) % 40;

        if (cp.position < oldPos && cp.position !== 0) {
          cp.money += 2000;
          broadcastAll(room, { type:'log', text:`${cp.emoji} ${cp.name} 经过起点，获得 $2000` });
        }

        broadcastAll(room, getGameState(room));

        const tile = PROPERTIES[cp.position];
        handleLanding(room, cp, tile, d1 === d2);
        break;
      }

      case 'buy': {
        if (!room || room.state !== 'playing') return;
        const cp = room.players[room.currentPlayer];
        if (cp.id !== playerId) return;

        const tile = PROPERTIES[cp.position];
        if (!tile.price || room.properties[cp.position]) return;
        if (cp.money < tile.price) return;

        cp.money -= tile.price;
        room.properties[cp.position] = { owner: cp.id, houses: 0 };
        cp.properties.push(cp.position);

        broadcastAll(room, { type:'log', text:`🏆 ${cp.emoji} ${cp.name} 购入 ${tile.city} · ${tile.name} ($${tile.price})` });
        broadcastAll(room, getGameState(room));
        endTurn(room);
        break;
      }

      case 'skip': {
        if (!room || room.state !== 'playing') return;
        const cp = room.players[room.currentPlayer];
        if (cp.id !== playerId) return;
        endTurn(room);
        break;
      }

      case 'build': {
        if (!room || room.state !== 'playing') return;
        const cp = room.players[room.currentPlayer];
        if (cp.id !== playerId) return;
        const prop = room.properties[cp.position];
        if (!prop || prop.owner !== cp.id) return;
        const tile = PROPERTIES[cp.position];
        const cost = Math.floor(tile.price * 0.5);
        if (cp.money < cost || prop.houses >= 3) return;
        cp.money -= cost;
        prop.houses++;
        broadcastAll(room, { type:'log', text:`🏗️ ${cp.emoji} ${cp.name} 在 ${tile.name} 建造了房屋` });
        broadcastAll(room, getGameState(room));
        endTurn(room);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const idx = room.players.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      const p = room.players[idx];
      broadcastAll(room, { type:'log', text:`${p.emoji} ${p.name} 离开了游戏` });
      room.players.splice(idx, 1);
      if (room.players.length === 0) rooms.delete(roomId);
      else broadcastAll(room, getGameState(room));
    }
  });
});

function handleLanding(room, player, tile, isDouble) {
  switch (tile.type) {
    case 'prop':
    case 'station': {
      const owned = room.properties[tile.id];
      if (!owned) {
        if (player.money >= tile.price) {
          room.phase = 'buy';
          broadcastAll(room, { type:'action', action:'buy', tileId: tile.id, playerId: player.id });
          broadcastAll(room, { type:'log', text:`${player.emoji} ${player.name} 落在 ${tile.name}，是否购买？` });
        } else {
          broadcastAll(room, { type:'log', text:`${player.emoji} ${player.name} 资金不足，无法购买 ${tile.name}` });
          endTurn(room);
        }
      } else if (owned.owner === player.id) {
        if (owned.houses < 3 && player.money >= Math.floor(tile.price * 0.5)) {
          room.phase = 'build';
          broadcastAll(room, { type:'action', action:'build', tileId: tile.id, playerId: player.id });
        } else {
          broadcastAll(room, { type:'log', text:`${player.emoji} ${player.name} 路过自己的 ${tile.name}` });
          endTurn(room);
        }
      } else {
        const ownerPlayer = room.players.find(p => p.id === owned.owner);
        const rent = tile.rent * (1 + owned.houses * 0.5);
        player.money -= Math.floor(rent);
        if (ownerPlayer) ownerPlayer.money += Math.floor(rent);
        broadcastAll(room, { type:'log', text:`💸 ${player.emoji} ${player.name} 向 ${ownerPlayer?.emoji} ${ownerPlayer?.name} 支付租金 $${Math.floor(rent)}` });
        broadcastAll(room, getGameState(room));
        if (player.money < 0) {
          player.bankrupt = true;
          broadcastAll(room, { type:'log', text:`💀 ${player.emoji} ${player.name} 破产了！` });
          broadcastAll(room, { type:'bankrupt', playerId: player.id });
        }
        endTurn(room);
      }
      break;
    }
    case 'tax': {
      player.money -= tile.tax;
      broadcastAll(room, { type:'log', text:`💰 ${player.emoji} ${player.name} 缴税 $${tile.tax}` });
      broadcastAll(room, getGameState(room));
      endTurn(room);
      break;
    }
    case 'chance': {
      const card = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
      broadcastAll(room, { type:'log', text:`❓ ${player.emoji} ${player.name}: ${card.text}` });
      broadcastAll(room, { type:'chance', card, playerId: player.id });
      if (card.action === 'money') player.money += card.value;
      else if (card.action === 'goto') { player.position = card.value; player.money += 2000; }
      else if (card.action === 'jail') { player.position = 10; player.inJail = true; }
      broadcastAll(room, getGameState(room));
      endTurn(room);
      break;
    }
    case 'goto': {
      player.position = 10;
      player.inJail = true;
      broadcastAll(room, { type:'log', text:`🚔 ${player.emoji} ${player.name} 入狱！` });
      broadcastAll(room, getGameState(room));
      endTurn(room);
      break;
    }
    default:
      endTurn(room);
  }
}

function endTurn(room) {
  room.phase = 'roll';
  const activePlayers = room.players.filter(p => !p.bankrupt);
  if (activePlayers.length <= 1) {
    room.state = 'ended';
    broadcastAll(room, { type:'log', text:`🏆 ${activePlayers[0]?.emoji} ${activePlayers[0]?.name} 获胜！` });
    broadcastAll(room, getGameState(room));
    return;
  }
  do {
    room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
  } while (room.players[room.currentPlayer].bankrupt);
  room.turn++;
  broadcastAll(room, getGameState(room));
  const next = room.players[room.currentPlayer];
  broadcastAll(room, { type:'log', text:`轮到 ${next.emoji} ${next.name} 掷骰子` });
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🎲 粤港澳大富翁服务器运行在 http://localhost:${PORT}`);
});
