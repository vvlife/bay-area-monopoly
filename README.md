# 粤港澳大富翁 - Bay Area Monopoly

多人在线大富翁游戏，基于 Node.js + Socket.IO + Playwright。

## 功能特性

- 🎲 多人在线对战
- 🏙️ 粤港澳地图
- 📱 实时游戏同步
- 🤖 AI 机器人支持

## 环境要求

- Node.js 18+
- npm

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

```bash
npm start
```

服务器启动后显示：

```
🎲 粤港澳大富翁服务器运行在端口 3001
📱 访问 http://localhost:3001 开始游戏
```

### 3. 访问游戏

打开浏览器访问：**http://localhost:3001**

## 命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动生产服务器 |
| `npm run dev` | 启动开发服务器 |

## 项目结构

```
bay-area-monopoly/
├── server-multi.js    # 主服务器文件
├── server.js          # 单人服务器
├── package.json       # 项目配置
├── public/            # 静态资源
├── versions/          # 历史版本
└── tests/             # 测试文件
```

## 技术栈

- **Express** - Web 框架
- **Socket.IO** - 实时通信
- **Playwright** - 浏览器自动化
- **WS** - WebSocket

## 许可证

ISC
