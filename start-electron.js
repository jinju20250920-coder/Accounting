#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Electron launcher script; Node CommonJS by design */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('AI Finance Assistant - Electron 桌面应用启动器');
console.log('=============================================');

// 检查依赖是否已安装
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log('依赖未安装，正在安装...');
    const installProcess = exec('npm install', (error, stdout, stderr) => {
        if (error) {
            console.error('依赖安装失败:', error);
            process.exit(1);
        }
        console.log('依赖安装成功');
        startElectron();
    });

    installProcess.stdout.on('data', (data) => {
        console.log(data.trim());
    });

    installProcess.stderr.on('data', (data) => {
        if (data.includes('deprecated') || data.includes('WARN')) {
            console.warn(data.trim());
        } else {
            console.error(data.trim());
        }
    });
} else {
    startElectron();
}

function startElectron() {
    console.log('启动 Electron 应用...');
    const startProcess = exec('npm run dev:electron', (error, stdout, stderr) => {
        if (error) {
            console.error('启动失败:', error);
            process.exit(1);
        }
    });

    startProcess.stdout.on('data', (data) => {
        console.log(data.trim());
    });

    startProcess.stderr.on('data', (data) => {
        if (data.includes('deprecated') || data.includes('WARN')) {
            console.warn(data.trim());
        } else {
            console.error(data.trim());
        }
    });

    // 监听键盘中断
    process.on('SIGINT', () => {
        console.log('\n正在停止应用...');
        startProcess.kill('SIGINT');
        process.exit(0);
    });
}

console.log('按 Ctrl+C 停止应用');
