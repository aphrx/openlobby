"use client";
import * as Ably from "ably";

type Realtime = Ably.Realtime;

declare global {
  // eslint-disable-next-line no-var
  var __ablyRealtime: Realtime | undefined;
}

export function getRealtime() {
  if (globalThis.__ablyRealtime) return globalThis.__ablyRealtime;
  const realtime = new Ably.Realtime({
    authUrl: "/api/ably-token",
  });
  globalThis.__ablyRealtime = realtime;
  return realtime;
}
