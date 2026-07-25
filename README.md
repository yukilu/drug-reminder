# drug-reminder

用药提醒 H5 应用（React + TypeScript + Node.js + SQLite）。

## 目录结构

```
drug-reminder/
├── frontend/   # 前端 (React + Vite + TS)
└── backend/    # 后端 (Express + SQLite + TS)
```

## 开发模式（前后端分别起服务）

1. 启动后端（端口 3001）：

```bash
cd backend
npm install
npm run dev
```

2. 启动前端（端口 5173，通过代理访问后端 /api）：

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 `http://localhost:5173`。

## 生产部署（后端托管前端静态文件，默认 80 端口）

1. 构建前端，把产物放到 `backend/web/`：

```bash
cd frontend
npm install
npm run build
# 将 dist 内容复制到 backend/web
xcopy /E /I dist ..\backend\web   # Windows
# cp -r dist ../backend/web       # Mac/Linux
```

2. 构建并启动后端：

```bash
cd backend
npm install
npm run build
set NODE_ENV=production
npm start
```

默认监听 80 端口，访问 `http://localhost`。

## 功能

- 注册 / 登录（JWT）
- 药品 CRUD（品名、库存、每盒数量、每日用量）
- 首页卡片展示库存（x 粒 x 盒）、一个月还需补多少
- 每日 00:00 自动按每日用量扣减库存，并记录到数据库
- 服务启动时自动检查并补更最近 30 天缺失的库存记录
- 我的页面：用户信息、库存更新记录、重置密码、手动补更、退出登录
