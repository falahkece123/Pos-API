// =====================================================================
// JAWAIN — script.js
// Semua logika frontend: ambil menu dari backend, kelola keranjang,
// dan kirim pesanan ke backend.
// =====================================================================

// Keranjang disimpan di localStorage juga, supaya isinya tidak hilang
// kalau pelanggan pindah ke halaman login/daftar lalu kembali lagi.
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem("jawain_cart") || "[]");
} catch {
  cart = [];
}
let allMenuItems = [];

function saveCart() {
  localStorage.setItem("jawain_cart", JSON.stringify(cart));
}

// ---------------------------------------------------------------------
// STATE AKUN / LOGIN
// Token & data user disimpan di localStorage supaya pelanggan tidak
// perlu login ulang setiap kali membuka halaman (beda dengan keranjang
// yang sengaja tidak dipersist).
// ---------------------------------------------------------------------
let authToken = localStorage.getItem("jawain_token") || null;
let currentUser = null;
try {
  currentUser = JSON.parse(localStorage.getItem("jawain_user") || "null");
} catch {
  currentUser = null;
}

function saveSession(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem("jawain_token", token);
  localStorage.setItem("jawain_user", JSON.stringify(user));
  updateAccountUI();
}

function clearSession() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem("jawain_token");
  localStorage.removeItem("jawain_user");
  updateAccountUI();
}

function updateAccountUI() {
  const label = document.getElementById("accountLabel");
  const cartInfo = document.getElementById("cartAccountInfo");
  const guestFields = document.getElementById("guestFields");
  if (currentUser) {
    label.textContent = `Halo, ${currentUser.name.split(" ")[0]} (Keluar)`;
    if (cartInfo) {
      cartInfo.textContent = `Dipesan atas nama ${currentUser.name} — ${currentUser.phone || "-"}`;
    }
    // Sudah login: nama & telepon otomatis dari akun, jadi field tamu disembunyikan.
    if (guestFields) guestFields.hidden = true;
  } else {
    label.textContent = "Masuk / Daftar";
    if (cartInfo) cartInfo.textContent = "";
    // Belum login: tetap bisa pesan sebagai tamu, tampilkan field nama & WhatsApp.
    if (guestFields) guestFields.hidden = false;
  }
}

const rupiah = (angka) =>
  "Rp " + angka.toLocaleString("id-ID");

// ---------------------------------------------------------------------
// 1. AMBIL DATA MENU DARI BACKEND (Cloudflare Pages Function)
// ---------------------------------------------------------------------
async function loadMenu() {
  const grid = document.getElementById("menuGrid");
  try {
    const res = await fetch("/api/menu");
    if (!res.ok) throw new Error("Gagal mengambil menu");
    const data = await res.json();
    allMenuItems = data.items || [];
    renderMenu(allMenuItems);
  } catch (err) {
    grid.innerHTML = `<p class="menu__error">Gagal memuat menu. Pastikan backend (/api/menu) berjalan. (${err.message})</p>`;
  }
}

function renderMenu(items) {
  const grid = document.getElementById("menuGrid");
  if (!items.length) {
    grid.innerHTML = `<p class="menu__loading">Belum ada menu di kategori ini.</p>`;
    return;
  }
  grid.innerHTML = items
    .map(
      (item) => `
      <div class="menu__card" data-category="${item.category}">
        <div class="menu__card__icon">${item.icon || "☕"}</div>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        <div class="menu__card__foot">
          <span class="menu__card__price">${rupiah(item.price)}</span>
          <button class="menu__add" data-id="${item.id}">+ Tambah</button>
        </div>
      </div>`
    )
    .join("");

  grid.querySelectorAll(".menu__add").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(btn.dataset.id));
  });
}

// ---------------------------------------------------------------------
// 2. FILTER KATEGORI MENU
// ---------------------------------------------------------------------
document.getElementById("menuFilter").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  document
    .querySelectorAll(".chip")
    .forEach((c) => c.classList.remove("is-active"));
  btn.classList.add("is-active");

  const filter = btn.dataset.filter;
  const filtered =
    filter === "all"
      ? allMenuItems
      : allMenuItems.filter((i) => i.category === filter);
  renderMenu(filtered);
});

