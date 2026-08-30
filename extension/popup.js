const input = document.getElementById("api");
const status = document.getElementById("status");

chrome.storage.sync.get({ apiBase: "http://127.0.0.1:43141" }, (stored) => {
  input.value = stored.apiBase;
});

document.getElementById("save").addEventListener("click", async () => {
  const apiBase = input.value.replace(/\/$/, "");
  await chrome.storage.sync.set({ apiBase });
  status.textContent = "Checking…";
  try {
    const res = await fetch(`${apiBase}/api/health`);
    const data = await res.json();
    status.textContent = data.ok ? "Jobwire is reachable." : "Unexpected response.";
  } catch (err) {
    status.textContent = "Cannot reach Jobwire. Start: python -m src serve";
  }
});
