"use client";
import { useRouter } from "next/navigation";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() {
  let result = "";
  for (let i = 0; i < 4; i += 1) {
    result += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return result;
}

export default function HostNew() {
  const r = useRouter();

  const code = makeCode();
  r.replace(`/host/${code}`);

  return <main style={{ padding: 24 }}>Creating room…</main>;
}
