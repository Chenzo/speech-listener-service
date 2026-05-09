const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("speechListener", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  listDevices: () => ipcRenderer.invoke("devices:list"),
  chooseModel: () => ipcRenderer.invoke("model:choose"),
  start: (deviceName) => ipcRenderer.invoke("listener:start", deviceName),
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
