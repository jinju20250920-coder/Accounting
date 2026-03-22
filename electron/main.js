const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { setMainWindow, createMenu } = require('./menu');

// 保持对窗口对象的全局引用，如果不这样做，当 JavaScript 对象被垃圾回收时，窗口将自动关闭
let mainWindow;

function createWindow() {
    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.ico') // 可选的图标
    });

    // 加载应用的 index.html
    // 如果是开发模式，加载开发服务器
    const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../out/index.html')}`;
    mainWindow.loadURL(startUrl);

    // 打开 DevTools（生产模式可省略）
    if (process.env.ELECTRON_START_URL) {
        mainWindow.webContents.openDevTools();
    }

    // 初始化菜单
    setMainWindow(mainWindow);
    createMenu();

    // 菜单操作处理
    mainWindow.webContents.send('set-app-menu');

    // 当 window 被关闭时触发
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

// Electron 完成初始化后创建窗口
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用
app.on('window-all-closed', function () {
    // 在 macOS 上，应用和菜单栏通常保持活动状态，直到用户明确退出
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    // 在 macOS 上，点击 dock 图标并且没有其他窗口打开时，通常会重新创建一个窗口
    if (mainWindow === null) {
        createWindow();
    }
});

// 数据库文件操作接口
let currentDbPath = null;

ipcMain.handle('select-db-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        currentDbPath = result.filePaths[0];
        return currentDbPath;
    }

    return null;
});

ipcMain.handle('create-db-file', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: 'finance.db',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });

    if (!result.canceled) {
        currentDbPath = result.filePath;
        return currentDbPath;
    }

    return null;
});

ipcMain.handle('save-db', async (event, data) => {
    if (!currentDbPath) {
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: 'finance.db',
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });

        if (!result.canceled) {
            currentDbPath = result.filePath;
        } else {
            return null;
        }
    }

    try {
        fs.writeFileSync(currentDbPath, Buffer.from(data));
        return currentDbPath;
    } catch (error) {
        console.error('Failed to save database:', error);
        return null;
    }
});

ipcMain.handle('load-db', async () => {
    if (!currentDbPath) {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            currentDbPath = result.filePaths[0];
        } else {
            return null;
        }
    }

    try {
        const data = fs.readFileSync(currentDbPath);
        return Array.from(new Uint8Array(data));
    } catch (error) {
        console.error('Failed to load database:', error);
        return null;
    }
});

ipcMain.handle('get-db-path', () => currentDbPath);
ipcMain.handle('set-db-path', async (event, path) => {
    currentDbPath = path;
    return true;
});

// 获取默认存储路径
ipcMain.handle('get-default-db-path', () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'finance.db');
});

// 检查文件是否存在
ipcMain.handle('file-exists', async (event, filePath) => {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        console.error('File exists check failed:', error);
        return false;
    }
});

// 菜单操作处理
ipcMain.handle('new-database', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: 'new-finance.db',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });

    if (!result.canceled) {
        currentDbPath = result.filePath;
        mainWindow.webContents.send('database-created', result.filePath);
        return currentDbPath;
    }

    return null;
});

ipcMain.handle('open-database', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        currentDbPath = result.filePaths[0];
        mainWindow.webContents.send('database-opened', currentDbPath);
        return currentDbPath;
    }

    return null;
});

ipcMain.handle('save-database', async () => {
    if (currentDbPath) {
        mainWindow.webContents.send('database-saved', currentDbPath);
        return true;
    }

    return false;
});
