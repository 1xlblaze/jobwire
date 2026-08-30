(() => {
  const APPLY_HINT = /apply|application|jobs?|careers?|greenhouse|lever|ashby|workable|smartrecruiters/i;
  const QUESTION_HINT =
    /experience|years|ctc|salary|notice|why |describe|authorized|sponsor|relocat|github|linkedin|education|degree|availability|start date|remote|hybrid|phone|email/i;

  if (!APPLY_HINT.test(`${location.href} ${document.title}`)) {
    return;
  }

  const processed = new WeakSet();

  function labelFor(field) {
    if (field.id) {
      const byFor = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
      if (byFor) return byFor.innerText.trim();
    }
    const wrapping = field.closest("label");
    if (wrapping) return wrapping.innerText.trim();
    const labelled = field.getAttribute("aria-label") || "";
    const placeholder = field.getAttribute("placeholder") || "";
    const nearby = field.previousElementSibling?.innerText || "";
    return `${labelled} ${placeholder} ${nearby}`.trim();
  }

  function looksLikeQuestion(field) {
    const text = [
      labelFor(field),
      field.name || "",
      field.id || "",
      field.getAttribute("aria-label") || "",
    ].join(" ");
    return QUESTION_HINT.test(text);
  }

  function insertValue(field, value) {
    field.focus();
    if (field.isContentEditable) {
      field.innerText = value;
    } else {
      const proto = field.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(field, value);
      else field.value = value;
    }
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function apiBase() {
    const stored = await chrome.storage.sync.get({ apiBase: "http://127.0.0.1:43141" });
    return String(stored.apiBase).replace(/\/$/, "");
  }

  async function suggest(question) {
    const base = await apiBase();
    const res = await fetch(`${base}/api/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        job_title: document.title,
        job_description: document.body?.innerText?.slice(0, 3000) || "",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Jobwire request failed");
    return data.answer;
  }

  function decorate(field) {
    if (processed.has(field) || !looksLikeQuestion(field)) return;
    processed.add(field);
    const wrap = document.createElement("div");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "jobwire-btn";
    btn.textContent = "Suggest answer";
    const preview = document.createElement("div");
    preview.className = "jobwire-preview";
    preview.hidden = true;
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      btn.textContent = "Drafting…";
      try {
        const answer = await suggest(labelFor(field) || field.placeholder || "Please answer this screening question.");
        preview.hidden = false;
        preview.textContent = answer;
        const insert = document.createElement("button");
        insert.type = "button";
        insert.className = "jobwire-btn";
        insert.textContent = "Insert (does not submit)";
        insert.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          insertValue(field, answer);
        });
        if (!preview.nextElementSibling || preview.nextElementSibling.textContent !== "Insert (does not submit)") {
          preview.after(insert);
        }
        btn.textContent = "Suggest again";
      } catch (err) {
        preview.hidden = false;
        preview.textContent = `Jobwire unreachable. Start the local server. (${err.message})`;
        btn.textContent = "Suggest answer";
      }
    });
    wrap.append(btn, preview);
    field.insertAdjacentElement("afterend", wrap);
  }

  function scan() {
    document.querySelectorAll("textarea, input[type='text'], input:not([type])").forEach((node) => decorate(node));
  }

  scan();
  const observer = new MutationObserver(() => scan());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
