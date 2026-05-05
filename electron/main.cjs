const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1120,
    height: 860,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: '#050505',
    title: 'Focuss Pomodoro',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);

  void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
