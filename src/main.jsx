import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// ブラウザ標準の自動スクロール復元は、アプリ側でのスクロール位置の復元（sessionStorage経由）と
// タイミングが競合してズレることがあるため、標準機能は無効にしてアプリ側だけで制御する。
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: ホーム画面追加・オフライン起動のためのservice worker登録
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
