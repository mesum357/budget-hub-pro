type DebugLevel = "log" | "warn" | "error" | "info";

export type DebugEntry = {
  id: string;
  ts: number;
  level: DebugLevel;
  message: string;
};

const STORE_KEY = "__budget_debug_console_store__";
const INIT_KEY = "__budget_debug_console_inited__";
const MAX_ENTRIES = 400;

type DebugStore = {
  entries: DebugEntry[];
  listeners: Set<() => void>;
  add: (entry: DebugEntry) => void;
  clear: () => void;
  subscribe: (fn: () => void) => () => void;
};

function stringifyArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ""}`.trim();
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function getStore(): DebugStore {
  const w = window as Window & { [STORE_KEY]?: DebugStore };
  if (w[STORE_KEY]) return w[STORE_KEY]!;
  const store: DebugStore = {
    entries: [],
    listeners: new Set(),
    add(entry) {
      store.entries = [...store.entries.slice(-(MAX_ENTRIES - 1)), entry];
      store.listeners.forEach((fn) => fn());
    },
    clear() {
      store.entries = [];
      store.listeners.forEach((fn) => fn());
    },
    subscribe(fn) {
      store.listeners.add(fn);
      return () => {
        store.listeners.delete(fn);
      };
    },
  };
  w[STORE_KEY] = store;
  return store;
}

function push(level: DebugLevel, parts: unknown[]) {
  const msg = parts.map(stringifyArg).join(" ");
  getStore().add({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    level,
    message: msg || "(empty)",
  });
}

export function initDebugConsoleCapture() {
  const w = window as Window & { [INIT_KEY]?: boolean };
  if (w[INIT_KEY]) return;
  w[INIT_KEY] = true;

  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
  };

  console.log = (...args: unknown[]) => {
    push("log", args);
    original.log(...args);
  };
  console.warn = (...args: unknown[]) => {
    push("warn", args);
    original.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    push("error", args);
    original.error(...args);
  };
  console.info = (...args: unknown[]) => {
    push("info", args);
    original.info(...args);
  };

  window.addEventListener("error", (event) => {
    const err = event.error instanceof Error ? `${event.error.message}\n${event.error.stack || ""}` : String(event.message);
    push("error", [`[window.error] ${err}`]);
  });

  window.addEventListener("unhandledrejection", (event) => {
    push("error", ["[unhandledrejection]", event.reason]);
  });
}

export function getDebugEntries() {
  return getStore().entries;
}

export function subscribeDebugEntries(fn: () => void) {
  return getStore().subscribe(fn);
}

export function clearDebugEntries() {
  getStore().clear();
}

