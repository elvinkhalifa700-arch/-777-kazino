const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const app = express();
const db = new Database("777-kazino.sqlite");
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SESSION_SECRET || SESSION_SECRET.length < 32 || !ADMIN_PASSWORD) {
  console.error("Set SESSION_SECRET (32+ characters) and ADMIN_PASSWORD in your environment.");
  process.exit(1);
}

db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_hash TEXT NOT NULL UNIQUE,
    display_code TEXT NOT NULL,
    demo_balance REAL NOT NULL DEFAULT 25.00,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS balance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    delta REAL NOT NULL,
    new_balance REAL NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );
`);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expire INTEGER NOT NULL
  )
`);

class SQLiteStore extends session.Store {
  get(sid, callback) {
    try {
      const row = db.prepare(
        "SELECT sess, expire FROM sessions WHERE sid=?"
      ).get(sid);

      if (!row || row.expire <= Date.now()) {
        db.prepare("DELETE FROM sessions WHERE sid=?").run(sid);
        return callback(null, null);
      }

      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback = () => {}) {
    try {
      const expire = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;

      db.prepare(`
        INSERT INTO sessions (sid, sess, expire)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET
        sess=excluded.sess, expire=excluded.expire
      `).run(sid, JSON.stringify(sess), expire);

      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      db.prepare("DELETE FROM sessions WHERE sid=?").run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      const expire = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;

      db.prepare("UPDATE sessions SET expire=? WHERE sid=?")
        .run(expire, sid);

      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}

app.set("trust proxy", 1);

app.use(session({
  store: new SQLiteStore(),
  name: "777demo.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 8 * 60 * 60 * 1000
  }
}));
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, limit: 120 }));
app.use(express.static(path.join(__dirname, "public")));

const hash = s => crypto.createHash("sha256").update(s).digest("hex");
const adminOnly = (req, res, next) => req.session.admin ? next() : res.status(401).json({ error: "Admin girişi tələb olunur." });
const customerOnly = (req, res, next) => req.session.customerId ? next() : res.status(401).json({ error: "Əvvəlcə giriş kodunu təsdiqlə." });

app.post("/api/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 8 }), (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{6,32}$/.test(code)) return res.status(400).json({ error: "Kod formatı düzgün deyil." });
  const customer = db.prepare("SELECT id FROM customers WHERE code_hash=? AND active=1").get(hash(code));
  if (!customer) return res.status(401).json({ error: "Kod yanlışdır və ya deaktivdir." });
  req.session.customerId = customer.id;
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", customerOnly, (req, res) => {
  const row = db.prepare("SELECT id, display_code, demo_balance, created_at FROM customers WHERE id=? AND active=1").get(req.session.customerId);
  if (!row) return res.status(401).json({ error: "Hesab tapılmadı." });
  res.json(row);
});

app.post("/api/admin/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 }), (req, res) => {
  if (String(req.body.password || "") !== ADMIN_PASSWORD) return res.status(401).json({ error: "Admin şifrəsi yanlışdır." });
  req.session.admin = true;
  res.json({ ok: true });
});

app.post("/api/admin/logout", adminOnly, (req, res) => {
  req.session.admin = false;
  res.json({ ok: true });
});

app.post("/api/admin/customers", adminOnly, (req, res) => {
  const code = "777-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  db.prepare("INSERT INTO customers(code_hash, display_code) VALUES(?, ?)").run(hash(code), code);
  res.json({ code });
});

app.get("/api/admin/customers", adminOnly, (req, res) => {
  const rows = db.prepare("SELECT id, display_code, demo_balance, created_at, active FROM customers ORDER BY id DESC").all();
  res.json(rows);
});

app.post("/api/admin/balance", adminOnly, (req, res) => {
  const id = Number(req.body.customerId);
  const amount = Number(req.body.amount);
  const note = String(req.body.note || "Admin tərəfindən demo göstəricisi yeniləndi").slice(0, 120);
  if (!Number.isInteger(id) || !Number.isFinite(amount) || amount < 0 || amount > 1000000) {
    return res.status(400).json({ error: "Müştəri və ya demo göstəricisi düzgün deyil." });
  }
  const customer = db.prepare("SELECT id, demo_balance FROM customers WHERE id=?").get(id);
  if (!customer) return res.status(404).json({ error: "Müştəri tapılmadı." });
  const delta = amount - customer.demo_balance;
  const tx = db.transaction(() => {
    db.prepare("UPDATE customers SET demo_balance=? WHERE id=?").run(amount, id);
    db.prepare("INSERT INTO balance_log(customer_id, delta, new_balance, note) VALUES(?,?,?,?)").run(id, delta, amount, note);
  });
  tx();
  res.json({ ok: true, demo_balance: amount });
});

app.get("/api/admin/log/:id", adminOnly, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID yanlışdır." });
  res.json(db.prepare("SELECT delta, new_balance, note, created_at FROM balance_log WHERE customer_id=? ORDER BY id DESC LIMIT 50").all(id));
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`777 virtual demo running on http://localhost:${PORT}`));
