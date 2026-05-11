import argparse
import json
import sys

try:
    from vosk import KaldiRecognizer, Model, SetLogLevel
except ImportError:
    print(
        json.dumps(
            {
                "type": "error",
                "message": (
                    "Python package 'vosk' is not installed. Install it in the Python "
                    "environment used by Stream Voice Triggers."
                ),
            }
        ),
        flush=True,
    )
    sys.exit(1)


def emit(event):
    print(json.dumps(event, ensure_ascii=False), flush=True)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--sample-rate", type=float, required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    SetLogLevel(-1)

    model = Model(args.model)
    recognizer = KaldiRecognizer(model, args.sample_rate)
    last_partial = ""

    emit({"type": "ready", "message": "Speech recognition helper is ready."})

    while True:
        data = sys.stdin.buffer.read(4000)

        if not data:
            break

        if recognizer.AcceptWaveform(data):
            result = json.loads(recognizer.Result())
            text = result.get("text", "").strip()

            if text:
                emit({"type": "final", "text": text})

            last_partial = ""
            continue

        result = json.loads(recognizer.PartialResult())
        text = result.get("partial", "").strip()

        if text and text != last_partial:
            emit({"type": "partial", "text": text})
            last_partial = text

    result = json.loads(recognizer.FinalResult())
    text = result.get("text", "").strip()

    if text:
        emit({"type": "final", "text": text})

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        emit({"type": "error", "message": str(error)})
        sys.exit(1)
