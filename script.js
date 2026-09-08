// ---------------------------------------------------------------
// LUME — catálogo, busca, filtro, carrossel, favoritos e checkout
// ---------------------------------------------------------------

let cart = [];
let favoriteIds = [];
let activeCategory = "todas";
let searchTerm = "";
const carouselIndex = {};
let valorFrete = 0;

const formatBRL = (value) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------- Filtragem ----------
function getFilteredProducts() {
  return PRODUCTS.filter((p) => {
    const matchesCategory = activeCategory === "todas" || p.category === activeCategory;
    const matchesSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm) ||
      p.desc.toLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });
}

// ---------- Abas de categoria ----------
function renderCategoryTabs() {
  const el = document.getElementById("categoryTabs");
  if (!el) return;
  el.innerHTML = Object.entries(CATEGORY_LABELS)
    .map(
      ([key, label]) =>
        `<button class="tab ${key === activeCategory ? "active" : ""}" data-category="${key}">${label}</button>`
    )
    .join("");

  el.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;
      renderCategoryTabs();
      renderProducts();
    });
  });
}

// ---------- Carrossel de imagens ----------
function slideMarkup(product, index) {
  const imageUrl = product.images && product.images[index] ? product.images[index] : "";
  return `
    <div class="carousel-slide" style="min-width:100%;height:100%;">
      <img src="${imageUrl}" alt="${product.name}" loading="lazy" style="width:100%;height:180px;object-fit:cover;">
    </div>`;
}

function renderCarousel(product) {
  const imageList = product.images || [];
  const current = carouselIndex[product.id] || 0;

  let slides = "";
  if (imageList.length > 0) {
    slides = imageList.map((_, i) => slideMarkup(product, i)).join("");
  } else {
    const iconSvg = (typeof ICONS !== "undefined" && ICONS[product.icon]) || "";
    slides = `<div class="carousel-slide" style="min-width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${iconSvg}</div>`;
  }

  const showControls = imageList.length > 1;
  const dots = showControls
    ? imageList.map((_, i) => `<span class="dot ${i === current ? "active" : ""}" data-dot="${i}" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i === current ? 'var(--gold)' : '#ccc'};cursor:pointer;margin:0 3px;"></span>`).join("")
    : "";

  return `
    <div class="product-carousel" data-product="${product.id}" style="position:relative;overflow:hidden;height:180px;background:#faf8f5;">
      <div class="carousel-track" style="display:flex;transition:transform 0.3s ease;transform:translateX(-${current * 100}%);height:100%;">
        ${slides}
      </div>
      ${showControls ? `<button class="carousel-arrow prev" data-dir="-1" style="position:absolute;top:50%;left:5px;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;z-index:2;font-size:18px;line-height:1;">‹</button>` : ""}
      ${showControls ? `<button class="carousel-arrow next" data-dir="1" style="position:absolute;top:50%;right:5px;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;z-index:2;font-size:18px;line-height:1;">›</button>` : ""}
      ${showControls ? `<div class="carousel-dots" style="position:absolute;bottom:5px;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:2;">${dots}</div>` : ""}
    </div>`;
}

function moveCarousel(productId, dir) {
  const product = PRODUCTS.find((p) => p.id === productId);
  const total = product && product.images ? product.images.length : 1;
  const current = carouselIndex[productId] || 0;
  const next = (current + dir + total) % total;
  carouselIndex[productId] = next;
  updateCarouselDOM(productId);
}

function setCarousel(productId, index) {
  carouselIndex[productId] = index;
  updateCarouselDOM(productId);
}

function updateCarouselDOM(productId) {
  const wrapper = document.querySelector(`.product-carousel[data-product="${productId}"]`);
  if (!wrapper) return;
  const index = carouselIndex[productId] || 0;
  const track = wrapper.querySelector(".carousel-track");
  if (track) track.style.transform = `translateX(-${index * 100}%)`;
  wrapper.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("active", i === index));
}

