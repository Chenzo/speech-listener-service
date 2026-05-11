# Stream Voice Triggers

https://chenzo.github.io/stream-voice-triggers/

Local voice trigger app for OBS overlays and MP3 alerts. The Node app captures audio with ffmpeg DirectShow on Windows or AVFoundation on macOS, and runs local speech-to-text through a small Python Vosk helper process.

## Install

```powershell
npm install
```

Install the Python Vosk package:

```powershell
py -3 -m pip install vosk
```

On macOS:

```sh
python3 -m pip install vosk
```

Download a Vosk speech model from https://alphacephei.com/vosk/models and extract it into a local `models` folder. The default expected path is:

```text
models/vosk-model-small-en-us-0.15
```

You can install that default model with:

```powershell
npm run install-model
```

You can also point to a model elsewhere:

```powershell
$env:VOSK_MODEL_PATH="C:\path\to\vosk-model-small-en-us-0.15"
```

## Run

```powershell
npm start
```

On first run, the app lists available audio input devices and prompts for a number. It saves the selected device in `.stream-voice-triggers-config.json` and uses that device automatically on future runs.

The app also starts a local WebSocket server at:

```text
ws://localhost:3011
```

## Re-select Device

```powershell
npm start -- --select-device
```

## WebSocket Port

The default port is `3011`. To change it for one terminal session:

```powershell
$env:STREAM_VOICE_TRIGGERS_WS_PORT="3012"
npm start
```

You can also add `websocketPort` to `.stream-voice-triggers-config.json`:

```json
{
  "audioDeviceName": "Your Microphone Name",
  "modelPath": "C:\\path\\to\\vosk-model-small-en-us-0.15",
  "websocketPort": 3012,
  "keywordAudioTriggers": [
    { "phrase": "rock", "audio": "rl_short" }
  ]
}
```

The environment variable takes priority over the config file.

The Electron app exposes microphone, Vosk model folder, WebSocket port, and keyword trigger settings in the launcher UI.

## Portable Electron Build

```powershell
npm run dist
```

The portable build bundles the Python/Vosk helper with PyInstaller, so release users do not need a separate Python or Python `vosk` install. Building the release still requires PyInstaller and the Python `vosk` package on the build machine.

Release users still need to download and extract a Vosk model. In the Electron app, use **Choose** next to **Vosk model** and select the extracted model folder, such as `vosk-model-small-en-us-0.15`.

## WebSocket Messages

Transcript messages:

```json
{ "type": "transcript", "text": "hello there", "final": false }
```

Trigger messages:

```json
{ "type": "trigger", "phrase": "rock", "audio": "rl_short" }
```

Status messages:

```json
{ "type": "status", "status": "listening" }
{ "type": "status", "status": "paused" }
{ "type": "status", "status": "client_connected" }
```

## External Prerequisites

- Windows or macOS with a working microphone input device
- Node.js and npm
- Python 3 with the `vosk` package installed
- A local Vosk speech model

On macOS, allow microphone access for the app you use to launch Stream Voice Triggers, such as Terminal or Electron, in System Settings > Privacy & Security > Microphone.

The app uses `ffmpeg-static`, so a separate ffmpeg install is usually not needed.




----

## Create Releases

```
git checkout main
git merge your-branch
npm version 0.1.0
npm run dist
git push
git push --tags
```
