// =====================================================================
// functions/api/auth/me.js
// Endpoint untuk mengecek apakah pelanggan sedang login, berdasarkan
// token yang dikirim lewat header: Authorization: Bearer <token>
// GET    /api/auth/me      -> data pelanggan yang login
// DELETE /api/auth/me      -> logout (hapus sesi)
// =====================================================================

import { json, corsPreflight, getUserFromRequest } from "../_utils.js";

export async function onRequestGet(context) {
  const user = await getUserFromRequest(context);
  if (!user) return json({ message: "Belum login" }, 401);
  return json({ user });
}

export async function onRequestDelete(context) {
  const authHeader = context.request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (token) {
    await context.env.DB.prepare("DELETE FROM sessions WHERE token = ?")
      .bind(token)
      .run();
  }

  return json({ message: "Logout berhasil" });
}

export async function onRequestOptions() {
  return corsPreflight();
}
