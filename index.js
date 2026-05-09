const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const path = require("path");
const readline = require("readline");
const { spawn } = require("child_process");

const ffmpegPath = require("ffmpeg-static");
const {
  DEFAULT_KEYWORD_AUDIO_TRIGGERS,
  DEFAULT_WEBSOCKET_PORT,
} = require("./settings-defaults");

const SAMPLE_RATE = 16000;
const CONFIG_FILE = process.env.SPEECH_CONFIG_FILE
  ? path.resolve(process.env.SPEECH_CONFIG_FILE)
  : path.join(__dirname, ".speech-listener-config.json");
const MODELS_DIR = path.join(__dirname, "models");
const DEFAULT_MODEL_DIR = path.join(MODELS_DIR, "vosk-model-small-en-us-0.15");
const TRANSCRIBE_HELPER = path.join(__dirname, "transcribe.py");
const PACKAGED_TRANSCRIBE_HELPER = "transcribe.exe";
const TRIGGER_COOLDOWN_MS = 5000;

async function main() {
  if (process.platform !== "win32") {
    throw new Error("This first version uses Windows DirectShow audio devices.");
  }

  if (!ffmpegPath) {
    throw new Error("Could not find the ffmpeg binary from ffmpeg-static.");
  }

  const config = readConfig();
  const shouldListDevices = process.argv.includes("--list-devices-json");
  if (shouldListDevices) {
    const devices = await listAudioDevices();
    console.log(JSON.stringify(devices));
    return;
  }

  const requestedDeviceName = getArgValue("--device-name");
  const shouldSelectDevice = process.argv.includes("--select-device");
  let deviceName = requestedDeviceName || config.audioDeviceName;

  if (shouldSelectDevice || !deviceName) {
    const devices = await listAudioDevices();
    deviceName = await chooseDevice(devices);
    writeConfig({ ...config, audioDeviceName: deviceName });
    console.log(`Saved selected device to ${path.basename(CONFIG_FILE)}.`);
  } else if (requestedDeviceName && requestedDeviceName !== config.audioDeviceName) {
    writeConfig({ ...config, audioDeviceName: deviceName });
    console.log(`Saved selected device to ${path.basename(CONFIG_FILE)}.`);
  }

  console.log(`Selected device: ${deviceName}`);

  const modelPath = findModelPath(config);
  console.log(`Vosk model: ${modelPath}`);

  if (!fs.existsSync(modelPath)) {
    throw new Error(
      [
        "Vosk model not found.",
        `Expected a model at: ${modelPath}`,
        `Choose a Vosk model folder in the launcher, download and extract a Vosk model into ${MODELS_DIR}, or set VOSK_MODEL_PATH.`,
      ].join("\n")
    );
  }

  console.log("Starting speech recognition...");
  const speechHelper = await findSpeechHelper();
  const websocketPort = getWebSocketPort(config);
  const keywordAudioTriggers = getKeywordAudioTriggers(config);
  const broadcaster = await startWebSocketServer(websocketPort);
  startListening(deviceName, modelPath, speechHelper, broadcaster, keywordAudioTriggers);
}

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
}

function getArgValue(name) {
  const argPrefix = `${name}=`;
  const argWithValue = process.argv.find((arg) => arg.startsWith(argPrefix));

  if (argWithValue) {
    return argWithValue.slice(argPrefix.length);
  }

  const argIndex = process.argv.indexOf(name);

  if (argIndex === -1) {
    return "";
  }

  return process.argv[argIndex + 1] || "";
}

