const $ = id => document.getElementById(id);
let mode = "login";

// Already signed in? Go straight to the menu.
(async () => {
  const t = localStorage.getItem("hearth-token");
  if (!t) return;
  try {
    const r = await fetch("/api/me", { headers: { Authorization: "Bearer " + t } });
    if (r.ok) location.replace("/");
  } catch (e) { /* server not reachable: stay on the login page */ }
})();

function setMode(m) {
  mode = m;
  const signup = m === "signup";
  $("tabLogin").setAttribute("aria-pressed", String(!signup));
  $("tabSignup").setAttribute("aria-pressed", String(signup));
  $("confirmRow").hidden = !signup;
  $("hint").hidden = !signup;
  $("go").textContent = signup ? "Create account" : "Log in";
  $("sub").textContent = signup ? "Set a password and we'll save your account." : "Log in to order fresh from our kitchen.";
  $("password").autocomplete = signup ? "new-password" : "current-password";
  $("error").textContent = "";
}
$("tabLogin").onclick = () => setMode("login");
$("tabSignup").onclick = () => setMode("signup");

// Digits only, max 10. A pasted "+91 98765 43210" is trimmed to the 10-digit number.
$("phone").addEventListener("input", e => {
  let d = e.target.value.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  e.target.value = d.slice(0, 10);
});

$("peek").onclick = () => {
  const show = $("password").type === "password";
  $("password").type = show ? "text" : "password";
  $("confirm").type = show ? "text" : "password";
  $("peek").textContent = show ? "Hide" : "Show";
  $("peek").setAttribute("aria-pressed", String(show));
  $("peek").setAttribute("aria-label", show ? "Hide password" : "Show password");
};

$("form").addEventListener("submit", async e => {
  e.preventDefault();
  const phone = $("phone").value, password = $("password").value;
  const fail = msg => { $("error").textContent = msg; };
  fail("");
  if (!/^\d{10}$/.test(phone)) return fail("Enter your 10-digit mobile number.");
  if (password.length < 6) return fail("Password must be at least 6 characters.");
  if (mode === "signup" && password !== $("confirm").value) return fail("The two passwords don't match.");

  $("go").disabled = true;
  try {
    const res = await fetch(mode === "signup" ? "/api/signup" : "/api/login", {
      method: "POST",
      body: new URLSearchParams({ phone, password })
    });
    const data = await res.json();
    if (!res.ok) return fail(data.error);
    localStorage.setItem("hearth-token", data.token);
    location.replace("/");
  } catch (err) {
    fail("Can't reach the server. Is it running?");
  } finally {
    $("go").disabled = false;
  }
});
