# Speech Listener Service

Local Windows speech listener for a selected microphone. The Node app captures audio with ffmpeg DirectShow and runs local speech-to-text through a small Python Vosk helper process.

## Install

```powershell
npm install
```

Install the Python Vosk package:

```powershell
py -3 -m pip install vosk
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

On first run, the app lists available audio input devices and prompts for a number. It saves the selected device in `.speech-listener-config.json` and uses that device automatically on future runs.

## Re-select Device

```powershell
npm start -- --select-device
```

## External Prerequisites

- Windows with a working microphone input device
- Node.js and npm
- Python 3 with the `vosk` package installed
- A local Vosk speech model

The app uses `ffmpeg-static`, so a separate ffmpeg install is usually not needed.
