// =====================================================================
// functions/api/order.js
// Endpoint ini menerima pesanan dari frontend.
// POST /api/order
// GET  /api/order   -> riwayat pesanan milik pelanggan yang login
//
// CATATAN: endpoint ini WAJIB LOGIN. Token dikirim frontend lewat
// header "Authorization: Bearer <token>" yang didapat saat
// register/login (lihat functions/api/auth/ dan login.html).
//
// Sejalan dengan alur di frontend: index.html sekarang punya gerbang
// login (kalau belum ada sesi tersimpan, pengunjung diarahkan ke
// login.html dulu), jadi endpoint ini tetap menolak request tanpa
// token yang valid sebagai lapisan keamanan tambahan di sisi server
// (frontend bisa saja dilewati, tapi API tidak boleh).
//
// Pesanan disimpan ke tabel "orders" di Cloudflare D1, terhubung ke
// akun pelanggan (user_id) yang mengirim pesanan.
// =====================================================================

import { json, corsPreflight, getUserFromRequest } from "./_utils.js";

export async function onRequestPost(context) {
  try {
    const user = await getUserFromRequest(context);
    if (!user) {
      return json(
        { message: "Kamu harus login dulu sebelum memesan." },
        401
      );
    }

    const body = await context.request.json();
    const { items, total, catatan } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return json({ message: "Keranjang tidak boleh kosong." }, 400);
    }
    if (!total || total <= 0) {
      return json({ message: "Total pesanan tidak valid." }, 400);
    }

    // Buat kode pesanan unik sederhana, misal: JWN-7K2P9X
    const orderCode = "JWN-" + crypto.randomUUID().slice(0, 6).toUpperCase();

    await context.env.DB.prepare(
      `INSERT INTO orders (order_code, user_id, items_json, total, catatan, status)
       VALUES (?, ?, ?, ?, ?, 'diterima')`
    )
      .bind(orderCode, user.id, JSON.stringify(items), total, catatan || "")
      .run();

    return json(
      {
        message: "Pesanan berhasil diterima dan tersimpan",
        orderId: orderCode,
        order: {
          orderId: orderCode,
          customer: { nama: user.name, telepon: user.phone },
          items,
          total,
          status: "diterima",
        },
      },
      201
    );
  } catch (err) {
    return json(
      { message: "Format data tidak valid: " + err.message },
      400
    );
  }
}

// Riwayat pesanan pelanggan yang sedang login
export async function onRequestGet(context) {
  const user = await getUserFromRequest(context);
  if (!user) {
    return json({ message: "Kamu harus login dulu." }, 401);
  }

  const { results } = await context.env.DB.prepare(
    `SELECT id, order_code, items_json, total, catatan, status, created_at
     FROM orders WHERE user_id = ? ORDER BY created_at DESC`
  )
    .bind(user.id)
    .all();

  const orders = results.map((o) => ({
    ...o,
    items: JSON.parse(o.items_json),
  }));

  return json({ orders });
}

export async function onRequestOptions() {
  return corsPreflight();
}