function getWebSocketPort(config) {
  const value = process.env.SPEECH_WS_PORT || config.websocketPort || DEFAULT_WEBSOCKET_PORT;
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid WebSocket port: ${value}`);
  }

  return port;
}

function getKeywordAudioTriggers(config) {
  if (!Array.isArray(config.keywordAudioTriggers)) {
    return DEFAULT_KEYWORD_AUDIO_TRIGGERS;
  }

  const triggers = config.keywordAudioTriggers.map((trigger) => ({
    phrase: String((trigger && trigger.phrase) || "").trim(),
    audio: String((trigger && trigger.audio) || "").trim(),
  }));
  const invalidTrigger = triggers.find((trigger) => !trigger.phrase || !trigger.audio);

  if (invalidTrigger) {
    throw new Error("Invalid keywordAudioTriggers config. Each trigger needs phrase and audio.");
  }

  return triggers;
}

function findModelPath(config) {
  if (process.env.VOSK_MODEL_PATH) {
    return path.resolve(process.env.VOSK_MODEL_PATH);
  }

  if (config.modelPath) {
    return path.resolve(config.modelPath);
  }

  if (!fs.existsSync(MODELS_DIR)) {
    return DEFAULT_MODEL_DIR;
  }

  const entries = fs.readdirSync(MODELS_DIR, { withFileTypes: true });
  const modelDir =
    entries.find((entry) => entry.isDirectory() && entry.name.startsWith("vosk-model")) ||
    entries.find((entry) => entry.isDirectory());

  if (!modelDir) {
    return DEFAULT_MODEL_DIR;
  }

  return path.join(MODELS_DIR, modelDir.name);
}

function listAudioDevices() {
  return new Promise((resolve, reject) => {
    const args = ["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"];
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      output += data.toString();
    });

    child.on("error", reject);

    child.on("close", () => {
      const devices = parseDshowAudioDevices(output);

      if (!devices.length) {
        reject(new Error(`No audio input devices found.\n\nffmpeg output:\n${output.trim()}`));
        return;
      }

      resolve(devices);
    });
  });
}

function parseDshowAudioDevices(output) {
  const devices = [];
  let inAudioDevices = false;

  output.split(/\r?\n/).forEach((line) => {
    if (line.includes("DirectShow audio devices")) {
      inAudioDevices = true;
      return;
    }

    if (line.includes("DirectShow video devices")) {
      inAudioDevices = false;
      return;
    }

    if (!inAudioDevices || line.includes("Alternative name")) {
      const typedMatch = line.match(/"([^"]+)"\s+\(([^)]+)\)/);

      if (
        typedMatch &&
        typedMatch[2].toLowerCase().includes("audio") &&
        !devices.includes(typedMatch[1])
      ) {
        devices.push(typedMatch[1]);
      }

      return;
    }

    const match = line.match(/"([^"]+)"/);

    if (match && !devices.includes(match[1])) {
      devices.push(match[1]);
    }
  });

  return devices;
}

async function chooseDevice(devices) {
  console.log("Available audio input devices:");
  devices.forEach((device, index) => {
    console.log(`${index + 1}. ${device}`);
  });

  while (true) {
    const answer = await ask("Choose a device number: ");
    const selectedIndex = Number(answer.trim()) - 1;

    if (Number.isInteger(selectedIndex) && devices[selectedIndex]) {
      return devices[selectedIndex];
    }

    console.log(`Enter a number from 1 to ${devices.length}.`);
  }
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function normalizeTranscript(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function transcriptHasPhrase(transcript, phrase) {
  const normalizedTranscript = normalizeTranscript(transcript);
  const normalizedPhrase = normalizeTranscript(phrase);

  return normalizedTranscript.includes(normalizedPhrase);
}

function logKeywordTriggers(text, source, triggerCooldowns, broadcaster, keywordAudioTriggers) {
  const now = Date.now();

  keywordAudioTriggers.forEach((trigger) => {
    const triggerKey = `${trigger.phrase}:${trigger.audio}`;
    const lastTriggeredAt = triggerCooldowns.get(triggerKey) || 0;

    if (
      now - lastTriggeredAt < TRIGGER_COOLDOWN_MS ||
      !transcriptHasPhrase(text, trigger.phrase)
    ) {
      return;
    }

    triggerCooldowns.set(triggerKey, now);
    console.log(`[trigger:${source}] phrase="${trigger.phrase}" audio="${trigger.audio}"`);
    broadcaster.broadcast({
      type: "trigger",
      phrase: trigger.phrase,
      audio: trigger.audio,
    });
  });
}

function startWebSocketServer(port) {
  return new Promise((resolve, reject) => {
    const clients = new Set();
    const server = http.createServer((request, response) => {
      response.writeHead(404);
      response.end();
    });

    function broadcast(message) {
      const frame = createWebSocketFrame(JSON.stringify(message));

      clients.forEach((client) => {
        if (client.destroyed) {
          clients.delete(client);
          return;
        }

        client.write(frame, (error) => {
          if (error) {
            clients.delete(client);
          }
        });
      });
    }

    function close() {
      clients.forEach((client) => {
        client.end();
      });
      clients.clear();
      server.close();
    }

    server.on("upgrade", (request, socket) => {
      const key = request.headers["sec-websocket-key"];

      if (!key) {
        socket.destroy();
        return;
      }

      const acceptKey = crypto
        .createHash("sha1")
        .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest("base64");

      socket.write(
        [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${acceptKey}`,
          "",
          "",
        ].join("\r\n")
      );

      clients.add(socket);
      console.log(`WebSocket client connected: ${request.socket.remoteAddress}`);
      broadcast({ type: "status", status: "client_connected" });

      socket.on("data", (data) => {
        handleClientWebSocketFrame(socket, data);
      });

      socket.on("close", () => {
        clients.delete(socket);
      });

      socket.on("error", () => {
        clients.delete(socket);
      });
    });

    server.on("error", reject);

    server.listen(port, "127.0.0.1", () => {
      console.log(`WebSocket server listening on ws://localhost:${port}`);
      resolve({ broadcast, close });
    });
  });
}

