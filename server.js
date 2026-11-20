const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error("SESSION_SECRET must be set and at least 32 characters long.");
  process.exit(1);
}
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must be set and at least 12 characters long.");
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR || __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "777-kazino.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS credit_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_hash TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL CHECK(amount > 0),
    used_by TEXT,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    bet INTEGER NOT NULL,
    win INTEGER NOT NULL,
    grid TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "10kb" }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: DATA_DIR, table: "sessions" }),
  name: "777.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: "draft-7", legacyHeaders: false });
const spinLimiter = rateLimit({ windowMs: 60 * 1000, limit: 25, standardHeaders: "draft-7", legacyHeaders: false });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false });

const SYMBOLS = ["cherry", "lemon", "grapes", "watermelon", "orange", "bell", "diamond", "seven"];
const PAYOUTS = { cherry: 4, lemon: 5, grapes: 6, watermelon: 8, orange: 10, bell: 15, diamond: 25, seven: 50 };
const bets = new Set([1, 2, 5, 10, 20, 50]);

function ensurePlayer(req) {
  if (!req.session.playerId) req.session.playerId = crypto.randomUUID();
  const id = req.session.playerId;
  db.prepare("INSERT OR IGNORE INTO players (id, balance) VALUES (?, 0)").run(id);
  return id;
}
function playerBalance(id) {
  return db.prepare("SELECT balance FROM players WHERE id = ?").get(id).balance;
}
function codeHash(code) {
  return crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}
function adminOnly(req, res, next) {
  if (!req.session.isAdmin) return res.status(401).json({ error: "Admin girişi tələb olunur." });
  next();
}

app.get("/api/me", apiLimiter, (req, res) => {
  const id = ensurePlayer(req);
  res.json({ balance: playerBalance(id), demo: true });
});

app.post("/api/redeem", apiLimiter, (req, res) => {
  const id = ensurePlayer(req);
  const code = typeof req.body.code === "string" ? req.body.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9-]{8,40}$/.test(code)) return res.status(400).json({ error: "Düzgün kod daxil edin." });
  const redeem = db.transaction(() => {
    const row = db.prepare("SELECT id, amount, used_by FROM credit_codes WHERE code_hash = ?").get(codeHash(code));
    if (!row) return { error: "Kod tapılmadı." };
    if (row.used_by) return { error: "Bu kod artıq istifadə olunub." };
    db.prepare("UPDATE credit_codes SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_by IS NULL").run(id, row.id);
    db.prepare("UPDATE players SET balance = balance + ? WHERE id = ?").run(row.amount, id);
    return { amount: row.amount, balance: playerBalance(id) };
  });
  const result = redeem();
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ message: `${result.amount} demo AZN balansınıza əlavə edildi.`, ...result });
});

app.post("/api/spin", spinLimiter, (req, res) => {
  const id = ensurePlayer(req);
  const bet = Number(req.body.bet);
  if (!Number.isInteger(bet) || !bets.has(bet)) return res.status(400).json({ error: "Mərc seçimi düzgün deyil." });

  const spin = db.transaction(() => {
    const balance = playerBalance(id);
    if (balance < bet) return { error: "Balans kifayət etmir. Demo kod daxil edin." };

    db.prepare("UPDATE players SET balance = balance - ? WHERE id = ?").run(bet, id);
    const grid = Array.from({ length: 3 }, () =>
      Array.from({ length: 3 }, () => SYMBOLS[crypto.randomInt(SYMBOLS.length)])
    );

    // Yalnız orta sətirdə 3 eyni simvol olduqda demo uduşu verilir.
    const middleRow = [grid[0][1], grid[1][1], grid[2][1]];
    let win = 0;
    if (middleRow[0] === middleRow[1] && middleRow[1] === middleRow[2]) {
      win = bet * PAYOUTS[middleRow[0]];
      db.prepare("UPDATE players SET balance = balance + ? WHERE id = ?").run(win, id);
    }

    db.prepare("INSERT INTO game_history (player_id, bet, win, grid) VALUES (?, ?, ?, ?)")
      .run(id, bet, win, JSON.stringify(grid));
    return { grid, bet, win, balance: playerBalance(id), winningLine: win > 0 ? 1 : null };
  });

  const result = spin();
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ ...result, demo: true });
});

app.get("/api/history", apiLimiter, (req, res) => {
  const id = ensurePlayer(req);
  const rows = db.prepare(
    "SELECT bet, win, created_at FROM game_history WHERE player_id = ? ORDER BY id DESC LIMIT 15"
  ).all(id);
  res.json(rows);
});

app.post("/api/admin/login", adminLimiter, (req, res) => {
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Admin şifrəsi yanlışdır." });
  }
  req.session.isAdmin = true;
  res.json({ ok: true });
});
app.post("/api/admin/logout", adminOnly, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.post("/api/admin/codes", adminOnly, adminLimiter, (req, res) => {
  const amount = Number(req.body.amount);
  const count = Number(req.body.count || 1);
  if (!Number.isInteger(amount) || amount < 10 || amount > 100000 ||
      !Number.isInteger(count) || count < 1 || count > 20) {
    return res.status(400).json({ error: "Məbləğ 10–100000, kod sayı 1–20 olmalıdır." });
  }
  const insert = db.prepare("INSERT INTO credit_codes (code_hash, amount) VALUES (?, ?)");
  const createMany = db.transaction(() => {
    const output = [];
    for (let i = 0; i < count; i++) {
      const code = `777-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
      insert.run(codeHash(code), amount);
      output.push(code);
    }
    return output;
  });
  res.json({ amount, codes: createMany() });
});

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`777 demo slot running on port ${PORT}`));