// ---------------------------------------------------------------------
// 3. LOGIKA KERANJANG
// ---------------------------------------------------------------------
function addToCart(id) {
  const item = allMenuItems.find((i) => String(i.id) === String(id));
  if (!item) return;

  const existing = cart.find((c) => String(c.id) === String(item.id));
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  renderCart();
  openCart();
}

function changeQty(id, delta) {
  // Pakai String() di kedua sisi, supaya id angka (dari database D1)
  // maupun id teks tetap bisa cocok saat dibandingkan.
  const line = cart.find((c) => String(c.id) === String(id));
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) {
    cart = cart.filter((c) => String(c.id) !== String(id));
  }
  renderCart();
}

function renderCart() {
  saveCart();
  const itemsEl = document.getElementById("cartItems");
  const countEl = document.getElementById("cartCount");
  const totalEl = document.getElementById("cartTotal");

  countEl.textContent = cart.reduce((sum, c) => sum + c.qty, 0);

  if (!cart.length) {
    itemsEl.innerHTML = `<p class="cart__empty">Keranjang masih kosong. Yuk pilih menu dulu ☕</p>`;
    totalEl.textContent = rupiah(0);
    return;
  }

  itemsEl.innerHTML = cart
    .map(
      (c) => `
      <div class="cart__item">
        <div>
          <div class="cart__item__name">${c.name}</div>
          <div class="cart__item__meta">${rupiah(c.price)} x ${c.qty}</div>
        </div>
        <div class="cart__item__actions">
          <button class="qty__btn" data-id="${c.id}" data-delta="-1">−</button>
          <span>${c.qty}</span>
          <button class="qty__btn" data-id="${c.id}" data-delta="1">+</button>
        </div>
      </div>`
    )
    .join("");

  itemsEl.querySelectorAll(".qty__btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      changeQty(btn.dataset.id, Number(btn.dataset.delta))
    );
  });

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  totalEl.textContent = rupiah(total);
}

// ---------------------------------------------------------------------
// 4. BUKA / TUTUP LACI KERANJANG
// ---------------------------------------------------------------------
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");

function openCart() {
  cartDrawer.classList.add("is-open");
  overlay.classList.add("is-open");
}
function closeCart() {
  cartDrawer.classList.remove("is-open");
  overlay.classList.remove("is-open");
}

document.getElementById("cartBtn").addEventListener("click", openCart);
document.getElementById("cartClose").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);

// ---------------------------------------------------------------------
// 4b. TOMBOL AKUN -> arahkan ke halaman login.html (bukan modal lagi),
// kecuali kalau sedang login maka tombol ini berfungsi sebagai logout.
// ---------------------------------------------------------------------
const accountBtn = document.getElementById("accountBtn");

