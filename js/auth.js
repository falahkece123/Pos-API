// =====================================================================
// JAWAIN — auth.js
// Logika untuk halaman login.html (dulu berupa modal/layer di atas
// halaman pemesanan, sekarang jadi halaman tersendiri).
//
// Setelah berhasil masuk/daftar, token & data user disimpan ke
// localStorage dengan key yang SAMA seperti di js/script.js
// ("jawain_token" / "jawain_user"), supaya begitu pelanggan kembali ke
// index.html, sesi login-nya sudah terpakai otomatis.
// =====================================================================

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
}

function clearSession() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem("jawain_token");
  localStorage.removeItem("jawain_user");

  // Kosongkan juga keranjang tersimpan, supaya akun berikutnya yang login
  // di perangkat/browser yang sama tidak mewarisi pesanan akun sebelumnya.
  localStorage.removeItem("jawain_cart");
}

// Kalau ada "?next=..." di URL, dipakai sebagai tujuan redirect setelah
// berhasil login/daftar. Kalau tidak ada, kembali ke halaman menu pemesanan.
function getNextUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || "index.html#menu";
}

// ---------------------------------------------------------------------
// Kalau pelanggan sudah login duluan, tampilkan info itu (bukan langsung
// redirect paksa, supaya pelanggan tetap bisa lihat/ganti akun kalau mau).
// ---------------------------------------------------------------------
function renderAlreadyLoggedIn() {
  const alreadyBox = document.getElementById("alreadyLoggedIn");
  const formsWrap = document.getElementById("authFormsWrap");
  const text = document.getElementById("alreadyLoggedInText");

  if (currentUser) {
    alreadyBox.hidden = false;
    formsWrap.hidden = true;
    text.textContent = `Kamu masuk sebagai ${currentUser.name} (${currentUser.phone || "-"}).`;
  } else {
    alreadyBox.hidden = true;
    formsWrap.hidden = false;
  }
}
renderAlreadyLoggedIn();

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await fetch("/api/auth/me", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    // Meski request gagal (misal offline), tetap hapus sesi di sisi frontend
  }
  clearSession();
  renderAlreadyLoggedIn();
});

// ---------------------------------------------------------------------
// Tab switch Login <-> Daftar
// ---------------------------------------------------------------------
document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");

    const isLogin = tab.dataset.tab === "login";
    document.getElementById("loginForm").hidden = !isLogin;
    document.getElementById("registerForm").hidden = isLogin;
  });
});

// ---------------------------------------------------------------------
// Submit form Login
// ---------------------------------------------------------------------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("loginStatus");
  statusEl.textContent = "Sedang masuk...";
  statusEl.className = "auth-form__status";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("loginEmail").value,
        password: document.getElementById("loginPassword").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Gagal masuk");

    saveSession(data.token, data.user);
    statusEl.textContent = "Berhasil masuk! Mengarahkan...";
    statusEl.className = "auth-form__status is-success";
    setTimeout(() => {
      window.location.href = getNextUrl();
    }, 600);
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = "auth-form__status is-error";
  }
});

// ---------------------------------------------------------------------
// Submit form Daftar
// ---------------------------------------------------------------------
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("registerStatus");
  statusEl.textContent = "Sedang mendaftar...";
  statusEl.className = "auth-form__status";

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.getElementById("registerName").value,
        email: document.getElementById("registerEmail").value,
        phone: document.getElementById("registerPhone").value,
        password: document.getElementById("registerPassword").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Gagal mendaftar");

    saveSession(data.token, data.user);
    statusEl.textContent = "Akun berhasil dibuat! Mengarahkan...";
    statusEl.className = "auth-form__status is-success";
    setTimeout(() => {
      window.location.href = getNextUrl();
    }, 600);
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = "auth-form__status is-error";
  }
});
