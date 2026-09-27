"use strict";

/* Perfis locais: as senhas apenas separam usuários neste navegador. Não existe autenticação remota. */
const SPNStorage = (() => {
  const scope = location.pathname.replace(/(?:index\.html)?$/, "");
  const prefix = `supernatural-guia:v1:${scope}:`;
  const rounds = globalThis.crypto?.subtle ? 310000 : 12000;
  const encoder = new TextEncoder();
  const statuses = new Set(["planned", "watched", "skipped"]);
  const first64Primes = [];
  for (let candidate = 2; first64Primes.length < 64; candidate++) {
    if (first64Primes.every((prime) => prime * prime > candidate || candidate % prime !== 0)) first64Primes.push(candidate);
  }
  const fraction32 = (value) => (value - Math.floor(value)) * 0x100000000 >>> 0;
  const initial = first64Primes.slice(0, 8).map((prime) => fraction32(Math.sqrt(prime)));
  const constants = first64Primes.map((prime) => fraction32(Math.cbrt(prime)));
  const rotate = (value, bits) => (value >>> bits) | (value << (32 - bits));

  function sha256(bytes) {
    const size = Math.ceil((bytes.length + 9) / 64) * 64;
    const data = new Uint8Array(size);
    data.set(bytes);
    data[bytes.length] = 0x80;
    const length = bytes.length * 8;
    const view = new DataView(data.buffer);
    view.setUint32(size - 8, Math.floor(length / 0x100000000));
    view.setUint32(size - 4, length >>> 0);
    const h = initial.slice();
    const words = new Uint32Array(64);
    for (let offset = 0; offset < size; offset += 64) {
      for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = words[i - 15], b = words[i - 2];
        words[i] = (words[i - 16] + (rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)) + words[i - 7] + (rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10))) >>> 0;
      }
      let [a, b, c, d, e, f, g, k] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (k + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + constants[i] + words[i]) >>> 0;
        const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        k = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      for (let i = 0; i < 8; i++) h[i] = (h[i] + [a, b, c, d, e, f, g, k][i]) >>> 0;
    }
    const result = new Uint8Array(32);
    const output = new DataView(result.buffer);
    h.forEach((value, index) => output.setUint32(index * 4, value));
    return result;
  }

  const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const unhex = (value) => Uint8Array.from(value.match(/../g) || [], (byte) => parseInt(byte, 16));
  const combine = (a, b) => { const output = new Uint8Array(a.length + b.length); output.set(a); output.set(b, a.length); return output; };
  function hmacKey(password) {
    const key = encoder.encode(password);
    const prepared = key.length > 64 ? sha256(key) : key;
    const inner = new Uint8Array(64).fill(0x36);
    const outer = new Uint8Array(64).fill(0x5c);
    prepared.forEach((byte, index) => { inner[index] ^= byte; outer[index] ^= byte; });
    return {inner, outer};
  }
  function hmac(key, bytes) { return sha256(combine(key.outer, sha256(combine(key.inner, bytes)))); }
  async function derive(password, salt, iterations = rounds) {
    if (!Number.isInteger(iterations) || iterations < 12000 || iterations > 500000) throw new Error("Formato da senha inválido.");
    if (globalThis.crypto?.subtle) {
      const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({name: "PBKDF2", salt: unhex(salt), iterations, hash: "SHA-256"}, key, 256);
      return hex(new Uint8Array(bits));
    }
    const key = hmacKey(password);
    const salted = combine(unhex(salt), new Uint8Array([0, 0, 0, 1]));
    let current = hmac(key, salted);
    const output = current.slice();
    for (let i = 1; i < iterations; i++) {
      current = hmac(key, current);
      for (let j = 0; j < 32; j++) output[j] ^= current[j];
      if (i % 512 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return hex(output);
  }
  const normalize = (username) => username.trim().toLowerCase();
  const profileKey = (username) => prefix + "profile:" + normalize(username);
  const backupKey = (username) => prefix + "automatic:" + normalize(username);
  const activeKey = prefix + "active";
  function getProfile(username) {
    const key = profileKey(username);
    for (const source of [key, backupKey(username)]) {
      const raw = localStorage.getItem(source);
      if (!raw) continue;
      try {
        const profile = JSON.parse(raw);
        if (profile.username && profile.salt && profile.passwordHash && profile.progress && !Array.isArray(profile.progress)) {
          if (source !== key) localStorage.setItem(key, raw);
          return profile;
        }
      } catch (_) { /* Tentar a cópia automática, se houver. */ }
    }
    return null;
  }
  function saveProfile(profile) {
    const content = JSON.stringify(profile);
    localStorage.setItem(profileKey(profile.username), content);
    try { localStorage.setItem(backupKey(profile.username), content); }
    catch (_) { /* A marcação principal permanece gravada se o armazenamento estiver cheio. */ }
  }
  async function register(username, password) {
    if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) throw new Error("Use 3 a 30 letras, números, ponto, hífen ou sublinhado.");
    if (password.length < 10 || password.length > 128) throw new Error("A senha precisa ter de 10 a 128 caracteres.");
    if (getProfile(username)) throw new Error("Esse usuário já existe neste navegador.");
    const random = new Uint8Array(16);
    if (!globalThis.crypto?.getRandomValues) throw new Error("Este navegador não permite criar um identificador seguro.");
    crypto.getRandomValues(random);
    const salt = hex(random);
    const profile = {username, salt, iterations: rounds, passwordHash: await derive(password, salt), progress: {}, updatedAt: new Date().toISOString()};
    saveProfile(profile);
    localStorage.setItem(activeKey, normalize(username));
    return profile;
  }
  async function login(username, password) {
    const profile = getProfile(username);
    if (!profile || normalize(profile.username) !== normalize(username)) throw new Error("Usuário ou senha incorretos neste aparelho.");
    const actual = await derive(password, profile.salt, profile.iterations);
    let difference = 0;
    for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ profile.passwordHash.charCodeAt(i);
    if (difference || actual.length !== profile.passwordHash.length) throw new Error("Usuário ou senha incorretos neste aparelho.");
    localStorage.setItem(activeKey, normalize(profile.username));
    return profile;
  }
  function activeProfile() { const active = localStorage.getItem(activeKey); return active ? getProfile(active) : null; }
  function logout() { localStorage.removeItem(activeKey); }
  function saveProgress(username, key, status, episodeKeys) {
    if (!episodeKeys.has(key) || (status && !statuses.has(status))) throw new Error("Marcação inválida.");
    const profile = getProfile(username);
    if (!profile) throw new Error("Perfil local não encontrado. Entre novamente.");
    const progress = {...profile.progress};
    if (status) progress[key] = status; else delete progress[key];
    const updated = {...profile, progress, updatedAt: new Date().toISOString()};
    saveProfile(updated);
    return updated;
  }
  function makeBackup(profile) {
    return {app: "supernatural-guia-de-episodios", version: 1, username: profile.username, savedAt: new Date().toISOString(), progress: {...profile.progress}};
  }
  function validateBackup(value, episodeKeys) {
    if (!value || value.app !== "supernatural-guia-de-episodios" || value.version !== 1 || typeof value.username !== "string" || !value.progress || typeof value.progress !== "object" || Array.isArray(value.progress)) throw new Error("Este arquivo não é um backup do guia.");
    const progress = Object.create(null);
    for (const [key, status] of Object.entries(value.progress)) {
      if (!episodeKeys.has(key) || !statuses.has(status)) throw new Error("O arquivo contém uma marcação desconhecida.");
      progress[key] = status;
    }
    return {username: value.username, progress};
  }
  function restore(username, progress, episodeKeys) {
    const profile = getProfile(username);
    if (!profile) throw new Error("Perfil local não encontrado.");
    for (const [key, status] of Object.entries(progress)) if (!episodeKeys.has(key) || !statuses.has(status)) throw new Error("Backup inválido.");
    const updated = {...profile, progress: {...progress}, updatedAt: new Date().toISOString()};
    saveProfile(updated);
    return updated;
  }
  return {sha256, derive, normalize, register, login, activeProfile, logout, getProfile, saveProgress, makeBackup, validateBackup, restore};
})();

if (typeof module !== "undefined" && module.exports) module.exports = SPNStorage;
