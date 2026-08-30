// ==UserScript==
// @name         Jobwire Suggest
// @namespace    local.jobwire
// @version      1.0.0
// @description  Suggest screening answers from a local Jobwire server. Never submits forms.
// @match        https://*/*
// @grant        none
// ==/UserScript==

(() => {
  const API = "http://127.0.0.1:43141";
  const APPLY_HINT = /apply|application|jobs?|careers?|greenhouse|lever|ashby|workable/i;
  const QUESTION_HINT =
    /experience|years|ctc|salary|notice|why |describe|authorized|sponsor|relocat|github|linkedin|education|degree|availability|start date|remote|hybrid|phone|email/i;
  if (!APPLY_HINT.test(`${location.href} ${document.title}`)) return;

  const processed = new WeakSet();

  function labelFor(field) {
    if (field.id) {
      const byFor = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
      if (byFor) return byFor.innerText.trim();
    }
    return (
      field.closest("label")?.innerText ||
      field.getAttribute("aria-label") ||
      field.getAttribute("placeholder") ||
      ""
    ).trim();
  }

  function decorate(field) {
    const text = `${labelFor(field)} ${field.name || ""} ${field.id || ""}`;
    if (processed.has(field) || !QUESTION_HINT.test(text)) return;
    processed.add(field);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Suggest answer";
    btn.style.cssText =
      "font:11px monospace;margin:4px 0;padding:4px 8px;border:1px solid #1b1712;background:#f3ead8;cursor:pointer";
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      btn.textContent = "Drafting…";
      try {
        const res = await fetch(`${API}/api/suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: labelFor(field) || "Please answer this screening question.",
            job_title: document.title,
          }),
        });
        const data = await res.json();
        field.value = data.answer;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        btn.textContent = "Suggest answer";
      } catch (err) {
        btn.textContent = "Jobwire offline";
      }
    });
    field.insertAdjacentElement("afterend", btn);
  }

  const scan = () =>
    document.querySelectorAll("textarea, input[type='text']").forEach((node) => decorate(node));
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
