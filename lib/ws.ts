export function makeWS() {
  const envUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname;
    const port = process.env.NEXT_PUBLIC_WS_PORT ?? "8080";
    const autoUrl = `${protocol}://${host}:${port}`;
    const url = !envUrl || envUrl === "auto" ? autoUrl : envUrl;
    return new WebSocket(url);
  }
  const url = envUrl ?? "ws://localhost:8080";
  return new WebSocket(url);
}