// ---------- Renderização do catálogo ----------
function renderProducts() {
  const grid = document.getElementById("productGrid");
  const noResults = document.getElementById("noResults");
  if (!grid) return;

  const list = getFilteredProducts();

  if (noResults) noResults.hidden = list.length > 0;

  grid.innerHTML = list
    .map((p) => {
      const isFav = favoriteIds.includes(p.id);
      return `
      <article class="product-card" style="border:1px solid #eee;border-radius:8px;overflow:hidden;background:white;">
        ${renderCarousel(p)}
        <div class="product-info" style="padding:15px;">
          <div class="product-title-row" style="display:flex;justify-content:space-between;align-items:center;">
            <h3 class="product-name" style="margin:0;font-family:var(--font-serif);font-size:16px;">${p.name}</h3>
            <button class="fav-btn ${isFav ? "active" : ""}" data-id="${p.id}" aria-label="Favoritar" style="background:none;border:none;font-size:20px;cursor:pointer;color:${isFav ? 'var(--wine)' : '#ccc'};transition:color 0.3s;">♥</button>
          </div>
          <p class="product-desc" style="margin:5px 0;font-size:13px;color:#888;">${p.desc}</p>
          <p class="product-price" style="font-weight:600;color:var(--wine);font-size:18px;">${formatBRL(p.price)}</p>
          <button class="add-to-cart" data-id="${p.id}" style="width:100%;padding:10px;background:var(--gold);color:white;border:none;border-radius:4px;cursor:pointer;font-family:var(--font-sans);font-weight:500;transition:background 0.3s;">Adicionar à sacola</button>
        </div>
      </article>`;
    })
    .join("");

  grid.querySelectorAll(".add-to-cart").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(btn.dataset.id));
  });

  grid.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", () => toggleFavorite(btn.dataset.id));
  });

  grid.querySelectorAll(".carousel-arrow").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const productId = btn.closest(".product-carousel").dataset.product;
      moveCarousel(productId, Number(btn.dataset.dir));
    });
  });

  grid.querySelectorAll(".dot").forEach((dot) => {
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      const productId = dot.closest(".product-carousel").dataset.product;
      setCarousel(productId, Number(dot.dataset.dot));
    });
  });
}

// ============================================================
// FAVORITOS
// ============================================================

async function loadFavorites() {
  try {
    const res = await fetch("/api/favoritos");
    if (res.status === 401) {
      favoriteIds = [];
      return;
    }
    const data = await res.json();
    favoriteIds = data.favoritos || [];
  } catch (err) {
    console.error("Erro ao carregar favoritos:", err);
    favoriteIds = [];
  }
}

