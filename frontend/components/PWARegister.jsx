"use client";
import { useEffect } from "react";

// Service Worker を登録して PWA（インストール・オフライン）を有効化
export function PWARegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const swUrl = `${base}/sw.js`;
    navigator.serviceWorker.register(swUrl, { scope: `${base}/` }).catch(() => {});
  }, []);
  return null;
}
