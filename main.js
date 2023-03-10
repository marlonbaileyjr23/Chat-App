require('update-electron-app')()
const { app, BrowserWindow } = require("electron");

const server = require("./server.js");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadURL("http://100.26.138.225:3000");
  mainWindow.on("closed", function () {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.on("resize", function (e, x, y) {
  mainWindow.setSize(x, y);
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  if (mainWindow === null) {
    createWindow();
  }
});