const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MAP = new Uint8Array(128);
for (let i = 0; i < A.length; i++) MAP[A.charCodeAt(i)] = i;

export function b64ToBytes(s) {
  s = s.replace(/[^A-Za-z0-9+/]/g, '');
  const n = Math.floor(s.length * 3 / 4);
  const out = new Uint8Array(n);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const a = MAP[s.charCodeAt(i)], b = MAP[s.charCodeAt(i + 1)];
    const c = i + 2 < s.length ? MAP[s.charCodeAt(i + 2)] : 0;
    const d = i + 3 < s.length ? MAP[s.charCodeAt(i + 3)] : 0;
    const v = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < n) out[o++] = (v >> 16) & 255;
    if (o < n) out[o++] = (v >> 8) & 255;
    if (o < n) out[o++] = v & 255;
  }
  return out;
}

export function bytesToB64(b) {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const v = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
    s += A[(v >> 18) & 63] + A[(v >> 12) & 63]
      + (i + 1 < b.length ? A[(v >> 6) & 63] : '=')
      + (i + 2 < b.length ? A[v & 63] : '=');
  }
  return s;
}
