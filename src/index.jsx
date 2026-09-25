// CRA resolves its entry point from `src/index` — the filename is fixed.
// (`main.jsx` is a Vite convention and would not be found; see
// node_modules/react-scripts/config/paths.js.)

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Installable app (PWA): register the service worker in production builds
// only, so development never serves a cached bundle. See public/sw.js.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/sw.js`).catch(() => {
      // Not fatal: the app works the same without it, it just can't be
      // installed or opened offline.
    });
  });
}
