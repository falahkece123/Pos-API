// Ganti dengan URL Cloudflare Worker Anda setelah di-deploy
const API_URL = "http://localhost:8787/api/products"; 

let cart = [];

// 1. FETCH DATA DARI BACKEND
async function fetchProducts() {
    try {
        const response = await fetch(API_URL);
        const products = await response.json();
        renderMenu(products);
    } catch (error) {
        console.error("Gagal mengambil data menu:", error);
    }
}

// 2. RENDER MENU KE HTML
function renderMenu(products) {
    const menuGrid = document.getElementById("menu-grid");
    menuGrid.innerHTML = "";

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
            <h3>${product.name}</h3>
            <p>Rp ${product.price.toLocaleString('id-ID')}</p>
            <button class="btn-add" onclick="addToCart('${product.name}', ${product.price})">Tambah</button>
        `;
        menuGrid.appendChild(card);
    });
}

// 3. LOGIKA KERANJANG (POS)
function addToCart(name, price) {
    const existingItem = cart.find(item => item.name === name);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        cart.push({ name, price, qty: 1 });
    }
    updateCartUI();
}

function updateCartUI() {
    const cartContainer = document.getElementById("cart-items");
    const totalContainer = document.getElementById("cart-total");
    cartContainer.innerHTML = "";
    
    let total = 0;

    cart.forEach(item => {
        total += item.price * item.qty;
        const div = document.createElement("div");
        div.className = "cart-item";
        div.innerHTML = `
            <span>${item.name} (x${item.qty})</span>
            <span>Rp ${(item.price * item.qty).toLocaleString('id-ID')}</span>
        `;
        cartContainer.appendChild(div);
    });

    totalContainer.innerText = `Rp ${total.toLocaleString('id-ID')}`;
}

// Jalankan fungsi saat halaman dimuat
window.onload = fetchProducts;