function createWebSocketFrame(value, opcode = 1) {
  const payload = Buffer.from(value);

  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]);
  }

  if (payload.length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

function handleClientWebSocketFrame(socket, data) {
  const opcode = data[0] & 0x0f;

  if (opcode === 0x8) {
    socket.write(createWebSocketFrame("", 0x8));
    socket.end();
    return;
  }

  if (opcode === 0x9) {
    socket.write(createWebSocketFrame("", 0x0a));
  }
}

function findPackagedTranscriber() {
  const candidates = [];

  if (process.env.SPEECH_TRANSCRIBE_EXE) {
    candidates.push(process.env.SPEECH_TRANSCRIBE_EXE);
  }

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, "transcribe", PACKAGED_TRANSCRIBE_HELPER));
  }

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function findSpeechHelper() {
  const packagedTranscriber = findPackagedTranscriber();

  if (packagedTranscriber) {
    return {
      command: packagedTranscriber,
      args: [],
      label: packagedTranscriber,
    };
  }

  const python = await findPython();

  return {
    command: python.command,
    args: [...python.args, TRANSCRIBE_HELPER],
    label: [python.command, ...python.args].join(" "),
  };
}

function findPython() {
  const candidates = process.env.PYTHON
    ? [{ command: process.env.PYTHON, args: [] }]
    : [
      { command: "py", args: ["-3"] },
      { command: "python", args: [] },
    ];

  return new Promise((resolve, reject) => {
    let index = 0;

    function tryNext() {
      const candidate = candidates[index];

      if (!candidate) {
        reject(
          new Error(
            "Could not find Python. Install Python 3, or set the PYTHON environment variable."
          )
        );
        return;
      }

      index += 1;

      const child = spawn(candidate.command, [...candidate.args, "--version"], {
        windowsHide: true,
      });

      child.on("error", tryNext);
      child.on("close", (code) => {
        if (code === 0) {
          resolve(candidate);
          return;
        }

        tryNext();
      });
    }

    tryNext();
  });
}

