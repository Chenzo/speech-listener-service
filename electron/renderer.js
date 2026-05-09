const deviceSelect = document.getElementById("device");
const refreshButton = document.getElementById("refresh");
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
  deviceSelect.disabled = isRunning;
}

function appendLog(message) {
  logOutput.textContent += message;
  logOutput.scrollTop = logOutput.scrollHeight;
}

async function loadDevices() {
  setStatus("Loading microphones...");
  deviceSelect.innerHTML = "";

  try {
    const devices = await window.speechListener.listDevices();

    devices.forEach((device) => {
      const option = document.createElement("option");
      option.value = device;
      option.textContent = device;
      deviceSelect.appendChild(option);
    });

    setStatus(devices.length ? "Choose a microphone." : "No microphones found.");
  } catch (error) {
    setStatus(error.message);
  }
}

refreshButton.addEventListener("click", loadDevices);

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
