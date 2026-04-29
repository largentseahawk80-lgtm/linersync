import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { clearKeysOnResetQuery } from "./lib/storage";

try {
  clearKeysOnResetQuery();
} catch (error) {
  console.error("Reset cleanup failed", error);
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML = "<div style='padding:16px;color:#fff;background:#111'>LinerSync mount failure: missing #root</div>";
} else {
  try { createRoot(rootEl).render(<App />); }
  catch (e) { document.body.innerHTML = `<div style='padding:16px;color:#fff;background:#111'>React boot failure: ${String(e.message || e)}</div>`; }
}