function startListening(deviceName, modelPath, speechHelper, broadcaster, keywordAudioTriggers) {
  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-f",
    "dshow",
    "-i",
    `audio=${deviceName}`,
    "-ac",
    "1",
    "-ar",
    String(SAMPLE_RATE),
    "-f",
    "s16le",
    "-",
  ];
  const transcriberArgs = [
    ...speechHelper.args,
    "--model",
    modelPath,
    "--sample-rate",
    String(SAMPLE_RATE),
  ];
  const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const transcriber = spawn(speechHelper.command, transcriberArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let hasTranscript = false;
  let lastPartial = "";
  let stopping = false;
  let transcriptBuffer = "";
  let ffmpegClosed = false;
  let transcriberClosed = false;
  const triggerCooldowns = new Map();

  function logTranscriptStarted() {
    if (!hasTranscript) {
      console.log("Transcript results are being received.");
      hasTranscript = true;
    }
  }

  function stop() {
    if (stopping) {
      return;
    }

    stopping = true;
    console.log("Stopping listener...");
    broadcaster.broadcast({ type: "status", status: "paused" });
    if (ffmpeg.exitCode === null) {
      ffmpeg.kill("SIGINT");
    }

    if (transcriber.exitCode === null) {
      transcriber.kill("SIGINT");
    }
  }

  function maybeRemoveSignalHandlers() {
    if (!ffmpegClosed || !transcriberClosed) {
      return;
    }

    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    broadcaster.close();
  }

  function handleTranscriptLine(line) {
    if (!line.trim()) {
      return;
    }

    let event;

    try {
      event = JSON.parse(line);
    } catch (error) {
      console.error(`[speech] ${line}`);
      return;
    }

    if (event.type === "ready") {
      console.log(event.message);
      broadcaster.broadcast({ type: "status", status: "listening" });
      return;
    }

    if (event.type === "error") {
      console.error(`Speech recognition failed: ${event.message}`);
      process.exitCode = 1;
      broadcaster.broadcast({ type: "status", status: "paused" });
      stop();
      return;
    }

    if (event.type === "final" && event.text) {
      logTranscriptStarted();
      console.log(`[final] ${event.text}`);
      broadcaster.broadcast({ type: "transcript", text: event.text, final: true });
      logKeywordTriggers(event.text, "final", triggerCooldowns, broadcaster, keywordAudioTriggers);
      lastPartial = "";
      return;
    }

    if (event.type === "partial" && event.text && event.text !== lastPartial) {
      logTranscriptStarted();
      console.log(`[partial] ${event.text}`);
      broadcaster.broadcast({ type: "transcript", text: event.text, final: false });
      logKeywordTriggers(event.text, "partial", triggerCooldowns, broadcaster, keywordAudioTriggers);
      lastPartial = event.text;
    }
  }

  ffmpeg.on("spawn", () => {
    console.log("Audio capture started.");
    console.log("Waiting for transcript results...");
  });

  transcriber.on("spawn", () => {
    console.log(`Speech recognition helper started with ${speechHelper.label}.`);
  });

  ffmpeg.stdout.pipe(transcriber.stdin);

  transcriber.stdin.on("error", (error) => {
    if (error.code !== "EPIPE") {
      console.error(`Could not send audio to speech recognition: ${error.message}`);
    }
  });

  transcriber.stdout.on("data", (data) => {
    transcriptBuffer += data.toString();

    const lines = transcriptBuffer.split(/\r?\n/);
    transcriptBuffer = lines.pop();
    lines.forEach(handleTranscriptLine);
  });

  ffmpeg.stderr.on("data", (data) => {
    const message = data.toString().trim();

    if (message) {
      console.error(`[audio] ${message}`);
    }
  });

  transcriber.stderr.on("data", (data) => {
    const message = data.toString().trim();

    if (message) {
      console.error(`[speech] ${message}`);
    }
  });

  ffmpeg.on("error", (error) => {
    console.error(`Failed to start audio capture: ${error.message}`);
    process.exitCode = 1;
    stop();
  });

  transcriber.on("error", (error) => {
    console.error(`Failed to start speech recognition: ${error.message}`);
    process.exitCode = 1;
    stop();
  });

  ffmpeg.on("close", (code, signal) => {
    ffmpegClosed = true;

    if (!stopping) {
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      console.log(`Audio capture stopped with ${reason}.`);
      broadcaster.broadcast({ type: "status", status: "paused" });

      if (code) {
        process.exitCode = code;
      }
    }

    maybeRemoveSignalHandlers();
  });

  transcriber.on("close", (code, signal) => {
    transcriberClosed = true;

    if (transcriptBuffer.trim()) {
      handleTranscriptLine(transcriptBuffer);
      transcriptBuffer = "";
    }

    if (!stopping) {
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      console.log(`Speech recognition stopped with ${reason}.`);
      broadcaster.broadcast({ type: "status", status: "paused" });

      if (code) {
        process.exitCode = code;
        stop();
      }
    }

    maybeRemoveSignalHandlers();
  });

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
