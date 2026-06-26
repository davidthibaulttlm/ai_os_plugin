import os
import tempfile

import requests
from fastapi import FastAPI, File, UploadFile
from fastapi.staticfiles import StaticFiles
from faster_whisper import WhisperModel

LLAMA_URL = os.environ.get("LLAMA_URL", "http://host.docker.internal:8080/v1/chat/completions")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cuda")
WHISPER_COMPUTE = os.environ.get("WHISPER_COMPUTE", "float16")
LANG_CODE = os.environ.get("LANG_CODE") or None  # None = auto-detect
SYSTEM_PROMPT = os.environ.get(
    "SYSTEM_PROMPT",
    "You are a helpful voice assistant. Keep replies short and natural for speech.",
)

model = WhisperModel(WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE)

app = FastAPI()


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    data = await audio.read()
    with tempfile.NamedTemporaryFile(suffix=".wav") as f:
        f.write(data)
        f.flush()
        segments, _ = model.transcribe(f.name, vad_filter=True, language=LANG_CODE)
        text = " ".join(s.text for s in segments).strip()
    return {"text": text}


@app.post("/chat")
async def chat(payload: dict):
    body = {
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + (payload.get("messages") or []),
        "temperature": 0.7,
        "max_tokens": 512,
        "stream": False,
    }
    r = requests.post(LLAMA_URL, json=body, timeout=180)
    r.raise_for_status()
    reply = r.json()["choices"][0]["message"]["content"].strip()
    return {"reply": reply}


# Serve the web UI at "/". Declared last so the API routes above take precedence.
app.mount("/", StaticFiles(directory="static", html=True), name="static")
