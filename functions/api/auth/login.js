// =====================================================================
// functions/api/auth/login.js
// Endpoint untuk pelanggan login pakai akun yang sudah didaftarkan.
// POST /api/auth/login
// Body: { email, password }
// =====================================================================

import { json, corsPreflight, verifyPassword, generateToken } from "../_utils.js";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { email, password } = body;

    if (!email || !password) {
      return json(
        { message: "Email dan password wajib diisi." },
        400
      );
    }

    const user = await context.env.DB.prepare(
      "SELECT * FROM users WHERE email = ?"
    )
      .bind(email)
      .first();

    if (!user) {
      return json({ message: "Email atau password salah." }, 401);
    }

    const passwordCocok = await verifyPassword(password, user.password_hash);
    if (!passwordCocok) {
      return json({ message: "Email atau password salah." }, 401);
    }

    const token = generateToken();
    await context.env.DB.prepare(
      "INSERT INTO sessions (token, user_id) VALUES (?, ?)"
    )
      .bind(token, user.id)
      .run();

    return json({
      message: "Login berhasil",
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
    });
  } catch (err) {
    return json(
      { message: "Gagal login: " + err.message },
      500
    );
  }
}

export async function onRequestOptions() {
  return corsPreflight();
}
