// =====================================================================
// functions/api/_utils.js
// File bantuan kecil, dipakai bersama oleh menu.js dan menu/[id].js
// supaya tidak menulis ulang kode yang sama.
// File yang namanya diawali garis bawah "_" TIDAK menjadi endpoint API,
// jadi aman dipakai sebagai file bantuan saja.
// =====================================================================

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// =====================================================================
// BAGIAN AUTH (login pelanggan)
// Cloudflare Workers/Pages sudah punya Web Crypto API bawaan (crypto.subtle),
// jadi tidak perlu install library tambahan untuk hash password.
// =====================================================================

// Ubah ArrayBuffer hasil hash menjadi teks heksadesimal, biar gampang disimpan di kolom TEXT.
function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Hash password pakai PBKDF2 + salt acak.
// Hasilnya disimpan dengan format "saltHex:hashHex" di kolom password_hash.
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bufferToHex(salt);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );

  return `${saltHex}:${bufferToHex(derivedBits)}`;
}

// Cocokkan password yang diinput user saat login dengan hash yang tersimpan di database.
export async function verifyPassword(password, storedHash) {
  const [saltHex, hashHex] = storedHash.split(":");
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );

  return bufferToHex(derivedBits) === hashHex;
}

// Buat token sesi acak untuk dipakai setelah login/register berhasil.
export function generateToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

// Ambil data user yang sedang login berdasarkan header "Authorization: Bearer <token>".
// Mengembalikan null kalau token tidak ada / tidak valid, supaya endpoint yang butuh
// login tinggal cek: if (!user) return json({ message: "Belum login" }, 401);
export async function getUserFromRequest(context) {
  const authHeader = context.request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const session = await context.env.DB.prepare(
    `SELECT users.id, users.name, users.email, users.phone
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = ?`
  )
    .bind(token)
    .first();

  return session || null;
}
