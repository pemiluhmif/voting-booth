const { app, BrowserWindow } = require('electron')
// const app = require('electron').app;
// const BrowserWindow = require('electron').BrowserWindow;

require('electron-reload')(__dirname)

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;
let serv = require('./src/app');

app.on('ready', function() {
    'use strict';

    win = new BrowserWindow({
        width: 1024,
        height: 600,
        resizable: true
    })
    // win.setMenu(null);
    win.loadURL('http://localhost:7000/');
    win.focus();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});
app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
});