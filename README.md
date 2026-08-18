# CodePilot — AI Code Explainer & Debugger

A local college project that uses **Python Flask + Ollama API** to explain, debug, fix, optimize, and analyze programming code.

## Features

- Explain code
- Find syntax, runtime, and logical issues
- Generate corrected code
- Optimize code
- Time and space complexity analysis
- Complete code review
- Beginner-friendly mode
- Multiple programming-language options
- Automatically detects installed Ollama models
- Copy AI response
- Download analysis
- Local browser history
- Ollama connection status
- Response timing and token information

## Project Architecture

```text
HTML / CSS / JavaScript
          ↓
       Flask
          ↓
     Ollama API
          ↓
      AI Model
```

Everything runs locally on your computer.

## Requirements

- Python 3.10 or newer
- Ollama
- At least one Ollama model

## 1. Install an Ollama model

For example:

```bash
ollama pull gemma3
```

You can use another installed Ollama model too.

Check installed models:

```bash
ollama list
```

## 2. Open the project folder

Open a terminal inside the project folder.

## 3. Create a virtual environment

### Windows

```powershell
python -m venv .venv
.venv\Scripts\activate
```

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

## 4. Install dependencies

```bash
pip install -r requirements.txt
```

## 5. Start the application

```bash
python app.py
```

Then open:

```text
http://127.0.0.1:5000
```

## Ollama API

The Flask backend communicates with Ollama using:

```text
http://localhost:11434/api/generate
```

The project also checks:

```text
http://localhost:11434/api/tags
```

to find installed models.

The main API request is made in `app.py`.

## Important Safety Note

This project **does not execute the user's code**.

It only sends the code to Ollama for AI analysis. This prevents arbitrary user code from being executed by the Flask server.

## GitHub

The project is structured to be uploaded directly to GitHub.

Do not upload:

- `.venv/`
- `.env`
- API keys or passwords
- large model files

The included `.gitignore` already excludes common local files.
