// Octopus dashboard client. Keeps the SSR shell intact and patches card
// internals on each state push. Minimal deps — vanilla DOM.

const grid = document.getElementById("grid");
const heroSection = document.querySelector(".hero-section");
const heroCard = document.getElementById("hero-card");
const search = document.getElementById("search");
const refreshBtn = document.getElementById("refresh-btn");
const refreshIndicator = document.getElementById("refresh-indicator");

// Split-pane state — declared early so applyState can reference it.
let activeSplitArm = null;

// Keep in sync with src/colors.ts — Parachute-tuned tints against forest-dark bg.
const colorMap = {
  blue: "#8AA6BF",
  yellow: "#D4BC7E",
  purple: "#B09AC7",
  orange: "#D4A373",
  cyan: "#8CCFCE",
  green: "#7AB09D",
  pink: "#C9A0AA",
  red: "#C88A7D",
  teal: "#6FA5A0",
  slate: "#9B9590",
};

function colorFor(name) {
  return colorMap[name] ?? colorMap.slate;
}

function formatAge(ms) {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 2) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function formatJoinedAt(ms) {
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `today · ${time}`;
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${date} · ${time}`;
}

function escapeHtml(s) {
  return (s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]),
  );
}

function tailHtml(t) {
  if (t.lastTail && t.lastTail.length) {
    return `<pre class="tail" aria-label="recent output from ${escapeHtml(t.name)}">${escapeHtml(t.lastTail.join("\n"))}</pre>`;
  }
  const msg = t.status === "dead" ? "pane not found in live tmux" : "quiet for a moment";
  return `<pre class="tail tail-quiet" aria-label="recent output from ${escapeHtml(t.name)}"><span class="quiet-line">${msg}</span></pre>`;
}

function renderCard(t, compact) {
  const accent = colorFor(t.color);
  const classes = ["card", `card-${t.status}`];
  if (t.stale) classes.push("card-stale");
  if (compact) classes.push("card-compact");

  return `
<article class="${classes.join(" ")}" data-name="${escapeHtml(t.name)}" data-cwd="${escapeHtml(t.cwdShort)}" data-status="${t.status}" style="--tentacle: ${accent};">
  <header class="card-head">
    <div class="card-title">
      <span class="status-dot status-${t.status}" aria-label="${t.status}"></span>
      <h2 class="tentacle-name" style="color: ${accent};">${escapeHtml(t.name)}</h2>
    </div>
    <div class="card-meta">
      <span class="pill pill-${t.agentType}">${escapeHtml(t.agentType)}</span>
      ${t.stale ? `<span class="pill pill-warn" title="config tmuxPaneId doesn't match any live pane">stale</span>` : ""}
      <button type="button" class="card-close" data-shutdown="${escapeHtml(t.name)}" title="Shut down ${escapeHtml(t.name)}" aria-label="Shut down ${escapeHtml(t.name)}">×</button>
    </div>
  </header>
  <dl class="card-facts">
    <div><dt>cwd</dt><dd class="mono" title="${escapeHtml(t.cwd)}">${escapeHtml(t.cwdShort || "—")}</dd></div>
    <div><dt>pane</dt><dd class="mono">${t.livePaneId ? escapeHtml(t.livePaneId) : `<span class="dim">dead</span>`}</dd></div>
    <div><dt>activity</dt><dd class="age" data-age="${t.lastActivityMs ?? ""}">${formatAge(t.lastActivityMs)}</dd></div>
    <div><dt>joined</dt><dd>${formatJoinedAt(t.joinedAt)}</dd></div>
  </dl>
  ${tailHtml(t)}
  <footer class="card-foot"><a class="btn btn-primary" href="/pane/${encodeURIComponent(t.name)}">open</a></footer>
</article>`;
}

function renderHero(t) {
  const accent = colorFor(t.color) || "#7AB09D";
  const tailContent = t.lastTail && t.lastTail.length
    ? escapeHtml(t.lastTail.slice(-12).join("\n"))
    : `<span class="quiet-line">quiet for a moment</span>`;
  return `
<div class="hero-glyph" aria-hidden="true">${OCTOPUS_SVG}</div>
<div class="hero-titles">
  <div class="hero-row">
    <span class="status-dot status-${t.status}" aria-label="${t.status}"></span>
    <h2 class="hero-name">${escapeHtml(t.name)}</h2>
    <span class="pill pill-team-lead">team-lead</span>
  </div>
  <div class="hero-sub">
    <span class="mono dim" title="${escapeHtml(t.cwd)}">${escapeHtml(t.cwdShort || "—")}</span>
    <span class="hero-dot">·</span>
    <span class="mono dim">pane ${t.livePaneId ? escapeHtml(t.livePaneId) : "—"}</span>
    <span class="hero-dot">·</span>
    <span class="age" data-age="${t.lastActivityMs ?? ""}">${formatAge(t.lastActivityMs)}</span>
  </div>
</div>
<pre class="hero-tail" aria-label="recent output from ${escapeHtml(t.name)}">${tailContent}</pre>
<a class="btn btn-primary hero-open" href="/pane/${encodeURIComponent(t.name)}">open</a>`;
}

// Keep in sync with src/render.tsx OctopusGlyph.
const OCTOPUS_SVG = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M20 26 C20 16, 26 10, 32 10 S44 16, 44 26 V30 C44 32, 42 34, 40 34 H24 C22 34, 20 32, 20 30 Z" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
<circle cx="27.5" cy="23" r="1.4" fill="currentColor"/>
<circle cx="36.5" cy="23" r="1.4" fill="currentColor"/>
<path d="M23 34 C21 42, 15 46, 18 56" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
<path d="M30 34 C31 42, 26 50, 30 58" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
<path d="M34 34 C33 42, 38 50, 34 58" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
<path d="M41 34 C43 42, 49 46, 46 56" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

function applyHero(teamLead) {
  if (!heroCard) return;
  const accent = colorFor(teamLead.color) || "#7AB09D";
  heroCard.style.setProperty("--tentacle", accent);
  heroCard.dataset.status = teamLead.status;
  heroCard.className = `hero hero-${teamLead.status}`;
  heroCard.innerHTML = renderHero(teamLead);
  // Arms-flowing glow when team-lead is working.
  if (heroSection) {
    heroSection.classList.toggle("is-flowing", teamLead.status === "working");
  }
}

// Track which mentions we've already pulsed so we don't re-trigger every poll.
const lastMentionSet = new Set();

function applyMentions(mentioned) {
  if (!mentioned || !mentioned.length) {
    lastMentionSet.clear();
    return;
  }
  const fresh = mentioned.filter((n) => !lastMentionSet.has(n));
  // Keep set bounded but always reflect the current snapshot.
  lastMentionSet.clear();
  mentioned.forEach((n) => lastMentionSet.add(n));
  for (const name of fresh) {
    const card = grid?.querySelector(`.card[data-name="${cssEscape(name)}"]`);
    if (!card) continue;
    card.classList.remove("is-mentioned");
    void card.offsetWidth;
    card.classList.add("is-mentioned");
    setTimeout(() => card.classList.remove("is-mentioned"), 3000);
  }
}

function cssEscape(s) {
  return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/"/g, '\\"');
}

function applyState(snap) {
  const teamLead = snap.tentacles.find((t) => t.agentType === "team-lead");
  const others = snap.tentacles.filter((t) => t.agentType !== "team-lead");
  const compact = others.length >= 6;

  // Header pill counts
  const alive = snap.tentacles.filter((t) => t.status !== "dead").length;
  document.querySelectorAll("[data-stat]").forEach((el) => {
    const key = el.dataset.stat;
    const val = el.querySelector(".stat-value");
    if (!val) return;
    if (key === "alive") val.textContent = String(alive);
    else if (key === "roster") val.textContent = String(snap.totalMembers);
    else if (key === "panes") val.textContent = String(snap.livePanes);
  });

  if (teamLead) applyHero(teamLead);

  if (!grid) return;

  // Diff cards by name — only replace ones whose signature changed.
  const next = new Map(others.map((t) => [t.name, t]));
  const existing = new Map();
  grid.querySelectorAll(".card").forEach((el) => existing.set(el.dataset.name, el));

  // Remove cards no longer in snapshot
  for (const [name, el] of existing) {
    if (!next.has(name)) el.remove();
  }

  const fragment = document.createDocumentFragment();
  const template = document.createElement("div");
  for (const [name, t] of next) {
    const sig = signature(t);
    const el = existing.get(name);
    if (el && el.dataset.sig === sig) continue;
    template.innerHTML = renderCard(t, compact);
    const fresh = template.firstElementChild;
    fresh.dataset.sig = sig;
    if (el) {
      el.replaceWith(fresh);
      fresh.classList.add("is-updated");
      setTimeout(() => fresh.classList.remove("is-updated"), 1000);
    } else {
      fragment.appendChild(fresh);
    }
  }
  if (fragment.childNodes.length) grid.appendChild(fragment);

  // Re-apply active card highlight after grid re-render
  if (activeSplitArm) {
    grid.querySelectorAll(".card").forEach((el) => {
      el.classList.toggle("card-active", el.dataset.name === activeSplitArm);
    });
  }

  applySearch();
  if (teamLead && Array.isArray(teamLead.recentlyMentioned)) {
    applyMentions(teamLead.recentlyMentioned);
  }
}

function signature(t) {
  return [
    t.status,
    t.stale,
    t.livePaneId,
    t.lastActivityMs,
    (t.lastTail || []).join("\n"),
  ].join("::");
}

// Connect SSE stream -------------------------------------------------

let es;
let retry = 0;

function connect() {
  es = new EventSource("/api/stream");
  es.addEventListener("state", (ev) => {
    retry = 0;
    if (refreshIndicator) {
      refreshIndicator.textContent = "live";
      refreshIndicator.classList.remove("disconnected");
    }
    try {
      applyState(JSON.parse(ev.data));
    } catch (e) {
      console.error("bad state payload", e);
    }
  });
  es.addEventListener("error", () => {
    if (refreshIndicator) {
      refreshIndicator.textContent = "offline";
      refreshIndicator.classList.add("disconnected");
    }
    es.close();
    retry = Math.min(retry + 1, 5);
    setTimeout(connect, 500 * retry);
  });
}

connect();

// Manual refresh ---------------------------------------------------

async function manualRefresh() {
  try {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    applyState(await r.json());
  } catch (err) {
    toast(`refresh failed: ${err.message}`, true);
  }
}

refreshBtn?.addEventListener("click", () => {
  if (refreshBtn) {
    refreshBtn.classList.remove("spinning");
    void refreshBtn.offsetWidth;
    refreshBtn.classList.add("spinning");
    setTimeout(() => refreshBtn.classList.remove("spinning"), 450);
  }
  manualRefresh();
});

// Search ----------------------------------------------------------

function applySearch() {
  const q = (search?.value ?? "").trim().toLowerCase();
  grid?.querySelectorAll(".card").forEach((el) => {
    if (!q) {
      el.classList.remove("is-hidden");
      return;
    }
    const name = (el.dataset.name || "").toLowerCase();
    const cwd = (el.dataset.cwd || "").toLowerCase();
    if (name.includes(q) || cwd.includes(q)) el.classList.remove("is-hidden");
    else el.classList.add("is-hidden");
  });
}

search?.addEventListener("input", applySearch);

// Keyboard shortcuts ---------------------------------------------

document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  const typing = tag === "INPUT" || tag === "TEXTAREA";
  if (e.key === "/" && !typing) {
    e.preventDefault();
    search?.focus();
    search?.select();
  } else if (e.key === "r" && !typing && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    manualRefresh();
  } else if (e.key === "n" && !typing && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    openSpawnModal();
  } else if (e.key === "Escape") {
    const open = document.querySelector(".modal-backdrop:not([hidden])");
    if (open) {
      closeModal(open.id);
      return;
    }
    if (typing && search && document.activeElement === search) {
      search.blur();
      search.value = "";
      applySearch();
    }
  }
});

// Modals ---------------------------------------------------------
// Modals are SSR-only — applyState never re-renders them, so it's safe to
// cache references to their inputs/buttons at script load.

const focusReturnStack = [];

function focusableIn(el) {
  return el.querySelectorAll(
    "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
  );
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  focusReturnStack.push(document.activeElement);
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("is-open"));
  const focusTarget = el.querySelector("input, textarea, button");
  focusTarget?.focus();
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("is-open");
  setTimeout(() => {
    el.hidden = true;
  }, 180);
  // Clear any modal-scoped state.
  if (id === "shutdown-modal") pendingShutdown = null;
  if (id === "spawn-modal") {
    const err = document.getElementById("spawn-error");
    if (err) { err.textContent = ""; err.hidden = true; }
  }
  // Restore focus to whatever triggered the open.
  const prev = focusReturnStack.pop();
  prev?.focus?.();
}

document.querySelectorAll("[data-modal-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.modalClose));
});

// Click on backdrop (but not modal body) closes.
document.querySelectorAll(".modal-backdrop").forEach((bd) => {
  bd.addEventListener("click", (e) => {
    if (e.target === bd) closeModal(bd.id);
  });
});

// Trap Tab inside the open modal so keyboard users can't escape into the
// page behind it while the modal is up.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const open = document.querySelector(".modal-backdrop:not([hidden])");
  if (!open) return;
  const modal = open.querySelector(".modal");
  if (!modal) return;
  const items = Array.from(focusableIn(modal));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

// Spawn ---------------------------------------------------------

const spawnBtn = document.getElementById("spawn-btn");
const spawnForm = document.getElementById("spawn-form");
const targetList = document.getElementById("spawn-target-list");
let targetsLoaded = false;

async function loadSpawnTargets() {
  if (targetsLoaded || !targetList) return;
  try {
    const r = await fetch("/api/spawn-targets");
    const { targets } = await r.json();
    targetList.innerHTML = (targets ?? [])
      .map((t) => `<option value="${escapeHtml(t)}"></option>`)
      .join("");
    targetsLoaded = true;
  } catch {
    // non-fatal
  }
}

function openSpawnModal() {
  loadSpawnTargets();
  openModal("spawn-modal");
}

spawnBtn?.addEventListener("click", openSpawnModal);

const spawnError = document.getElementById("spawn-error");

function showSpawnError(msg) {
  if (!spawnError) return;
  spawnError.textContent = msg;
  spawnError.hidden = false;
}
function clearSpawnError() {
  if (!spawnError) return;
  spawnError.textContent = "";
  spawnError.hidden = true;
}

spawnForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearSpawnError();
  const data = new FormData(spawnForm);
  const body = {
    name: String(data.get("name") ?? "").trim(),
    cwd: String(data.get("cwd") ?? "").trim(),
    prompt: String(data.get("prompt") ?? "").trim(),
    cloneUrl: String(data.get("cloneUrl") ?? "").trim(),
  };
  const submit = spawnForm.querySelector("button[type=submit]");
  const submitLabel = submit.textContent;
  submit.disabled = true;
  if (body.cloneUrl) submit.textContent = "cloning…";
  try {
    const res = await fetch("/api/spawn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Inline error keeps the user's input visible so they can correct it.
      showSpawnError(j.error ?? `HTTP ${res.status}`);
      return;
    }
    toast(`/spawn typed to team-lead · watch the hero card for ${body.name}`);
    spawnForm.reset();
    closeModal("spawn-modal");
  } catch (err) {
    showSpawnError(err.message);
  } finally {
    submit.disabled = false;
    submit.textContent = submitLabel;
  }
});

// Shutdown -----------------------------------------------------

const shutdownModal = document.getElementById("shutdown-modal");
const shutdownConfirm = document.getElementById("shutdown-confirm");
const shutdownNameEl = document.getElementById("shutdown-name");
let pendingShutdown = null;

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-shutdown]");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  pendingShutdown = btn.dataset.shutdown;
  if (shutdownNameEl) shutdownNameEl.textContent = pendingShutdown;
  openModal("shutdown-modal");
});

shutdownConfirm?.addEventListener("click", async () => {
  if (!pendingShutdown) return;
  const name = pendingShutdown;
  shutdownConfirm.disabled = true;
  try {
    const res = await fetch(`/api/shutdown/${encodeURIComponent(name)}`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(`shutdown failed: ${j.error ?? res.status}`, true);
      return;
    }
    toast(`shutdown queued · ${name} (${j.method})`);
    closeModal("shutdown-modal");
  } catch (err) {
    toast(`shutdown failed: ${err.message}`, true);
  } finally {
    shutdownConfirm.disabled = false;
    pendingShutdown = null;
  }
});

// Ticking ages — cheap visual refresh between SSE pushes
setInterval(() => {
  document.querySelectorAll(".age").forEach((el) => {
    const raw = el.getAttribute("data-age");
    if (!raw) return;
    const ms = Number(raw) + 1000;
    el.setAttribute("data-age", String(ms));
    el.textContent = formatAge(ms);
  });
}, 1000);

// Toast -----------------------------------------------------------

function toast(msg, isError = false) {
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " toast-error" : "");
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-show"));
  setTimeout(() => {
    el.classList.remove("toast-show");
    setTimeout(() => el.remove(), 220);
  }, 2400);
}

// Split-pane dashboard ----------------------------------------
// Clicking a card opens its scrollback in a right panel instead
// of navigating to /pane/:name. The grid stays visible on the left.

const dashboard = document.querySelector(".dashboard");
const splitPanel = document.getElementById("split-panel");
const splitName = document.getElementById("split-name");
const splitMeta = document.getElementById("split-meta");
const splitStatusDot = document.getElementById("split-status-dot");
const splitScrollback = document.getElementById("split-scrollback");
const splitExpand = document.getElementById("split-expand");
const splitClose = document.getElementById("split-close");
const splitSendForm = document.getElementById("split-send-form");
const splitSendInput = document.getElementById("split-send-input");
const isMobile = () => window.innerWidth <= 720;

// (activeSplitArm declared at top of file for applyState access)
let splitEs = null;  // EventSource for the split pane stream

function atBottom(el) {
  return el.scrollHeight - el.clientHeight - el.scrollTop < 40;
}

function openSplit(name) {
  if (isMobile()) {
    // On mobile, fall back to navigate-away
    window.location.href = `/pane/${encodeURIComponent(name)}`;
    return;
  }
  if (activeSplitArm === name) {
    closeSplit();
    return;
  }

  activeSplitArm = name;

  // Update URL
  const url = new URL(window.location);
  url.searchParams.set("arm", name);
  history.replaceState(null, "", url);

  // Show panel, enter split layout
  splitPanel.hidden = false;
  dashboard.classList.add("dashboard-split");

  // Set header info
  splitName.textContent = `@${name}`;
  splitMeta.textContent = "";
  splitStatusDot.className = "status-dot";
  splitScrollback.textContent = "(loading…)";
  splitExpand.href = `/pane/${encodeURIComponent(name)}`;

  // Highlight active card
  grid?.querySelectorAll(".card").forEach((el) => {
    el.classList.toggle("card-active", el.dataset.name === name);
  });

  // Connect SSE for this pane
  if (splitEs) splitEs.close();
  let retries = 0;

  function connectPane() {
    splitEs = new EventSource(`/api/stream/pane/${encodeURIComponent(name)}`);
    splitEs.addEventListener("pane", (ev) => {
      retries = 0;
      try {
        const { tentacle, output } = JSON.parse(ev.data);
        // Update header meta
        splitMeta.textContent = tentacle.cwdShort || "";
        splitStatusDot.className = `status-dot status-${tentacle.status}`;

        // Update scrollback
        const stick = atBottom(splitScrollback);
        splitScrollback.textContent = output || "(no output)";
        if (stick) splitScrollback.scrollTop = splitScrollback.scrollHeight;
      } catch (err) {
        console.error("split pane error", err);
      }
    });
    splitEs.addEventListener("gone", () => {
      splitEs.close();
      splitScrollback.textContent += "\n\n— tentacle is gone —";
    });
    splitEs.addEventListener("error", () => {
      splitEs.close();
      retries = Math.min(retries + 1, 5);
      if (activeSplitArm === name) {
        setTimeout(connectPane, 500 * retries);
      }
    });
  }

  connectPane();
  splitSendInput.focus();
}

function closeSplit() {
  activeSplitArm = null;
  if (splitEs) { splitEs.close(); splitEs = null; }
  splitPanel.hidden = true;
  dashboard.classList.remove("dashboard-split");
  grid?.querySelectorAll(".card.card-active").forEach((el) => el.classList.remove("card-active"));

  // Clean URL
  const url = new URL(window.location);
  url.searchParams.delete("arm");
  history.replaceState(null, "", url);
}

// Close button
splitClose?.addEventListener("click", closeSplit);

// Card click → open split (but not when clicking shutdown or the open link on mobile)
document.addEventListener("click", (e) => {
  // Don't intercept shutdown buttons
  if (e.target.closest("[data-shutdown]")) return;
  const card = e.target.closest(".card[data-name]");
  if (!card) return;
  // If clicking the "open" link, intercept for split on desktop
  const openLink = e.target.closest(".card-foot a");
  if (openLink && !isMobile()) {
    e.preventDefault();
    openSplit(card.dataset.name);
    return;
  }
  // If the card itself was clicked (not a button/link inside it)
  if (!e.target.closest("a, button")) {
    e.preventDefault();
    openSplit(card.dataset.name);
  }
});

// Send form in split panel
splitSendForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeSplitArm) return;
  const text = splitSendInput.value;
  splitSendInput.disabled = true;
  try {
    const body = text.trim()
      ? { text, enter: true, mode: "text" }
      : { text: "Enter", mode: "key" };
    const res = await fetch(`/api/panes/${encodeURIComponent(activeSplitArm)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast(`send failed: ${j.error ?? res.status}`, true);
    } else {
      splitSendInput.value = "";
    }
  } catch (err) {
    toast(`send failed: ${err.message}`, true);
  } finally {
    splitSendInput.disabled = false;
    splitSendInput.focus();
  }
});

// Special key buttons in split panel
document.querySelectorAll("[data-split-key]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (!activeSplitArm) return;
    try {
      const res = await fetch(`/api/panes/${encodeURIComponent(activeSplitArm)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: btn.dataset.splitKey, mode: "key" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast(`key send failed: ${j.error ?? res.status}`, true);
      }
    } catch (err) {
      toast(`key send failed: ${err.message}`, true);
    }
  });
});

// Esc closes split panel (when not in an input/modal)
const origKeydown = document.querySelector("[data-page]");
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && activeSplitArm) {
    const tag = document.activeElement?.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA";
    const modalOpen = document.querySelector(".modal-backdrop:not([hidden])");
    if (!modalOpen) {
      if (typing && document.activeElement === splitSendInput) {
        splitSendInput.blur();
      } else if (!typing) {
        closeSplit();
      }
    }
  }
});

// Restore split from URL on load (?arm=name)
const initialArm = new URLSearchParams(window.location.search).get("arm");
if (initialArm && !isMobile()) {
  // Wait a tick for SSR grid to be in the DOM
  requestAnimationFrame(() => openSplit(initialArm));
}
