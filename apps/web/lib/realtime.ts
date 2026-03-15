export type SocketLike = {
  on: <T = unknown>(event: string, cb: (payload: T) => void) => void;
  off: <T = unknown>(event: string, cb?: (payload: T) => void) => void;
  emit: <T = unknown>(event: string, payload?: T) => void;
  disconnect: () => void;
};

type WindowWithSocket = Window & {
  io?: (url?: string, options?: Record<string, unknown>) => SocketLike;
};

let scriptPromise: Promise<void> | null = null;

function ensureSocketScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as WindowWithSocket).io) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/socket.io/socket.io.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load socket.io client script"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function connectRealtime(query?: Record<string, string>) {
  if (typeof window === "undefined") return null;
  await ensureSocketScript();
  const io = (window as WindowWithSocket).io;
  if (!io) return null;

  return io(undefined, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    query,
  });
}
