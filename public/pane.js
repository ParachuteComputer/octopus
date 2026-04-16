// Expanded pane view — live scrollback + send input.

const form = document.getElementById("send-form");
const input = document.getElementById("send-input");
const scrollback = document.getElementById("scrollback");
const name = form?.dataset.name;
if (!name) throw new Error("missing tentacle name");

function atBottom(el) {
  return el.scrollHeight - el.clientHeight - el.scrollTop < 40;
}

let es;
let retry = 0;

function connect() {
  es = new EventSource(`/api/stream/pane/${encodeURIComponent(name)}`);
  es.addEventListener("pane", (ev) => {
    retry = 0;
    try {
      const { output } = JSON.parse(ev.data);
      const stick = atBottom(scrollback);
      scrollback.textContent = output || "(no output)";
      if (stick) scrollback.scrollTop = scrollback.scrollHeight;
    } catch (err) {
      console.error(err);
    }
  });
  es.addEventListener("gone", () => {
    es.close();
    scrollback.textContent += "\n\n— tentacle is gone —";
  });
  es.addEventListener("error", () => {
    es.close();
    retry = Math.min(retry + 1, 5);
    setTimeout(connect, 500 * retry);
  });
}

connect();
scrollback.scrollTop = scrollback.scrollHeight;

async function send(text, enter = true) {
  if (!text) return;
  return await postSend({ text, enter, mode: "text" }, `sent to ${name}`);
}

async function sendKey(key) {
  if (!key) return;
  return await postSend({ text: key, mode: "key" }, `${key} → ${name}`);
}

async function postSend(body, successToast) {
  try {
    const res = await fetch(`/api/panes/${encodeURIComponent(name)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(`send failed: ${data.error ?? res.status}`, true);
      return false;
    }
    toast(successToast);
    return true;
  } catch (err) {
    toast(`send failed: ${err.message}`, true);
    return false;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value;
  input.disabled = true;
  let ok;
  if (!text.trim()) {
    // Empty submit = send bare Enter (approve prompts, confirm dialogs)
    ok = await sendKey("Enter");
  } else {
    ok = await send(text, true);
  }
  input.disabled = false;
  if (ok) input.value = "";
  input.focus();
});

document.querySelectorAll("[data-send]").forEach((btn) => {
  btn.addEventListener("click", () => {
    send(btn.getAttribute("data-send"), true);
  });
});

document.querySelectorAll("[data-send-key]").forEach((btn) => {
  btn.addEventListener("click", () => {
    sendKey(btn.getAttribute("data-send-key"));
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (document.activeElement === input) {
      input.blur();
    } else {
      window.location.href = "/";
    }
  }
});

function toast(msg, isError = false) {
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " toast-error" : "");
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-show"));
  setTimeout(() => {
    el.classList.remove("toast-show");
    setTimeout(() => el.remove(), 220);
  }, 2200);
}