accountBtn.addEventListener("click", async () => {
  if (currentUser) {
    try {
      await fetch("/api/auth/me", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch {
      // Meski request gagal (misal offline), tetap hapus sesi di sisi frontend
    }
    clearSession();
    return;
  }
  window.location.href = "login.html?next=" + encodeURIComponent(window.location.href);
});

// ---------------------------------------------------------------------
// 5. KIRIM PESANAN KE BACKEND
// ---------------------------------------------------------------------
document.getElementById("orderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("orderStatus");
  const submitBtn = document.getElementById("submitOrderBtn");

  if (!cart.length) {
    statusEl.textContent = "Keranjang masih kosong, pilih menu dulu ya.";
    statusEl.className = "cart__status is-error";
    return;
  }

  // Pesanan sekarang BISA tanpa login (checkout sebagai tamu).
  // Kalau sudah login, nama & WhatsApp otomatis dari akun.
  // Kalau belum login, ambil dari field nama/WhatsApp tamu di keranjang.
  const catatan = document.getElementById("catatanPemesan").value;
  let guestName = "";
  let guestPhone = "";

  if (!currentUser) {
    guestName = document.getElementById("guestName").value.trim();
    guestPhone = document.getElementById("guestPhone").value.trim();

    if (!guestName) {
      statusEl.textContent = "Nama pemesan wajib diisi.";
      statusEl.className = "cart__status is-error";
      document.getElementById("guestName").focus();
      return;
    }
    if (!guestPhone) {
      statusEl.textContent = "Nomor WhatsApp wajib diisi.";
      statusEl.className = "cart__status is-error";
      document.getElementById("guestPhone").focus();
      return;
    }
  }

  const payload = {
    items: cart.map((c) => ({ id: c.id, name: c.name, qty: c.qty, price: c.price })),
    total: cart.reduce((sum, c) => sum + c.price * c.qty, 0),
    catatan,
    // guestName/guestPhone diabaikan backend kalau request sudah login
    guestName,
    guestPhone,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Mengirim pesanan...";
  statusEl.textContent = "";

  try {
    const headers = { "Content-Type": "application/json" };
    // Kirim header Authorization hanya kalau memang sedang login.
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch("/api/order", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.status === 401) {
      // Sesi kadaluarsa/tidak valid -> minta login ulang
      clearSession();
      throw new Error("Sesi login berakhir, silakan masuk lagi atau lanjutkan sebagai tamu.");
    }
    if (!res.ok) throw new Error(data.message || "Gagal mengirim pesanan");

    statusEl.textContent = `Pesanan diterima! Kode pesanan: ${data.orderId}`;
    statusEl.className = "cart__status is-success";

    // Tampilkan struk yang bisa didownload
    const namaStruk = currentUser ? currentUser.name : guestName;
    const teleponStruk = currentUser ? currentUser.phone : guestPhone;
    showReceiptModal({
      orderId: data.orderId,
      customer: { nama: namaStruk, telepon: teleponStruk, catatan },
      items: payload.items,
      total: payload.total,
    });

    cart = [];
    renderCart();
    e.target.reset();
  } catch (err) {
    statusEl.textContent = `Gagal: ${err.message}`;
    statusEl.className = "cart__status is-error";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Pesan Sekarang";
  }
});

// ---------------------------------------------------------------------
// 6. NAVBAR MOBILE (burger sederhana -> scroll ke menu)
// ---------------------------------------------------------------------
document.getElementById("burgerBtn").addEventListener("click", () => {
  document.getElementById("navLinks").classList.toggle("is-open");
});
document.querySelectorAll(".nav__links a").forEach((link) => {
  link.addEventListener("click", () => {
    document.getElementById("navLinks").classList.remove("is-open");
  });
});

// =====================================================================
// 7. STRUK PESANAN (bisa didownload sebagai gambar)
// =====================================================================
function drawDashedLine(ctx, x1, y, x2, y2) {
  ctx.save();
  ctx.strokeStyle = "#C8A27D";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function calculateReceiptHeight(order) {
  // Simulasi persis kenaikan posisi Y yang dipakai saat menggambar,
  // supaya tinggi kanvas selalu pas (tidak kepotong / tidak kepanjangan).
  let y = 120;
  y += 20; // No. Pesanan
  y += 20; // Tanggal
  y += 20; // Nama
  y += 20; // WhatsApp
  if (order.customer.catatan) y += 20; // Catatan (opsional)
  y += 6;  // jarak sebelum garis putus-putus
  y += 26; // jarak setelah garis putus-putus, sebelum daftar item

  order.items.forEach(() => {
    y += 18; // baris nama item
    y += 22; // baris qty x harga
  });

  y += 4;  // jarak sebelum garis putus-putus
  y += 30; // jarak setelah garis, sampai baris TOTAL
  y += 38; // jarak dari TOTAL ke baris ucapan pertama
  y += 18; // baris ucapan kedua
  y += 26; // padding bawah, biar tidak mepet

  return y;
}

function generateReceiptCanvas(order) {
  const width = 380;
  const padding = 24;
  const lineHeight = 22;
  const height = calculateReceiptHeight(order);

  const canvas = document.createElement("canvas");
  // Scale 2x supaya hasil download tetap tajam (retina-friendly)
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#FFF8F0";
  ctx.fillRect(0, 0, width, height);

  // Header toko
  ctx.fillStyle = "#3C2A21";
  ctx.textAlign = "center";
  ctx.font = "bold 24px Georgia, serif";
  ctx.fillText("☕ JAWAIN", width / 2, 42);
  ctx.font = "12px Arial";
  ctx.fillStyle = "#6b5644";
  ctx.fillText("Jl. Kenanga No. 12, Jakarta", width / 2, 62);
  ctx.fillText("+62 812-0000-0000", width / 2, 78);

  drawDashedLine(ctx, padding, 96, width - padding, 96);

  // Detail pesanan
  ctx.textAlign = "left";
  ctx.fillStyle = "#2B1B12";
  ctx.font = "13px 'Courier New', monospace";
  let y = 120;

  const tanggal = new Date().toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  ctx.fillText(`No. Pesanan : ${order.orderId}`, padding, y); y += 20;
  ctx.fillText(`Tanggal     : ${tanggal}`, padding, y); y += 20;
  ctx.fillText(`Nama        : ${order.customer.nama}`, padding, y); y += 20;
  ctx.fillText(`WhatsApp    : ${order.customer.telepon}`, padding, y); y += 20;
  if (order.customer.catatan) {
    ctx.fillText(`Catatan     : ${order.customer.catatan}`, padding, y);
    y += 20;
  }

  y += 6;
  drawDashedLine(ctx, padding, y, width - padding, y);
  y += 26;

  // Daftar item
  order.items.forEach((item) => {
    ctx.font = "bold 13px Arial";
    ctx.fillText(item.name, padding, y);
    y += 18;

    ctx.font = "13px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${item.qty} x Rp ${item.price.toLocaleString("id-ID")}`, padding, y);

    ctx.textAlign = "right";
    ctx.fillText(
      `Rp ${(item.qty * item.price).toLocaleString("id-ID")}`,
      width - padding,
      y
    );
    ctx.textAlign = "left";
    y += lineHeight;
  });

  y += 4;
  drawDashedLine(ctx, padding, y, width - padding, y);
  y += 30;

  // Total
  ctx.font = "bold 16px Arial";
  ctx.fillStyle = "#3C2A21";
  ctx.fillText("TOTAL", padding, y);
  ctx.textAlign = "right";
  ctx.fillText(`Rp ${order.total.toLocaleString("id-ID")}`, width - padding, y);

  // Footer
  y += 38;
  ctx.textAlign = "center";
  ctx.font = "italic 12px Georgia, serif";
  ctx.fillStyle = "#6b5644";
  ctx.fillText("Terima kasih sudah memesan di JAWAIN!", width / 2, y);
  y += 18;
  ctx.fillText("Selamat menikmati ☕", width / 2, y);

  return canvas;
}

function showReceiptModal(order) {
  const canvas = generateReceiptCanvas(order);

  const modal = document.createElement("div");
  modal.className = "receipt-modal";
  modal.innerHTML = `
    <div class="receipt-modal__backdrop"></div>
    <div class="receipt-modal__box">
      <button class="receipt-modal__close" aria-label="Tutup struk">✕</button>
      <div class="receipt-modal__canvas-wrap"></div>
      <div class="receipt-modal__actions">
        <button class="btn btn--primary btn--block" id="downloadReceiptBtn">⬇️ Download Struk</button>
      </div>
    </div>
  `;
  modal.querySelector(".receipt-modal__canvas-wrap").appendChild(canvas);
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector(".receipt-modal__close").addEventListener("click", close);
  modal.querySelector(".receipt-modal__backdrop").addEventListener("click", close);

  modal.querySelector("#downloadReceiptBtn").addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = `struk-${order.orderId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
}

// ---------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------
loadMenu();
renderCart(); // tampilkan isi keranjang yang tersimpan dari kunjungan sebelumnya
updateAccountUI(); // tampilkan status login yang tersimpan dari kunjungan sebelumnya
