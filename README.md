# Bangumi目录随机抽取器

一个简单的网页应用，可以从指定的Bangumi目录中随机抽取一个游戏作品。

## 功能特点

- 🎲 **随机抽取**: 从Bangumi目录中随机选择一个游戏作品
- 🔐 **OAuth登录**: 支持Bangumi账号登录（可选）
- 🎮 **游戏专用**: 专门针对游戏类型作品（type = 4）
- 📱 **响应式设计**: 支持移动端和桌面端
- 🎨 **现代界面**: 美观的渐变色UI设计

## 使用方法

### 1. 获取目录ID

在Bangumi网站上找到你想要的目录，从URL中获取目录ID。
例如：`https://bgm.tv/index/12345` 中的 `12345` 就是目录ID。

### 2. 搜索目录

在搜索框中输入目录ID，点击"搜索目录"按钮。

### 3. 随机抽取

目录加载成功后，点击"🎲 随机抽取"按钮，系统会从该目录的游戏作品中随机选择一个。

### 4. 查看结果

抽取结果会显示作品的封面图、标题、原名、发行日期等信息，你还可以点击"访问Bangumi页面"查看详细信息。

## 技术架构

### 前端
- 纯原生JavaScript (ES6+)
- CSS3 渐变和动画效果
- 响应式设计
- IndexedDB缓存支持

### 后端
- Deno + TypeScript
- Bangumi OAuth 2.0集成
- 静态文件服务
- SPA路由支持

### API接口使用
- `GET /v0/indices/{id}` - 获取目录基本信息
- `GET /v0/indices/{id}/subjects` - 获取目录作品列表
- `GET /v0/subjects/{id}` - 获取作品详细信息
- `GET /v0/me` - 获取用户信息（需登录）

## 部署说明

### 本地开发

1. 设置环境变量（创建 `.env` 文件）：
   ```
   BGM_CLIENT_ID=你的Bangumi应用客户端ID
   BGM_CLIENT_SECRET=你的Bangumi应用客户端密钥
   PORT=8001
   ```

2. 运行服务器：
   ```bash
   deno run --allow-net --allow-read --allow-env server.ts
   ```

3. 访问 `http://localhost:8001`

### 生产环境

可以部署到Deno Deploy或其他支持Deno的托管服务：

1. 在Bangumi开发者平台创建应用：https://bgm.tv/dev/app
2. 设置正确的回调URL：`https://your-domain.com/api/auth/bangumi/callback`
3. 配置环境变量
4. 部署代码

### 仅前端部署

如果不需要登录功能，也可以仅部署静态文件到GitHub Pages、Netlify等平台。但需要注意：
- 无法使用需要认证的API功能
- 某些目录可能因为权限限制无法访问

## 文件结构

```
bangumi-random/
├── index.html          # 主页面
├── style.css           # 样式文件
├── script.js           # 前端逻辑
├── server.ts           # Deno服务器
└── README.md           # 说明文档
```

## 注意事项

1. **目录权限**: 某些私有目录可能需要登录才能访问
2. **作品类型**: 目前只支持游戏类型作品（type = 4）
3. **API限制**: 遵守Bangumi API的使用限制和频率限制
4. **浏览器兼容**: 需要支持ES6+的现代浏览器

## 开发说明

### 添加新功能

如果要添加新功能，建议：
1. 在`script.js`中的`BangumiRandomPicker`类中添加新方法
2. 在`index.html`中添加相应的UI元素
3. 在`style.css`中添加样式
4. 如果需要服务器端支持，修改`server.ts`

### API扩展

项目使用了Bangumi API v0的以下端点：
- 目录信息和作品列表
- 作品详细信息
- 用户认证

可以根据需要添加更多API端点的使用。

## 许可证

本项目仅供学习和个人使用。使用时请遵守Bangumi网站的使用条款。