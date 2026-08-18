from flask import Flask, render_template, request, jsonify
import requests
import os

app = Flask(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "600"))

MODES = {
    "explain": "Explain the code clearly, line by line where useful. Do not rewrite it unless needed to clarify.",
    "debug": "Find syntax errors, runtime risks, logical bugs, edge cases, and likely causes. Be specific.",
    "fix": "Find the problems and provide a corrected version of the code. Preserve the intended behavior.",
    "optimize": "Suggest meaningful improvements for readability, performance, maintainability, and idiomatic style. Provide improved code when useful.",
    "complexity": "Analyze time complexity and space complexity. Explain the dominant operations and how the complexity changes with input size.",
    "all": "Perform a complete code review: explain the code, find bugs, provide fixes, suggest optimizations, discuss edge cases, and analyze time/space complexity."
}

def ollama_generate(model, prompt, system):
    payload = {
        "model": model,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {
            "temperature": 0.2
        }
    }
    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json=payload,
        timeout=TIMEOUT
    )
    response.raise_for_status()
    data = response.json()
    return data.get("response", ""), data

@app.route("/")
def index():
    return render_template("index.html", default_model=DEFAULT_MODEL)

@app.get("/api/health")
def health():
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        r.raise_for_status()
        return jsonify({"ok": True, "models": r.json().get("models", [])})
    except requests.RequestException as e:
        return jsonify({"ok": False, "error": str(e), "models": []}), 503

@app.post("/api/analyze")
def analyze():
    body = request.get_json(silent=True) or {}
    code = (body.get("code") or "").strip()
    language = (body.get("language") or "Python").strip()
    mode = body.get("mode") or "all"
    level = body.get("level") or "normal"
    model = (body.get("model") or DEFAULT_MODEL).strip()

    if not code:
        return jsonify({"error": "Please enter some code."}), 400

    if mode not in MODES:
        mode = "all"

    audience = (
        "Explain everything for a beginner using simple language and small examples."
        if level == "beginner"
        else
        "Use a technical but understandable explanation suitable for a college student."
    )

    system = f"""You are an expert programming mentor and code reviewer.
The user's programming language is {language}.
{audience}
{MODES[mode]}

Rules:
- Do not claim that you executed the code unless the user explicitly provides execution output.
- Clearly separate confirmed syntax issues from possible runtime or logical issues.
- When showing corrected code, put it in a fenced code block.
- Keep the response structured with headings and bullet points.
- Do not invent errors that are not supported by the supplied code.
"""

    prompt = f"""Analyze the following {language} code.

Requested analysis mode: {mode}

CODE:
```{language.lower()}
{code}
```
"""

    try:
        answer, raw = ollama_generate(model, prompt, system)
        return jsonify({
            "answer": answer,
            "model": raw.get("model", model),
            "duration_ms": round(raw.get("total_duration", 0) / 1_000_000),
            "eval_count": raw.get("eval_count", 0)
        })
    except requests.exceptions.ConnectionError:
        return jsonify({
            "error": "Cannot connect to Ollama. Make sure Ollama is installed and running."
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({"error": "Ollama took too long to respond. Try a smaller model or shorter code."}), 504
    except requests.HTTPError as e:
        detail = e.response.text if e.response is not None else str(e)
        return jsonify({"error": f"Ollama API error: {detail}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
