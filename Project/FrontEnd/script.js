// =============================================
// SAAPADU CLOUD KITCHEN — SCRIPT
// =============================================

// ---------- Menu data ----------
const DISHES = [
  // South Indian
  { id: "s1", cat: "south", name: "Masala Dosa",    price: 120, tag: "Bestseller", desc: "Crisp rice crepe filled with spiced potato, served with chutneys and sambar." },
  { id: "s2", cat: "south", name: "Idli Sambar",    price: 80,  tag: "Tiffin",     desc: "Three soft steamed idlis with hot sambar and coconut chutney." },
  { id: "s3", cat: "south", name: "Ghee Pongal",    price: 110, tag: "Breakfast",  desc: "Rice and moong dal cooked soft with pepper, cumin and a spoon of ghee." },
  { id: "s4", cat: "south", name: "Medu Vada",      price: 70,  tag: "Tiffin",     desc: "Two crisp-outside, fluffy-inside urad dal vadas with sambar." },
  { id: "s5", cat: "south", name: "Mysore Masala Dosa", price: 140, tag: "Spicy",  desc: "Dosa brushed with red chutney, filled with potato masala." },
  { id: "s6", cat: "south", name: "Rava Upma",      price: 85,  tag: "Breakfast",  desc: "Roasted semolina with mustard, curry leaves, onion and cashews." },
  { id: "s7", cat: "south", name: "Curd Rice",      price: 90,  tag: "Comfort",    desc: "Cool curd rice tempered with mustard, ginger and pomegranate." },
  { id: "s8", cat: "south", name: "Filter Kaapi",   price: 50,  tag: "Drink",      desc: "Strong decoction brewed in the filter, mixed with hot milk." },

  // North Indian
  { id: "n1", cat: "north", name: "Butter Paneer Masala", price: 220, tag: "Bestseller", desc: "Paneer cubes in a creamy tomato gravy, with butter naan on the side." },
  { id: "n2", cat: "north", name: "Dal Makhani",    price: 190, tag: "Slow-cooked", desc: "Black lentils simmered for hours with butter and cream." },
  { id: "n3", cat: "north", name: "Chole Bhature",  price: 150, tag: "Hearty",     desc: "Spiced chickpeas with two puffed, golden bhature." },
  { id: "n4", cat: "north", name: "Aloo Paratha",   price: 110, tag: "Breakfast",  desc: "Whole wheat paratha stuffed with spiced potato, served with curd." },
  { id: "n5", cat: "north", name: "Paneer Tikka Roll", price: 140, tag: "Snack",   desc: "Grilled paneer, onion and mint chutney rolled in a soft roomali." },
  { id: "n6", cat: "north", name: "Veg Biryani",    price: 180, tag: "Rice",       desc: "Basmati layered with vegetables and whole spices, with raita." }
];

// ---------- State ----------
let activeCat = "south";
let cart = loadCart();

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const rupee = (n) => "₹" + n;

function loadCart() {
  try {
    const raw = localStorage.getItem("saapadu_cart");
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function saveCart() {
  try { localStorage.setItem("saapadu_cart", JSON.stringify(cart)); } catch (e) {}
}

let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- Menu rendering ----------
function renderMenu() {
  const grid = $("dishGrid");
  const list = DISHES.filter((d) => d.cat === activeCat);

  grid.innerHTML = list.map((d, i) => `
    <article class="dish" style="--n:${i}">
      <div class="dish-top">
        <span class="veg" title="Vegetarian"></span>
        <span class="dish-tag">${d.tag}</span>
      </div>
      <h3>${d.name}</h3>
      <p>${d.desc}</p>
      <div class="dish-price">${rupee(d.price)}</div>
      <div class="dish-actions">
        <button class="btn-add" data-add="${d.id}">Add to cart</button>
        <button class="btn-buy" data-buy="${d.id}">Buy now</button>
      </div>
    </article>
  `).join("");
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    activeCat = tab.dataset.cat;
    renderMenu();
  });
});

// Buttons inside the dish grid (event delegation)
$("dishGrid").addEventListener("click", (e) => {
  const addBtn = e.target.closest("[data-add]");
  const buyBtn = e.target.closest("[data-buy]");
  if (addBtn) {
    addToCart(addBtn.dataset.add);
    const dish = DISHES.find((d) => d.id === addBtn.dataset.add);
    toast(dish.name + " added to cart");
  }
  if (buyBtn) {
    addToCart(buyBtn.dataset.buy);
    openCart();
  }
});

// ---------- Cart ----------
function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  renderCart(true);
}

function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  saveCart();
  renderCart(false);
}

function renderCart(bump) {
  const ids = Object.keys(cart);
  const count = ids.reduce((sum, id) => sum + cart[id], 0);
  const total = ids.reduce((sum, id) => {
    const d = DISHES.find((x) => x.id === id);
    return sum + (d ? d.price * cart[id] : 0);
  }, 0);

  const countEl = $("cartCount");
  countEl.textContent = count;
  if (bump) {
    countEl.classList.remove("bump");
    void countEl.offsetWidth;          // restart the animation
    countEl.classList.add("bump");
  }

  $("cartTotal").textContent = rupee(total);

  $("cartItems").innerHTML = ids.length
    ? ids.map((id) => {
        const d = DISHES.find((x) => x.id === id);
        if (!d) return "";
        return `
          <div class="cart-row">
            <b>${d.name}</b>
            <span class="price">${rupee(d.price * cart[id])}</span>
            <div class="qty">
              <button data-minus="${id}" aria-label="Remove one ${d.name}">&minus;</button>
              <span>${cart[id]}</span>
              <button data-plus="${id}" aria-label="Add one ${d.name}">+</button>
            </div>
          </div>`;
      }).join("")
    : `<p class="cart-empty">Your cart is empty. Add a dosa or two.</p>`;
}

$("cartItems").addEventListener("click", (e) => {
  const plus = e.target.closest("[data-plus]");
  const minus = e.target.closest("[data-minus]");
  if (plus) changeQty(plus.dataset.plus, 1);
  if (minus) changeQty(minus.dataset.minus, -1);
});

// Drawer open / close
function openCart() {
  $("drawer").classList.add("open");
  $("overlay").classList.add("open");
}
function closeCart() {
  $("drawer").classList.remove("open");
  $("overlay").classList.remove("open");
}
$("cartOpen").addEventListener("click", openCart);
$("cartClose").addEventListener("click", closeCart);
$("overlay").addEventListener("click", closeCart);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });

// Checkout (front-end demo)
$("checkoutBtn").addEventListener("click", () => {
  if (!Object.keys(cart).length) {
    toast("Add something to your cart first");
    return;
  }
  cart = {};
  saveCart();
  renderCart(false);
  closeCart();
  toast("Order placed. Your food is on its way!");
});

// ---------- Mobile nav ----------
const navToggle = $("navToggle");
const siteNav = $("siteNav");
navToggle.addEventListener("click", () => {
  const open = siteNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", open ? "true" : "false");
});
siteNav.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    siteNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  })
);

// ---------- Scroll reveal ----------
const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("in"));
}

// ---------- Init ----------
renderMenu();
renderCart(false);
