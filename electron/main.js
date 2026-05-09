const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");

const APP_ROOT = path.resolve(__dirname, "..");
const LISTENER_SCRIPT = path.join(APP_ROOT, "index.js");

let mainWindow;
let listenerProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 520,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

function getChildEnv() {
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
  };
}

function sendToWindow(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(channel, payload);
}

function runListenerCommand(args) {
  return spawn(process.execPath, [LISTENER_SCRIPT, ...args], {
    cwd: APP_ROOT,
    env: getChildEnv(),
    windowsHide: true,
  });
}

function stopListener() {
  if (!listenerProcess || listenerProcess.exitCode !== null) {
    return;
  }

  listenerProcess.kill("SIGINT");
}

ipcMain.handle("devices:list", () => {
  return new Promise((resolve, reject) => {
    const child = runListenerCommand(["--list-devices-json"]);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error((stderr || stdout).trim() || `Device listing failed with code ${code}.`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Could not read device list: ${error.message}`));
      }
    });
  });
});

ipcMain.handle("listener:start", (event, deviceName) => {
  if (!deviceName) {
    throw new Error("Choose a microphone before starting.");
  }

  if (listenerProcess && listenerProcess.exitCode === null) {
    throw new Error("Listener is already running.");
  }

  listenerProcess = runListenerCommand(["--device-name", deviceName]);
  sendToWindow("listener:status", "starting");

  listenerProcess.on("spawn", () => {
    sendToWindow("listener:status", "running");
  });

  listenerProcess.stdout.on("data", (data) => {
    sendToWindow("listener:log", { source: "listener", message: data.toString() });
  });

  listenerProcess.stderr.on("data", (data) => {
    sendToWindow("listener:log", { source: "error", message: data.toString() });
  });

  listenerProcess.on("error", (error) => {
    sendToWindow("listener:log", { source: "error", message: `${error.message}\n` });
    sendToWindow("listener:status", "stopped");
  });

  listenerProcess.on("close", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    sendToWindow("listener:log", { source: "listener", message: `Listener stopped with ${reason}.\n` });
    sendToWindow("listener:status", "stopped");
    listenerProcess = null;
  });

  return { started: true };
});

ipcMain.handle("listener:stop", () => {
  stopListener();
  return { stopped: true };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  stopListener();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopListener();
});
