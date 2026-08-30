const state = {
  jobs: [],
  selectedId: null,
  lastAnswer: "",
};

const el = (id) => document.getElementById(id);

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function snippet(text, n = 420) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= n) return clean;
  return `${clean.slice(0, n).trim()}…`;
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || res.statusText || "Request failed");
  }
  return data;
}

function renderStats(stats) {
  const pills = el("stats-pills");
  const by = stats.by_status || {};
  pills.innerHTML = [
    ["total", stats.total || 0],
    ["new", by.new || 0],
    ["saved", by.saved || 0],
  ]
    .map(([k, v]) => `<span class="pill">${k} ${v}</span>`)
    .join("");
}

function renderList() {
  const root = el("job-list");
  if (!state.jobs.length) {
    root.innerHTML =
      '<div class="empty">The wire is quiet. Pull public boards, or loosen keywords in config.yaml.</div>';
    return;
  }
  root.innerHTML = state.jobs
    .map((job) => {
      const active = job.id === state.selectedId ? "active" : "";
      return `<button class="job-card ${active}" data-id="${job.id}" type="button">
        <div class="title">${escapeHtml(job.title)}</div>
        <div class="meta">
          <span class="badge ${job.status}">${job.status}</span>
          ${escapeHtml(job.company || "Unknown co.")} · ${escapeHtml(job.source)} · ${fmtTime(job.posted_at)}
        </div>
      </button>`;
    })
    .join("");
  root.querySelectorAll(".job-card").forEach((card) => {
    card.addEventListener("click", () => selectJob(Number(card.dataset.id)));
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function selectJob(id) {
  state.selectedId = id;
  renderList();
  const job = await api(`/api/jobs/${id}`);
  const detail = el("job-detail");
  const tags = (job.tags || []).slice(0, 8).join(" · ");
  detail.classList.remove("empty-detail");
  detail.innerHTML = `
    <div class="detail-meta">${escapeHtml(job.source)} · posted ${fmtTime(job.posted_at)}</div>
    <h2>${escapeHtml(job.title)}</h2>
    <div class="detail-meta">${escapeHtml(job.company || "—")} · ${escapeHtml(job.location || "—")}</div>
    <div class="detail-actions">
      <a class="btn btn-ink" href="${job.url}" target="_blank" rel="noopener">Open listing</a>
      <button class="btn" data-status="saved" type="button">Save</button>
      <button class="btn" data-status="dismissed" type="button">Dismiss</button>
      <button class="btn" data-status="new" type="button">Mark new</button>
    </div>
    <p class="muted">${escapeHtml(tags)}</p>
    <div class="description">${escapeHtml(snippet(job.description, 1800))}</div>
  `;
  detail.querySelectorAll("[data-status]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/api/jobs/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: btn.dataset.status }),
      });
      await loadJobs();
      selectJob(id);
    });
  });
}

async function loadJobs() {
  const params = new URLSearchParams();
  const status = el("status-filter").value;
  const source = el("source-filter").value;
  const q = el("search").value.trim();
  if (status) params.set("status", status);
  if (source) params.set("source", source);
  if (q) params.set("q", q);
  const data = await api(`/api/jobs?${params.toString()}`);
  state.jobs = data.jobs || [];
  renderList();
  const stats = await api("/api/stats");
  renderStats(stats);
}

async function pullWire() {
  const btn = el("poll-btn");
  const status = el("poll-status");
  btn.disabled = true;
  status.textContent = "Fetching public feeds…";
  try {
    const data = await api("/api/collect", { method: "POST" });
    const bits = (data.results || []).map((row) => {
      if (row.error) return `${row.source}: ${row.error}`;
      return `${row.source} +${row.inserted}`;
    });
    status.textContent = bits.join(" · ") || "Done";
    await loadJobs();
  } catch (err) {
    status.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

el("poll-btn").addEventListener("click", pullWire);
el("search").addEventListener("input", () => {
  clearTimeout(el("search")._t);
  el("search")._t = setTimeout(loadJobs, 180);
});
el("status-filter").addEventListener("change", loadJobs);
el("source-filter").addEventListener("change", loadJobs);

el("suggest-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = el("question").value.trim();
  const out = el("suggest-out");
  const err = el("suggest-error");
  const meta = el("suggest-meta");
  err.hidden = true;
  try {
    const body = { question, job_id: state.selectedId };
    const data = await api("/api/suggest", {
      method: "POST",
      body: JSON.stringify(body),
    });
    state.lastAnswer = data.answer;
    out.hidden = false;
    out.textContent = data.answer;
    meta.textContent = `${data.source}${data.provider && data.provider !== "none" ? ` · ${data.provider}` : ""}`;
    el("copy-btn").disabled = false;
  } catch (ex) {
    err.hidden = false;
    err.textContent = ex.message;
  }
});

el("copy-btn").addEventListener("click", async () => {
  if (!state.lastAnswer) return;
  await navigator.clipboard.writeText(state.lastAnswer);
  el("copy-btn").textContent = "Copied";
  setTimeout(() => {
    el("copy-btn").textContent = "Copy";
  }, 1200);
});

function tickClock() {
  el("clock").textContent = new Date().toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

tickClock();
setInterval(tickClock, 30000);
loadJobs().catch((err) => {
  el("job-list").innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
});
