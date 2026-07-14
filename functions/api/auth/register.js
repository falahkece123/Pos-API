// =====================================================================
// functions/api/auth/register.js
// Endpoint untuk pelanggan membuat akun baru.
// POST /api/auth/register
// Body: { name, email, password, phone }
//
// Setelah berhasil daftar, pelanggan langsung dianggap login
// (dikirimkan token sesi), supaya tidak perlu login manual lagi.
// =====================================================================

import { json, corsPreflight, hashPassword, generateToken } from "../_utils.js";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { name, email, password, phone } = body;

    if (!name || !email || !password) {
      return json(
        { message: "Nama, email, dan password wajib diisi." },
        400
      );
    }
    if (password.length < 6) {
      return json(
        { message: "Password minimal 6 karakter." },
        400
      );
    }

    // Cek apakah email sudah terdaftar
    const existing = await context.env.DB.prepare(
      "SELECT id FROM users WHERE email = ?"
    )
      .bind(email)
      .first();

    if (existing) {
      return json(
        { message: "Email sudah terdaftar. Silakan login." },
        409
      );
    }

    const passwordHash = await hashPassword(password);

    const result = await context.env.DB.prepare(
      `INSERT INTO users (name, email, phone, password_hash)
       VALUES (?, ?, ?, ?)`
    )
      .bind(name, email, phone || "", passwordHash)
      .run();

    const userId = result.meta.last_row_id;

    // Langsung buatkan sesi login supaya pelanggan tidak perlu login ulang
    const token = generateToken();
    await context.env.DB.prepare(
      "INSERT INTO sessions (token, user_id) VALUES (?, ?)"
    )
      .bind(token, userId)
      .run();

    return json(
      {
        message: "Pendaftaran berhasil",
        token,
        user: { id: userId, name, email, phone: phone || "" },
      },
      201
    );
  } catch (err) {
    return json(
      { message: "Gagal mendaftar: " + err.message },
      500
    );
  }
}

export async function onRequestOptions() {
  return corsPreflight();
}
