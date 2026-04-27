import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getAuthToken } from "@/lib/authToken";
import { getApiBase } from "@/lib/apiBase";

const nativeFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const base = getApiBase();
  const token = getAuthToken();
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const isApiCall = url.startsWith("/api/") || (base && url.startsWith(`${base}/api/`));

  if (!isApiCall || !token) return nativeFetch(input, init);

  const headers = new Headers(init?.headers || {});
  if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return nativeFetch(input, { ...init, headers });
}) as typeof window.fetch;

createRoot(document.getElementById("root")!).render(<App />);
