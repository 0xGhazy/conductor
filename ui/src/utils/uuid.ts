export function createUuid() {
  const c = globalThis?.crypto;
  if (c?.randomUUID) return c.randomUUID();

  // RFC4122-ish v4 fallback using secure random bytes
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant

    const hex = [...bytes]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // last resort random ID (non-crypto)
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
