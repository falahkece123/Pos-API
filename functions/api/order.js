// =====================================================================
// functions/api/order.js
// Endpoint ini menerima pesanan dari frontend.
// POST /api/order
// GET  /api/order   -> riwayat pesanan milik pelanggan yang login
//
// CATATAN: login SEKARANG OPSIONAL.
// - Kalau ada header "Authorization: Bearer <token>" yang valid, pesanan
//   otomatis dikaitkan ke akun (user_id) tsb dan pakai nama/telepon akun.
// - Kalau tidak ada / token tidak valid, pesanan tetap diterima sebagai
//   pesanan TAMU (guest). Nama & nomor WhatsApp untuk pesanan tamu wajib
//   dikirim dari frontend lewat field "guestName" dan "guestPhone".
//
// Pesanan disimpan ke tabel "orders" di Cloudflare D1. Kolom user_id akan
// NULL untuk pesanan tamu, dan nama/telepon tamu disimpan di kolom
// guest_name / guest_phone.
//
// PENTING: kalau tabel "orders" di D1 belum punya kolom guest_name dan
// guest_phone (atau kolom user_id masih NOT NULL), jalankan dulu migrasi
// SQL berikut di database D1 kamu:
//
//   ALTER TABLE orders ADD COLUMN guest_name TEXT;
//   ALTER TABLE orders ADD COLUMN guest_phone TEXT;
//
// Dan pastikan kolom user_id di tabel orders BOLEH NULL (kalau awalnya
// dibuat dengan NOT NULL, kamu perlu buat ulang tabelnya karena SQLite/D1
// tidak bisa ALTER COLUMN langsung untuk menghapus NOT NULL).
// =====================================================================

import { json, corsPreflight, getUserFromRequest } from "./_utils.js";

export async function onRequestPost(context) {
  try {
    // Login sekarang opsional: kalau token ada & valid, dapat data user.
    // Kalau tidak, user akan null dan pesanan diproses sebagai tamu.
    const user = await getUserFromRequest(context);

    const body = await context.request.json();
    const { items, total, catatan, guestName, guestPhone } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return json({ message: "Keranjang tidak boleh kosong." }, 400);
    }
    if (!total || total <= 0) {
      return json({ message: "Total pesanan tidak valid." }, 400);
    }

    // Kalau tidak login, nama & nomor WhatsApp wajib diisi manual
    // supaya pesanan tetap bisa dihubungi/diambil.
    let customerName = user?.name;
    let customerPhone = user?.phone;

    if (!user) {
      if (!guestName || !guestName.trim()) {
        return json(
          { message: "Nama pemesan wajib diisi." },
          400
        );
      }
      if (!guestPhone || !guestPhone.trim()) {
        return json(
          { message: "Nomor WhatsApp pemesan wajib diisi." },
          400
        );
      }
      customerName = guestName.trim();
      customerPhone = guestPhone.trim();
    }

    // Buat kode pesanan unik sederhana, misal: JWN-7K2P9X
    const orderCode = "JWN-" + crypto.randomUUID().slice(0, 6).toUpperCase();

    await context.env.DB.prepare(
      `INSERT INTO orders (order_code, user_id, guest_name, guest_phone, items_json, total, catatan, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'diterima')`
    )
      .bind(
        orderCode,
        user ? user.id : null,
        user ? null : customerName,
        user ? null : customerPhone,
        JSON.stringify(items),
        total,
        catatan || ""
      )
      .run();

    return json(
      {
        message: "Pesanan berhasil diterima dan tersimpan",
        orderId: orderCode,
        order: {
          orderId: orderCode,
          customer: { nama: customerName, telepon: customerPhone },
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
