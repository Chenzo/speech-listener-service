const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("speechListener", {
  listDevices: () => ipcRenderer.invoke("devices:list"),
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
