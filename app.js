const $ = (id) => document.getElementById(id);
const loginView = $("loginView");
const gameView = $("gameView");
const loginForm = $("loginForm");
const loginError = $("loginError");
const logoutBtn = $("logoutBtn");
const spinBtn = $("spinBtn");
const betInput = $("bet");
const resultBox = $("result");
let spinning = false;

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Xəta baş verdi.");
  return data;
}
function showGame(player) {
  loginView.classList.add("hidden");
  gameView.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  updateBalance(player.points);
}
function showLogin() {
  gameView.classList.add("hidden");
  loginView.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
}
function updateBalance(points) {
  $("balance").textContent = Number(points).toLocaleString("az-AZ");
}
async function checkSession() {
  try {
    const data = await api("/api/status");
    if (data.loggedIn) showGame(data.player);
    else showLogin();
  } catch {
    showLogin();
  }
}
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const button = loginForm.querySelector("button");
  button.disabled = true;
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ code: $("accessCode").value })
    });
    $("accessCode").value = "";
    showGame(data.player);
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
logoutBtn.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
  showLogin();
});
$("minusBet").addEventListener("click", () => {
  betInput.value = Math.max(1, Number(betInput.value || 1) - 1);
});
$("plusBet").addEventListener("click", () => {
  betInput.value = Math.min(100, Number(betInput.value || 1) + 1);
});
function animateReels(finalReels) {
  const emojis = ["🍒", "🍋", "🍇", "🍊", "🍉", "7️⃣"];
  const nodes = [ $("reel0"), $("reel1"), $("reel2") ];
  return new Promise((resolve) => {
    let ticks = 0;
    const timer = setInterval(() => {
      nodes.forEach((node) => node.textContent = emojis[Math.floor(Math.random() * emojis.length)]);
      ticks += 1;
      if (ticks >= 12) {
        clearInterval(timer);
        nodes.forEach((node, i) => node.textContent = finalReels[i].emoji);
        resolve();
      }
    }, 65);
  });
}
spinBtn.addEventListener("click", async () => {
  if (spinning) return;
  const bet = Number(betInput.value);
  if (!Number.isInteger(bet) || bet < 1 || bet > 100) {
    resultBox.textContent = "Mərci 1–100 virtual xal arasında seç.";
    return;
  }
  spinning = true;
  spinBtn.disabled = true;
  resultBox.className = "result";
  resultBox.textContent = "Slot fırlanır…";
  try {
    const data = await api("/api/spin", {
      method: "POST",
      body: JSON.stringify({ bet })
    });
    await animateReels(data.reels);
    updateBalance(data.points);
    resultBox.textContent = data.message + (data.multiplier ? ` Ödəniş: ×${data.multiplier}.` : "");
    resultBox.className = data.win > 0 ? "result win" : "result loss";
  } catch (error) {
    resultBox.textContent = error.message;
    resultBox.className = "result";
    if (error.message.includes("giriş")) showLogin();
  } finally {
    spinning = false;
    spinBtn.disabled = false;
  }
});
checkSession();