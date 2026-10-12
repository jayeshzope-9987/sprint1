const money = n => "₹" + n.toLocaleString("en-IN");
const $ = id => document.getElementById(id);

let menu = [];
let cart = {};            // dish id -> quantity (the shared cart)
let direct = null;        // "Buy now" order: one dish, kept apart from the cart
let filter = "All";
let timer = null;
let toastTimer = null;

const active = () => direct || cart;

function toast(msg) {
  $("toast").textContent = msg;
  $("toast").classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("on"), 1800);
}

// ---------- menu ----------

async function loadMenu() {
  menu = await (await fetch("/api/menu")).json();
  renderTabs();
  renderGrid();
  renderCart();
  const saved = localStorage.getItem("hearth-order");
  if (saved) track(saved);
}

function renderTabs() {
  const cats = ["All", ...new Set(menu.map(d => d.category))];
  $("tabs").innerHTML = cats.map(c =>
    `<button class="tab" role="tab" aria-selected="${c === filter}" data-cat="${c}">${c}</button>`).join("");
}

function addControl(d) {
  const q = cart[d.id] || 0;
  return q
    ? `<div class="stepper"><button data-dec="${d.id}" aria-label="Remove one ${d.name}">−</button><span>${q}</span><button data-add="${d.id}" aria-label="Add one ${d.name}">+</button></div>`
    : `<button class="btn outline" data-add="${d.id}">Add to cart</button>`;
}

function dishCard(d) {
  return `
    <article class="dish">
      <div class="meta"><span class="dot ${d.veg ? "" : "nv"}" title="${d.veg ? "Vegetarian" : "Non-vegetarian"}"></span>${d.veg ? "Vegetarian" : "Contains meat"} · ${d.mins} min to cook</div>
      <h3>${d.name}</h3>
      <p>${d.desc}</p>
      <div class="row"><span class="price">${money(d.price)}</span></div>
      <div class="actions">${addControl(d)}<button class="btn buy" data-buy="${d.id}">Buy now</button></div>
    </article>`;
}

function renderGrid() {
  const cats = filter === "All" ? [...new Set(menu.map(d => d.category))] : [filter];
  $("grid").innerHTML = cats.map(c => `
    <h2 class="cat-title">${c}</h2>
    ${menu.filter(d => d.category === c).map(dishCard).join("")}`).join("");
}

// ---------- cart ----------

function renderCart() {
  const items = active();
  const lines = Object.entries(items).map(([id, qty]) => ({ d: menu.find(m => m.id === id), qty }));
  const total = lines.reduce((s, l) => s + l.d.price * l.qty, 0);
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  $("count").textContent = cartCount;
  $("checkout").hidden = lines.length === 0;
  $("buyNote").hidden = !direct;
  if (!$("trackView").hidden) {} else $("drawerTitle").textContent = direct ? "Buy now" : "Your cart";
  $("cartBody").innerHTML = lines.length === 0
    ? `<p class="empty">Your cart is empty. Add a dish from the menu to get started.</p>`
    : lines.map(l => `
        <div class="line">
          <div><strong>${l.d.name}</strong><small>${money(l.d.price)} each</small></div>
          <div class="stepper"><button data-ld="${l.d.id}" aria-label="Remove one ${l.d.name}">−</button><span>${l.qty}</span><button data-la="${l.d.id}" aria-label="Add one ${l.d.name}">+</button></div>
        </div>`).join("") + `<div class="total"><span>Total</span><span>${money(total)}</span></div>`;
}

function bump(map, id, delta) {
  map[id] = (map[id] || 0) + delta;
  if (map[id] <= 0) delete map[id];
}

document.addEventListener("click", e => {
  const t = e.target.closest("button");
  if (!t) return;
  const dish = id => menu.find(m => m.id === id);

  if (t.dataset.cat) { filter = t.dataset.cat; renderTabs(); renderGrid(); }

  if (t.dataset.add) {                       // menu card: add to the cart
    bump(cart, t.dataset.add, 1);
    toast(`Added ${dish(t.dataset.add).name} to your cart`);
    renderGrid(); renderCart();
  }
  if (t.dataset.dec) { bump(cart, t.dataset.dec, -1); renderGrid(); renderCart(); }

  if (t.dataset.buy) {                       // menu card: buy this dish right now
    direct = { [t.dataset.buy]: 1 };
    showBasketView();
    renderCart();
    drawer(true);
  }

  if (t.dataset.la || t.dataset.ld) {        // inside the drawer: change what is being ordered
    const id = t.dataset.la || t.dataset.ld;
    bump(active(), id, t.dataset.la ? 1 : -1);
    if (direct && Object.keys(direct).length === 0) direct = null;
    renderGrid(); renderCart();
  }
});

function drawer(open) {
  $("drawer").classList.toggle("on", open);
  $("scrim").classList.toggle("on", open);
  if (!open && direct) { direct = null; renderCart(); }   // closing a Buy now sheet drops it
}
$("openCart").onclick = () => { direct = null; if (!localStorage.getItem("hearth-order")) showBasketView(); renderCart(); drawer(true); };
$("closeCart").onclick = () => drawer(false);
$("scrim").onclick = () => drawer(false);
document.addEventListener("keydown", e => { if (e.key === "Escape") drawer(false); });

// ---------- checkout and tracking ----------

$("checkout").addEventListener("submit", async e => {
  e.preventDefault();
  $("formError").textContent = "";
  const f = new FormData(e.target);
  const body = new URLSearchParams({
    name: f.get("name"), phone: f.get("phone"), address: f.get("address"),
    items: Object.entries(active()).map(([id, q]) => `${id}:${q}`).join(",")
  });
  const res = await fetch("/api/orders", { method: "POST", body });
  const data = await res.json();
  if (!res.ok) { $("formError").textContent = data.error; return; }
  if (direct) direct = null; else cart = {};
  e.target.reset();
  renderGrid();
  renderCart();
  localStorage.setItem("hearth-order", data.id);
  track(data.id);
});

function track(id) {
  clearInterval(timer);
  $("basketView").hidden = true;
  $("trackView").hidden = false;
  $("drawerTitle").textContent = "Order #" + id;
  const poll = async () => {
    const res = await fetch("/api/orders/" + id);
    if (!res.ok) { reset(); return; }
    const o = await res.json();
    $("trackTitle").textContent = o.stage === 3 ? "Delivered. Enjoy your meal." : `Total ${money(o.total)}. This page updates on its own.`;
    $("steps").innerHTML = o.stages.map((s, i) =>
      `<li class="${i < o.stage || o.stage === 3 ? "done" : i === o.stage ? "now" : ""}">${s}</li>`).join("");
    $("trackItems").textContent = o.items.map(i => `${i.qty} × ${i.name}`).join(", ");
    if (o.stage === 3) clearInterval(timer);
  };
  poll();
  timer = setInterval(poll, 4000);
  drawer(true);
}

function showBasketView() {
  clearInterval(timer);
  $("basketView").hidden = false;
  $("trackView").hidden = true;
}

function reset() {
  localStorage.removeItem("hearth-order");
  showBasketView();
  renderCart();
}
$("newOrder").onclick = reset;

loadMenu();
