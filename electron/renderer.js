const settingsView = document.getElementById("settings-view");
const runningView = document.getElementById("running-view");
const deviceSelect = document.getElementById("device");
const refreshButton = document.getElementById("refresh");
const modelPathInput = document.getElementById("model-path");
const chooseModelButton = document.getElementById("choose-model");
const portInput = document.getElementById("port");
const triggersContainer = document.getElementById("triggers");
const addTriggerButton = document.getElementById("add-trigger");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const statusText = document.getElementById("status");
const logOutput = document.getElementById("log");
const statusMessages = {
  failed: "Stream Voice Triggers stopped with an error.",
  running: "Stream Voice Triggers running.",
  starting: "Starting Stream Voice Triggers...",
  stopped: "Stream Voice Triggers stopped.",
};

function setStatus(message) {
  statusText.textContent = message;
}

function setRunning(isRunning) {
  settingsView.hidden = isRunning;
  runningView.hidden = !isRunning;
  stopButton.hidden = false;
}

function setFailed() {
  settingsView.hidden = false;
  runningView.hidden = false;
  stopButton.hidden = true;
}

function appendLog(message) {
  logOutput.textContent += message;
  logOutput.scrollTop = logOutput.scrollHeight;
}

function setModelPath(modelPath) {
  modelPathInput.value = modelPath || "";
  modelPathInput.title = modelPath || "";
}

function createTriggerRow(trigger = {}) {
  const row = document.createElement("div");
  const phraseInput = document.createElement("input");
  const audioInput = document.createElement("input");
  const removeButton = document.createElement("button");

  row.className = "trigger-row";
  phraseInput.type = "text";
  phraseInput.placeholder = "Phrase";
  phraseInput.value = trigger.phrase || "";
  phraseInput.dataset.field = "phrase";
  audioInput.type = "text";
  audioInput.placeholder = "Audio";
  audioInput.value = trigger.audio || "";
  audioInput.dataset.field = "audio";
  removeButton.type = "button";
  removeButton.textContent = "Remove";

  removeButton.addEventListener("click", () => {
    row.remove();
  });

  row.appendChild(phraseInput);
  row.appendChild(audioInput);
  row.appendChild(removeButton);
  return row;
}

function setTriggers(triggers) {
  triggersContainer.innerHTML = "";
  triggers.forEach((trigger) => {
    triggersContainer.appendChild(createTriggerRow(trigger));
  });
}

function getTriggers() {
  return Array.from(triggersContainer.querySelectorAll(".trigger-row")).map((row) => ({
    phrase: row.querySelector('[data-field="phrase"]').value.trim(),
    audio: row.querySelector('[data-field="audio"]').value.trim(),
  }));
}

function getSettings() {
  return {
    audioDeviceName: deviceSelect.value,
    modelPath: modelPathInput.value,
    websocketPort: portInput.value,
    keywordAudioTriggers: getTriggers(),
  };
}

async function loadConfig() {
  const config = await window.streamVoiceTriggers.getConfig();
  setModelPath(config.modelPath);
  portInput.value = config.websocketPort;
  setTriggers(config.keywordAudioTriggers);
  return config;
}

async function loadDevices() {
  setStatus("Loading microphones...");
  deviceSelect.innerHTML = "";

  try {
    const config = await loadConfig();
    const devices = await window.streamVoiceTriggers.listDevices();

    devices.forEach((device) => {
      const option = document.createElement("option");
      option.value = device;
      option.textContent = device;
      deviceSelect.appendChild(option);
    });

    if (config.audioDeviceName) {
      deviceSelect.value = config.audioDeviceName;
    }

    setStatus(devices.length ? "Ready." : "No microphones found.");
  } catch (error) {
    setStatus(error.message);
  }
}

refreshButton.addEventListener("click", loadDevices);

chooseModelButton.addEventListener("click", async () => {
  try {
    const result = await window.streamVoiceTriggers.chooseModel();

    if (!result.canceled) {
      setModelPath(result.modelPath);
      setStatus("Vosk model folder saved.");
    }
  } catch (error) {
    setStatus(error.message);
  }
});

addTriggerButton.addEventListener("click", () => {
  triggersContainer.appendChild(createTriggerRow());
});

startButton.addEventListener("click", async () => {
  try {
    await window.streamVoiceTriggers.saveConfig(getSettings());
    logOutput.textContent = "";
    setRunning(true);
    await window.streamVoiceTriggers.start();
    setStatus("Starting Stream Voice Triggers...");
  } catch (error) {
    setRunning(false);
    setStatus(error.message);
  }
});

stopButton.addEventListener("click", async () => {
  try {
    await window.streamVoiceTriggers.stop();
    setStatus("Stopping Stream Voice Triggers...");
  } catch (error) {
    setStatus(error.message);
  }
});

window.streamVoiceTriggers.onLog((payload) => {
  appendLog(`[${payload.source}] ${payload.message}`);
});

window.streamVoiceTriggers.onStatus((status) => {
  if (status === "failed") {
    setFailed();
  } else {
    setRunning(status !== "stopped");
  }

  setStatus(statusMessages[status] || status);
});

setRunning(false);
loadDevices();
