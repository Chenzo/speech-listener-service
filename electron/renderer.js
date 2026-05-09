const deviceSelect = document.getElementById("device");
const refreshButton = document.getElementById("refresh");
const modelPathInput = document.getElementById("model-path");
const chooseModelButton = document.getElementById("choose-model");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const statusText = document.getElementById("status");
const logOutput = document.getElementById("log");
const statusMessages = {
  running: "Listener running.",
  starting: "Starting listener...",
  stopped: "Listener stopped.",
};

function setStatus(message) {
  statusText.textContent = message;
}

function setRunning(isRunning) {
  startButton.disabled = isRunning;
  stopButton.disabled = !isRunning;
  refreshButton.disabled = isRunning;
  chooseModelButton.disabled = isRunning;
  deviceSelect.disabled = isRunning;
}

function appendLog(message) {
  logOutput.textContent += message;
  logOutput.scrollTop = logOutput.scrollHeight;
}

function setModelPath(modelPath) {
  modelPathInput.value = modelPath || "";
  modelPathInput.title = modelPath || "";
}

async function loadConfig() {
  const config = await window.speechListener.getConfig();
  setModelPath(config.modelPath);
  return config;
}

async function loadDevices() {
  setStatus("Loading microphones...");
  deviceSelect.innerHTML = "";

  try {
    const config = await loadConfig();
    const devices = await window.speechListener.listDevices();

    devices.forEach((device) => {
      const option = document.createElement("option");
      option.value = device;
      option.textContent = device;
      deviceSelect.appendChild(option);
    });

    if (config.audioDeviceName) {
      deviceSelect.value = config.audioDeviceName;
    }

    setStatus(devices.length ? "Choose a microphone." : "No microphones found.");
  } catch (error) {
    setStatus(error.message);
  }
}

refreshButton.addEventListener("click", loadDevices);

chooseModelButton.addEventListener("click", async () => {
  try {
    const result = await window.speechListener.chooseModel();

    if (!result.canceled) {
      setModelPath(result.modelPath);
      setStatus("Vosk model folder saved.");
    }
  } catch (error) {
    setStatus(error.message);
  }
});

startButton.addEventListener("click", async () => {
  try {
    await window.speechListener.start(deviceSelect.value);
    setRunning(true);
    setStatus("Starting listener...");
  } catch (error) {
    setStatus(error.message);
  }
});

stopButton.addEventListener("click", async () => {
  try {
    await window.speechListener.stop();
    setStatus("Stopping listener...");
  } catch (error) {
    setStatus(error.message);
  }
});

window.speechListener.onLog((payload) => {
  appendLog(`[${payload.source}] ${payload.message}`);
});

window.speechListener.onStatus((status) => {
  setRunning(status !== "stopped");
  setStatus(statusMessages[status] || status);
});

loadDevices();
