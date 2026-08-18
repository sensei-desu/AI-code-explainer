const $ = (id) => document.getElementById(id);

const codeEl = $("code");
const modelEl = $("model");
const resultEl = $("result");
const analyzeBtn = $("analyzeBtn");
const copyBtn = $("copyBtn");
const downloadBtn = $("downloadBtn");
const statusEl = $("status");
const metaEl = $("meta");
let latestAnswer = "";

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function markdownLite(text) {
  const blocks = [];
  let t = text.replace(/```(?:[\w#+.-]+)?\n?([\s\S]*?)```/g, (_, code) => {
    const key = `@@CODE${blocks.length}@@`;
    blocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return key;
  });

  t = escapeHtml(t)
    .replace(/^### (.*)$/gm, "<h4>$1</h4>")
    .replace(/^## (.*)$/gm, "<h3>$1</h3>")
    .replace(/^# (.*)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/^\s*[-*] (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");

  t = `<p>${t}</p>`;
  blocks.forEach((b, i) => t = t.replace(`@@CODE${i}@@`, b));
  return t;
}

function updateCounts() {
  const lines = codeEl.value ? codeEl.value.split("\n").length : 1;
  $("lineCount").textContent = `${lines} line${lines === 1 ? "" : "s"}`;
  $("charCount").textContent = `${codeEl.value.length} characters`;
}

async function loadModels() {
  try {
    const r = await fetch("/api/health");
    const data = await r.json();
    if (!data.ok) throw new Error();
    statusEl.className = "status online";
    statusEl.innerHTML = "<span></span> Ollama online";

    const models = data.models || [];
    const current = modelEl.value;
    modelEl.innerHTML = "";
    if (!models.length) {
      const opt = document.createElement("option");
      opt.value = current || "gemma3";
      opt.textContent = `${current || "gemma3"} (not installed?)`;
      modelEl.appendChild(opt);
      return;
    }
    models.forEach(m => {
      const name = m.name || m.model;
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      modelEl.appendChild(opt);
    });
    if (models.some(m => (m.name || m.model) === current)) modelEl.value = current;
  } catch {
    statusEl.className = "status offline";
    statusEl.innerHTML = "<span></span> Ollama offline";
  }
}

async function analyze() {
  const code = codeEl.value.trim();
  if (!code) {
    resultEl.innerHTML = '<div class="error">Please enter some code first.</div>';
    return;
  }

  analyzeBtn.disabled = true;
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  $("loading").classList.remove("hidden");
  resultEl.innerHTML = "";
  metaEl.textContent = "Ollama is analyzing…";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        code,
        language: $("language").value,
        mode: $("mode").value,
        level: $("level").value,
        model: modelEl.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Analysis failed.");

    latestAnswer = data.answer || "";
    resultEl.innerHTML = markdownLite(latestAnswer);
    metaEl.textContent = `${data.model || modelEl.value} • ${data.duration_ms || 0} ms • ${data.eval_count || 0} output tokens`;
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
    saveHistory(code, data);
    renderHistory();
  } catch (err) {
    resultEl.innerHTML = `<div class="error"><strong>Could not analyze.</strong><br>${escapeHtml(err.message)}</div>`;
    metaEl.textContent = "Request failed";
  } finally {
    $("loading").classList.add("hidden");
    analyzeBtn.disabled = false;
  }
}

function saveHistory(code, data) {
  const history = JSON.parse(localStorage.getItem("codepilot_history") || "[]");
  history.unshift({
    code: code.slice(0, 3000),
    answer: data.answer || "",
    language: $("language").value,
    mode: $("mode").value,
    model: data.model || modelEl.value,
    time: new Date().toLocaleString()
  });
  localStorage.setItem("codepilot_history", JSON.stringify(history.slice(0, 12)));
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem("codepilot_history") || "[]");
  const el = $("history");
  if (!history.length) {
    el.innerHTML = '<p style="color:#9aa4b5">No analyses yet.</p>';
    return;
  }
  el.innerHTML = history.map((h, i) => `
    <div class="history-card" data-i="${i}">
      <div class="history-title">${escapeHtml(h.language)} · ${escapeHtml(h.mode)}</div>
      <div class="history-info">${escapeHtml(h.model)} · ${escapeHtml(h.time)}</div>
      <div class="history-code">${escapeHtml(h.code.replace(/\s+/g," "))}</div>
    </div>
  `).join("");
  document.querySelectorAll(".history-card").forEach(card => {
    card.addEventListener("click", () => {
      const h = history[Number(card.dataset.i)];
      codeEl.value = h.code;
      $("language").value = h.language;
      $("mode").value = h.mode;
      if ([...modelEl.options].some(o => o.value === h.model)) modelEl.value = h.model;
      latestAnswer = h.answer;
      resultEl.innerHTML = markdownLite(h.answer);
      metaEl.textContent = `${h.model} • restored from history`;
      copyBtn.disabled = false;
      downloadBtn.disabled = false;
      updateCounts();
      window.scrollTo({top:0, behavior:"smooth"});
    });
  });
}

$("clearBtn").addEventListener("click", () => {
  codeEl.value = "";
  resultEl.innerHTML = '<div class="empty"><div class="empty-icon">⌘</div><h3>Your analysis will appear here</h3><p>Choose a mode and click <b>Analyze Code</b>.</p></div>';
  metaEl.textContent = "Ready for analysis";
  latestAnswer = "";
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  updateCounts();
});

$("clearHistory").addEventListener("click", () => {
  localStorage.removeItem("codepilot_history");
  renderHistory();
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(latestAnswer);
  copyBtn.textContent = "Copied!";
  setTimeout(() => copyBtn.textContent = "Copy", 1200);
});

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([latestAnswer], {type:"text/plain;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "codepilot-analysis.txt";
  a.click();
  URL.revokeObjectURL(a.href);
});

analyzeBtn.addEventListener("click", analyze);
codeEl.addEventListener("input", updateCounts);
codeEl.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyze();
});

updateCounts();
renderHistory();
loadModels();
