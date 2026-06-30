/* eslint-disable @typescript-eslint/no-require-imports -- Electron main-process helper; CommonJS required by Electron runtime */
const { Menu, dialog } = require('electron');
const os = require('os');

let mainWindow;

function setMainWindow(window) {
    mainWindow = window;
}

function createMenu() {
    const template = [
        {
            label: os.platform() === 'darwin' ? '金桔财务系统' : '文件',
            submenu: [
                {
                    label: '新建账套',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('new-database');
                    }
                },
                {
                    label: '打开账套',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openFile'],
                            filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }]
                        });

                        if (!result.canceled && result.filePaths.length > 0) {
                            mainWindow.webContents.send('open-database', result.filePaths[0]);
                        }
                    }
                },
                {
                    label: '保存账套',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.send('save-database');
                    }
                },
                { type: 'separator' },
                {
                    label: '导出账套',
                    click: () => {
                        mainWindow.webContents.send('export-database');
                    }
                },
                {
                    label: '导入账套',
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openFile'],
                            filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }]
                        });

                        if (!result.canceled && result.filePaths.length > 0) {
                            mainWindow.webContents.send('import-database', result.filePaths[0]);
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: '最近打开',
                    role: 'recentdocuments',
                    submenu: [
                        {
                            label: '清除菜单',
                            role: 'clearrecentdocuments'
                        }
                    ]
                },
                { type: 'separator' },
                {
                    label: '退出',
                    role: 'quit'
                }
            ]
        },
        {
            label: '编辑',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' }
            ]
        },
        {
            label: '视图',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                { type: 'separator' },
                { role: 'toggledevtools' },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: '窗口',
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { role: 'close' },
                { type: 'separator' },
                { role: 'front' }
            ]
        },
        {
            label: '帮助',
            role: 'help',
            submenu: [
                {
                    label: '关于',
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: '关于 金桔财务系统',
                            message: '金桔财务系统 v0.1.0',
                            detail: '基于Web的现代会计凭证录入系统'
                        });
                    }
                },
                {
                    label: '使用说明',
                    click: () => {
                        // 这里可以打开帮助文档
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

module.exports = {
    setMainWindow,
    createMenu
};