async function toggleFavorite(productId) {
  try {
    const res = await fetch(`/api/favoritos/${productId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (res.status === 401) {
      if (confirm("Você precisa estar logado para favoritar. Ir para o login?")) {
        window.location.href = "login.html";
      }
      return;
    }

    const data = await res.json();
    
    if (data.favorited) {
      if (!favoriteIds.includes(productId)) {
        favoriteIds.push(productId);
      }
    } else {
      favoriteIds = favoriteIds.filter((id) => id !== productId);
    }
    
    renderProducts();
  } catch (err) {
    console.error("Erro ao favoritar:", err);
    alert("Erro ao favoritar. Tente novamente.");
  }
}

// ============================================================
// CARRINHO
// ============================================================

function addToCart(id) {
  const existing = cart.find((item) => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    const product = PRODUCTS.find((p) => p.id === id);
    if (product) cart.push({ ...product, qty: 1 });
  }
  renderCart();
  openCart();
}

function changeQty(id, delta) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter((i) => i.id !== id);
    if (cart.length === 0) {
      valorFrete = 0;
      const resultadoDiv = document.getElementById("freteResultado");
      if (resultadoDiv) resultadoDiv.innerHTML = '';
    }
  }
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter((i) => i.id !== id);
  if (cart.length === 0) {
    valorFrete = 0;
    const resultadoDiv = document.getElementById("freteResultado");
    if (resultadoDiv) resultadoDiv.innerHTML = '';
  }
  renderCart();
}

function cartSubtotal() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  return subtotal + valorFrete;
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const countEl = document.getElementById("cartCount");
  const subtotalEl = document.getElementById("cartSubtotal");
  const checkoutBtn = document.getElementById("checkoutBtn");

  if (!container) return;

  const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);
  if (countEl) countEl.textContent = totalItems;

  if (cart.length === 0) {
    container.innerHTML = `<p class="cart-empty">Sua sacola está vazia.</p>`;
    if (checkoutBtn) checkoutBtn.disabled = true;
    valorFrete = 0;
    const resultadoDiv = document.getElementById("freteResultado");
    if (resultadoDiv) resultadoDiv.innerHTML = '';
  } else {
    container.innerHTML = cart
      .map(
        (item) => `
        <div class="cart-item" style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eee;">
          <div class="cart-item-icon" style="width:60px;height:60px;flex-shrink:0;">
            ${item.images && item.images[0] ? `<img src="${item.images[0]}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">` : (ICONS[item.icon] || '')}
          </div>
          <div class="cart-item-info" style="flex:1;">
            <p class="cart-item-name" style="margin:0;font-weight:500;">${item.name}</p>
            <p class="cart-item-price" style="margin:5px 0;color:var(--wine);font-weight:600;">${formatBRL(item.price)}</p>
            <div class="qty-controls" style="display:flex;align-items:center;gap:8px;">
              <button data-action="dec" data-id="${item.id}" style="width:25px;height:25px;border:1px solid #ddd;border-radius:4px;background:white;cursor:pointer;">−</button>
              <span style="min-width:20px;text-align:center;">${item.qty}</span>
              <button data-action="inc" data-id="${item.id}" style="width:25px;height:25px;border:1px solid #ddd;border-radius:4px;background:white;cursor:pointer;">+</button>
              <button class="remove-item" data-action="remove" data-id="${item.id}" style="margin-left:10px;background:none;border:none;color:#e74c3c;cursor:pointer;font-size:12px;">remover</button>
            </div>
          </div>
        </div>`
      )
      .join("");
    if (checkoutBtn) checkoutBtn.disabled = false;
  }

  // ATUALIZA O SUBTOTAL COM FRETE
  if (subtotalEl) {
    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    
    if (valorFrete > 0 && cart.length > 0) {
      subtotalEl.innerHTML = `
        <div style="width:100%;">
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#666;">
            <span>Subtotal:</span>
            <span>${formatBRL(subtotal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#666;">
            <span>Frete:</span>
            <span>${formatBRL(valorFrete)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;color:var(--wine);border-top:2px solid var(--gold);padding-top:5px;margin-top:5px;">
            <span>Total:</span>
            <span>${formatBRL(subtotal + valorFrete)}</span>
          </div>
        </div>
      `;
    } else {
      subtotalEl.textContent = formatBRL(subtotal);
    }
  }

  container.querySelectorAll("[data-action]").forEach((btn) => {
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    btn.addEventListener("click", () => {
      if (action === "inc") changeQty(id, 1);
      if (action === "dec") changeQty(id, -1);
      if (action === "remove") removeFromCart(id);
    });
  });
}

// ---------- Abrir/fechar carrinho ----------
function openCart() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  if (drawer) drawer.classList.add("active");
  if (overlay) overlay.classList.add("active");
}
function closeCart() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  if (drawer) drawer.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
}

// ============================================================
// FUNÇÃO DE FRETE
// ============================================================

async function calcularFrete() {
  console.log("🔍 Função calcularFrete chamada!");
  
  const cepInput = document.getElementById("cepInput");
  const resultadoDiv = document.getElementById("freteResultado");
  
  if (!cepInput) {
    console.log("❌ Campo CEP não encontrado!");
    return;
  }
  
  if (!resultadoDiv) {
    console.log("❌ Div de resultado não encontrado!");
    return;
  }

  const cep = cepInput.value.trim().replace(/\D/g, '');
  console.log("📦 CEP digitado:", cep);
  
  if (cep.length !== 8) {
    resultadoDiv.innerHTML = '⚠️ Digite um CEP válido com 8 dígitos.';
    resultadoDiv.style.color = '#e74c3c';
    valorFrete = 0;
    renderCart();
    return;
  }

  if (cart.length === 0) {
    resultadoDiv.innerHTML = '⚠️ Adicione itens ao carrinho primeiro.';
    resultadoDiv.style.color = '#e74c3c';
    valorFrete = 0;
    renderCart();
    return;
  }

  resultadoDiv.innerHTML = '⏳ Calculando frete...';
  resultadoDiv.style.color = '#888';

  try {
    const response = await fetch("/api/calcular-frete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cep: cep,
        items: cart.map(item => ({ id: item.id, qty: item.qty }))
      }),
    });

    const data = await response.json();
    console.log("📦 Resposta do servidor:", data);

    if (!response.ok) {
      resultadoDiv.innerHTML = `⚠️ ${data.error || 'Erro ao calcular frete'}`;
      resultadoDiv.style.color = '#e74c3c';
      valorFrete = 0;
      renderCart();
      return;
    }

    if (data.success) {
      const frete = data.frete;
      valorFrete = frete.valor;
      
      resultadoDiv.innerHTML = `
        <div style="background: #f0f8f0; padding: 10px; border-radius: 4px; border-left: 4px solid #4CAF50;">
          <p style="margin: 0; font-weight: 500;">
            📦 ${frete.servico || 'PAC'}
          </p>
          <p style="margin: 5px 0 0 0;">
            Prazo: <strong>${frete.prazo} dias úteis</strong>
          </p>
          <p style="margin: 0;">
            Valor: <strong>${formatBRL(frete.valor)}</strong>
          </p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #888;">
            CEP: ${frete.cep}
          </p>
        </div>
      `;
      resultadoDiv.style.color = '#333';
      
      renderCart();
    }
  } catch (error) {
    console.error("❌ Erro ao calcular frete:", error);
    resultadoDiv.innerHTML = '⚠️ Erro ao calcular frete. Tente novamente.';
    resultadoDiv.style.color = '#e74c3c';
    valorFrete = 0;
    renderCart();
  }
}

function limparFrete() {
  valorFrete = 0;
  const resultadoDiv = document.getElementById("freteResultado");
  if (resultadoDiv) {
    resultadoDiv.innerHTML = '';
  }
  renderCart();
}

// ============================================================
// CHECKOUT
// ============================================================

async function handleCheckout() {
  const note = document.getElementById("checkoutNote");
  const checkoutBtn = document.getElementById("checkoutBtn");
  
  if (checkoutBtn) checkoutBtn.disabled = true;
  if (note) note.textContent = "Verificando autenticação...";

  try {
    const meRes = await fetch("/api/me");
    const meData = await meRes.json();

    if (!meData.user) {
      if (note) note.textContent = "Entre na sua conta para finalizar a compra.";
      setTimeout(() => {
        if (confirm("Você precisa estar logado para finalizar a compra. Ir para o login?")) {
          window.location.href = "login.html";
        }
      }, 1000);
      if (checkoutBtn) checkoutBtn.disabled = false;
      return;
    }

    if (note) note.textContent = "Finalizando pedido...";

    const itemsParaEnviar = cart.map((i) => ({ 
      id: i.id, 
      name: i.name, 
      price: i.price, 
      qty: i.qty 
    }));
    
    if (valorFrete > 0) {
      itemsParaEnviar.push({
        id: "frete",
        name: "📦 Frete",
        price: valorFrete,
        qty: 1
      });
    }

    const response = await fetch("/api/criar-pedido", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: itemsParaEnviar,
        totalComFrete: cartSubtotal(),
        frete: valorFrete
      }),
    });

    if (response.status === 401) {
      if (note) note.textContent = "Sessão expirada. Faça login novamente.";
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
      if (checkoutBtn) checkoutBtn.disabled = false;
      return;
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Falha ao criar pedido");
    }

    const data = await response.json();
    
    if (data.success) {
      cart = [];
      valorFrete = 0;
      renderCart();
      alert("✅ Pedido realizado com sucesso! Obrigado por comprar na Lume.");
      closeCart();
      window.location.href = "sucesso.html";
    } else {
      throw new Error(data.message || "Erro ao finalizar pedido");
    }
    
    if (checkoutBtn) checkoutBtn.disabled = false;
  } catch (err) {
    console.error("Erro ao finalizar compra:", err);
    if (note) note.textContent = "Erro ao finalizar compra: " + err.message;
    if (checkoutBtn) checkoutBtn.disabled = false;
  }
}

// ============================================================
// EXPOR FUNÇÕES GLOBALMENTE
// ============================================================

window.calcularFrete = calcularFrete;
window.limparFrete = limparFrete;
window.addToCart = addToCart;
window.toggleFavorite = toggleFavorite;
window.loadFavorites = loadFavorites;

// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Inicializando Lume...");
  
  renderCategoryTabs();
  await loadFavorites();
  renderProducts();
  renderCart();

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderProducts();
    });
  }

  const cartToggle = document.getElementById("cartToggle");
  if (cartToggle) cartToggle.addEventListener("click", openCart);

  const cartClose = document.getElementById("cartClose");
  if (cartClose) cartClose.addEventListener("click", closeCart);

  const cartOverlay = document.getElementById("cartOverlay");
  if (cartOverlay) cartOverlay.addEventListener("click", closeCart);

  const checkoutBtn = document.getElementById("checkoutBtn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", handleCheckout);

  // Eventos do frete
  const cepInput = document.getElementById("cepInput");
  const calcularBtn = document.getElementById("calcularFreteBtn");
  
  if (calcularBtn) {
    calcularBtn.addEventListener("click", function(e) {
      e.preventDefault();
      calcularFrete();
    });
  }
  
  if (cepInput) {
    cepInput.addEventListener("input", function(e) {
      let value = this.value.replace(/\D/g, '');
      if (value.length > 5) {
        value = value.substring(0, 5) + '-' + value.substring(5, 8);
      }
      this.value = value;
      
      if (value.length < 8) {
        limparFrete();
      }
    });
    
    cepInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        calcularFrete();
      }
    });
  }
  
  console.log("✅ Inicialização concluída!");
});