const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("node:crypto");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in production.");
}
if (isProduction && !process.env.DEMO_ACCESS_CODE) {
  throw new Error("Set DEMO_ACCESS_CODE in your hosting environment.");
}
if (isProduction && !process.env.ADMIN_PASSWORD) {
  throw new Error("Set ADMIN_PASSWORD in your hosting environment.");
}

app.disable("x-powered-by");
if (isProduction) app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "10kb" }));
app.use(session({
  name: "777demo.sid",
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });
const spinLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });

const STARTING_POINTS = 1000;
const symbols = [
  { id: "cherry", name: "Albalı", emoji: "🍒", weight: 28 },
  { id: "lemon", name: "Limon", emoji: "🍋", weight: 24 },
  { id: "grape", name: "Üzüm", emoji: "🍇", weight: 20 },
  { id: "orange", name: "Portağal", emoji: "🍊", weight: 16 },
  { id: "watermelon", name: "Qarpız", emoji: "🍉", weight: 9 },
  { id: "seven", name: "777", emoji: "7️⃣", weight: 3 }
];

function requireLogin(req, res, next) {
  if (!req.session.player) return res.status(401).json({ error: "Əvvəlcə giriş kodunu daxil et." });
  next();
}
function pickSymbol() {
  const total = symbols.reduce((sum, s) => sum + s.weight, 0);
  let roll = crypto.randomInt(total);
  for (const symbol of symbols) {
    roll -= symbol.weight;
    if (roll < 0) return symbol;
  }
  return symbols[0];
}
function safePlayer(req) {
  return { points: req.session.player.points, name: "Demo oyunçu" };
}

app.get("/api/status", (req, res) => {
  res.json({ loggedIn: Boolean(req.session.player), player: req.session.player ? safePlayer(req) : null });
});

app.post("/api/login", loginLimiter, (req, res) => {
  const code = String(req.body?.code || "").trim();
  const expected = process.env.DEMO_ACCESS_CODE || "7777";
  if (!code || code.length > 64 || !crypto.timingSafeEqual(
    Buffer.from(code.padEnd(64, "\0").slice(0, 64)),
    Buffer.from(expected.padEnd(64, "\0").slice(0, 64))
  )) {
    return res.status(401).json({ error: "Giriş kodu düzgün deyil." });
  }
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Sessiya yaradıla bilmədi." });
    req.session.player = { points: STARTING_POINTS };
    res.json({ ok: true, player: safePlayer(req) });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post("/api/spin", requireLogin, spinLimiter, (req, res) => {
  const bet = Number(req.body?.bet);
  if (!Number.isInteger(bet) || bet < 1 || bet > 100) {
    return res.status(400).json({ error: "Mərc 1–100 virtual xal arasında olmalıdır." });
  }
  if (req.session.player.points < bet) {
    return res.status(400).json({ error: "Virtual xalın kifayət etmir." });
  }

  req.session.player.points -= bet;
  const reels = [pickSymbol(), pickSymbol(), pickSymbol()];
  let multiplier = 0;
  if (reels.every(s => s.id === "seven")) multiplier = 20;
  else if (reels.every(s => s.id === reels[0].id)) multiplier = reels[0].id === "watermelon" ? 10 : 6;
  else if (reels[0].id === reels[1].id || reels[1].id === reels[2].id || reels[0].id === reels[2].id) multiplier = 2;

  const win = bet * multiplier;
  req.session.player.points += win;
  res.json({
    reels: reels.map(({ id, name, emoji }) => ({ id, name, emoji })),
    bet, multiplier, win, points: req.session.player.points,
    message: win > 0 ? `Təbriklər! ${win} virtual xal qazandın.` : "Bu dəfə uduzdun. Yenidən sına!"
  });
});

app.post("/api/admin/check", loginLimiter, (req, res) => {
  const password = String(req.body?.password || "");
  const expected = process.env.ADMIN_PASSWORD || "change-this-admin-password";
  const a = Buffer.from(password.padEnd(128, "\0").slice(0, 128));
  const b = Buffer.from(expected.padEnd(128, "\0").slice(0, 128));
  if (password.length > 128 || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Admin parolu yanlışdır." });
  }
  res.json({ ok: true, note: "Demo admin yoxlaması uğurludur. Bu demo versiyada istifadəçi idarəetməsi və real pul əməliyyatları yoxdur." });
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`777 Fruit Demo running on port ${PORT}`));