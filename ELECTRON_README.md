# AI Finance Assistant - Electron 桌面应用

## 概述

这是 AI Finance Assistant 的桌面应用版本，使用 Electron 构建。

## 功能特性

✅ **真实文件系统存储** - SQLite 数据库直接保存为磁盘文件
✅ **自动连接上次的账套** - 无需重新选择文件
✅ **多账套支持** - 可以创建和管理多个数据库文件
✅ **文件菜单** - 完整的文件操作菜单
✅ **跨平台支持** - Windows, macOS, Linux

## 安装

### 前置要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

## 开发模式

### 运行开发版本

```bash
npm run dev:electron
```

这将同时启动 Next.js 开发服务器和 Electron 应用。

### 仅运行 Next.js 开发服务器

```bash
npm run dev
```

### 仅运行 Electron 应用（生产构建后）

```bash
npm run electron:start:prod
```

## 构建生产版本

### 构建 Next.js 应用

```bash
npm run build
```

### 打包为桌面应用

#### 构建所有平台

```bash
npm run electron:package
```

#### 仅构建 Windows 版本

```bash
npm run electron:package:win
```

#### 仅构建 macOS 版本

```bash
npm run electron:package:mac
```

#### 仅构建 Linux 版本

```bash
npm run electron:package:linux
```

打包后的文件会保存在 `dist/` 目录中。

## 使用说明

### 创建新账套

1. 点击菜单栏 `文件` → `新建账套`
2. 选择保存位置和文件名
3. 应用会自动创建并连接到新的数据库

### 打开现有账套

1. 点击菜单栏 `文件` → `打开账套`
2. 选择已有的 `.db` 文件
3. 应用会自动加载并连接到该数据库

### 保存账套

- 应用会自动保存数据（每 5 秒）
- 也可以手动点击 `文件` → `保存账套` 立即保存

### 切换账套

1. 点击 `文件` → `打开账套` 选择不同的数据库文件
2. 或者直接关闭应用，在下次启动时选择其他文件

## 数据库存储位置

### 默认位置

如果不手动选择文件，应用会在以下位置创建默认数据库：

- **Windows**: `%APPDATA%/AI Finance Assistant/finance.db`
- **macOS**: `~/Library/Application Support/AI Finance Assistant/finance.db`
- **Linux**: `~/.config/AI Finance Assistant/finance.db`

### 自定义位置

您可以将数据库文件保存到任何位置，方便备份和共享。

## 数据备份和共享

### 备份

1. 关闭应用
2. 复制 `.db` 文件到备份位置

### 恢复

1. 将备份的 `.db` 文件复制到想要的位置
2. 在应用中打开该文件

### 多设备同步

1. 使用云盘（Dropbox, OneDrive, Google Drive 等）同步 `.db` 文件
2. 在不同设备上打开同一个文件即可

## 技术架构

### 项目结构

```
ai-finance-assistant/
├── electron/
│   ├── main.js          # Electron 主进程
│   ├── preload.js       # 预加载脚本
│   └── menu.js          # 菜单系统
├── src/
│   └── lib/
│       └── database/
│           └── sqlite-manager.ts  # 数据库管理（支持 Electron 和浏览器）
├── next.config.js       # Next.js 配置
├── electron-builder.yml  # 打包配置
└── package.json
```

### 关键技术

- **Electron** - 跨平台桌面应用框架
- **Next.js** - React 框架
- **sql.js** - WebAssembly SQLite 数据库
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **shadcn/ui** - UI 组件库

## 故障排除

### 应用无法启动

- 确保已安装所有依赖：`npm install`
- 检查 Node.js 版本（16+）
- 删除 `node_modules` 和 `package-lock.json`，重新安装

### 数据库无法加载

- 检查文件是否存在且有读取权限
- 尝试以管理员身份运行应用
- 尝试创建新的数据库

### 数据丢失

- 检查是否使用了正确的数据库文件
- 查看是否有自动备份文件
- 联系技术支持

## 开发注意事项

### 浏览器兼容性

`sqlite-manager.ts` 同时支持：
- **Electron 环境** - 使用真实文件系统
- **浏览器环境** - 使用 localStorage 作为 fallback

### 自动保存

- Electron 环境：每 5 秒自动保存到磁盘
- 浏览器环境：每 5 秒自动保存到 localStorage

## 许可证

本项目使用 MIT 许可证。

## 支持

如有问题或建议，请访问项目仓库或联系技术支持。
