const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn } = require("child_process");

const APP_ROOT = path.resolve(__dirname, "..");
const LISTENER_SCRIPT = path.join(APP_ROOT, "index.js");
const TRANSCRIBE_EXE = "transcribe.exe";
const CONFIG_FILE_NAME = ".speech-listener-config.json";
const DEFAULT_MODEL_DIR = path.join(APP_ROOT, "models", "vosk-model-small-en-us-0.15");

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
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    SPEECH_CONFIG_FILE: getConfigFile(),
  };
  const transcriberPath = findBundledTranscriber();

  if (transcriberPath) {
    env.SPEECH_TRANSCRIBE_EXE = transcriberPath;
  }

  return env;
}

function findBundledTranscriber() {
  const candidates = [
    path.join(APP_ROOT, "release-assets", "transcribe", TRANSCRIBE_EXE),
  ];

  if (process.resourcesPath) {
    candidates.unshift(path.join(process.resourcesPath, "transcribe", TRANSCRIBE_EXE));
  }

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function getConfigFile() {
  const configDir = app.isPackaged ? app.getPath("userData") : APP_ROOT;
  return path.join(configDir, CONFIG_FILE_NAME);
}

function readConfig() {
  const configFile = getConfigFile();

  if (!fs.existsSync(configFile)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(configFile, "utf8"));
}

function writeConfig(config) {
  const configFile = getConfigFile();
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
}

function findEffectiveModelPath(config) {
  if (process.env.VOSK_MODEL_PATH) {
    return path.resolve(process.env.VOSK_MODEL_PATH);
  }

  if (config.modelPath) {
    return path.resolve(config.modelPath);
  }

  return DEFAULT_MODEL_DIR;
}

function isVoskModelFolder(modelPath) {
  if (!modelPath || !fs.existsSync(modelPath) || !fs.statSync(modelPath).isDirectory()) {
    return false;
  }

  return ["am", "conf", "graph"].every((entry) => fs.existsSync(path.join(modelPath, entry)));
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

ipcMain.handle("config:get", () => {
  const config = readConfig();

  return {
    audioDeviceName: config.audioDeviceName || "",
    modelPath: config.modelPath || "",
    configFile: getConfigFile(),
  };
});

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

ipcMain.handle("model:choose", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose Vosk Model Folder",
    properties: ["openDirectory"],
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true, modelPath: readConfig().modelPath || "" };
  }

  const modelPath = result.filePaths[0];

  if (!isVoskModelFolder(modelPath)) {
    throw new Error("Choose the extracted Vosk model folder, such as vosk-model-small-en-us-0.15.");
  }

  writeConfig({ ...readConfig(), modelPath });
  return { canceled: false, modelPath };
});

ipcMain.handle("listener:start", (event, deviceName) => {
  if (!deviceName) {
    throw new Error("Choose a microphone before starting.");
  }

  if (listenerProcess && listenerProcess.exitCode === null) {
    throw new Error("Listener is already running.");
  }

  const modelPath = findEffectiveModelPath(readConfig());

  if (!fs.existsSync(modelPath)) {
    throw new Error("Choose a Vosk model folder before starting.");
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
