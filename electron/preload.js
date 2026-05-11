const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("streamVoiceTriggers", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (settings) => ipcRenderer.invoke("config:save", settings),
  listDevices: () => ipcRenderer.invoke("devices:list"),
  chooseModel: () => ipcRenderer.invoke("model:choose"),
  start: () => ipcRenderer.invoke("listener:start"),
  stop: () => ipcRenderer.invoke("listener:stop"),
  onLog: (callback) => {
    const listener = (event, payload) => callback(payload);
    ipcRenderer.on("listener:log", listener);
    return () => ipcRenderer.removeListener("listener:log", listener);
  },
  onStatus: (callback) => {
    const listener = (event, payload) => callback(payload);
    ipcRenderer.on("listener:status", listener);
    return () => ipcRenderer.removeListener("listener:status", listener);
  },
});
