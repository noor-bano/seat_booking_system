const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const PORT = 5000;
const app = express();

app.use(cors());
app.use(express.json());

const seats = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
/** @type {{ seatId: number, userName: string, date: string }[]} */
const bookings = [];
/** @type {{ userName: string, passwordHash: string, squad: number, batch: "A" | "B" }[]} */
const users = [];
/** @type {{ token: string, userName: string }[]} */
const sessions = [];

function normalizeDateKey(date) {
  if (typeof date !== "string") return "";
  return date.trim().slice(0, 10);
}

function localTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeUserName(userName) {
  if (typeof userName !== "string") return "";
  return userName.trim();
}

function hashPassword(password) {
  // In-memory only; still avoid storing plain-text.
  // NOTE: This is not production-grade (no per-user salt/iterations).
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function isoWeekNumberFromDateKey(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(dt.getTime())) return null;

  // ISO week date weeks start on Monday, week 1 contains Jan 4th.
  const d = new Date(dt);
  d.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

function weekdayFromDateKey(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const day = dt.getDay(); // 0 Sun .. 6 Sat
  const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return map[day] ?? null;
}

function bookingEligibility(batch, dateKey) {
  const isoWeek = isoWeekNumberFromDateKey(dateKey);
  const weekday = weekdayFromDateKey(dateKey);
  if (!isoWeek || !weekday) return { allowed: false, reason: "Invalid date" };
  if (weekday === "Sat" || weekday === "Sun") return { allowed: false, reason: "Weekend bookings are not allowed" };

  // Week 1/2 cycle determined by ISO week parity.
  // Odd ISO weeks => Week 1, Even ISO weeks => Week 2.
  const cycleWeek = isoWeek % 2 === 1 ? 1 : 2;

  const batchAWeek1 = new Set(["Mon", "Tue", "Wed"]);
  const batchAWeek2 = new Set(["Thu", "Fri"]);
  const batchBWeek1 = new Set(["Thu", "Fri"]);
  const batchBWeek2 = new Set(["Mon", "Tue", "Wed"]);

  const allowedSet =
    batch === "A"
      ? cycleWeek === 1
        ? batchAWeek1
        : batchAWeek2
      : cycleWeek === 1
        ? batchBWeek1
        : batchBWeek2;

  const allowed = allowedSet.has(weekday);
  return allowed
    ? { allowed: true, reason: null, cycleWeek, weekday }
    : { allowed: false, reason: `Not allowed for Batch ${batch} on ${weekday} (Week ${cycleWeek})`, cycleWeek, weekday };
}

function cycleRangeFromDateKey(dateKey) {
  const isoWeek = isoWeekNumberFromDateKey(dateKey);
  if (!isoWeek) return null;

  const thisWeek = weekRangeFromDateKey(dateKey);
  if (!thisWeek) return null;

  // Odd ISO week => week 1 of cycle, even => week 2
  if (isoWeek % 2 === 1) {
    const nextWeekStart = weekRangeFromDateKey(thisWeek.endKey)?.startKey; // fallback
    const start = thisWeek.startKey;
    // Compute next week start/end by adding 7 days
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(thisWeek.startKey);
    if (!m) return null;
    const startDt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const nextStartDt = new Date(startDt);
    nextStartDt.setDate(startDt.getDate() + 7);
    const nextStartKey = `${nextStartDt.getFullYear()}-${String(nextStartDt.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(nextStartDt.getDate()).padStart(2, "0")}`;
    const nextWeek = weekRangeFromDateKey(nextStartKey);
    if (!nextWeek) return null;
    return { startKey: start, endKey: nextWeek.endKey };
  }

  // Even ISO week => week 2 of cycle, so week 1 is previous week
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(thisWeek.startKey);
  if (!m) return null;
  const startDt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const prevStartDt = new Date(startDt);
  prevStartDt.setDate(startDt.getDate() - 7);
  const prevStartKey = `${prevStartDt.getFullYear()}-${String(prevStartDt.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(prevStartDt.getDate()).padStart(2, "0")}`;
  const prevWeek = weekRangeFromDateKey(prevStartKey);
  if (!prevWeek) return null;
  return { startKey: prevWeek.startKey, endKey: thisWeek.endKey };
}

function getBookedCount(dateKey) {
  if (!dateKey) return 0;
  const set = new Set();
  for (const b of bookings) {
    if (b.date === dateKey) set.add(b.seatId);
  }
  return set.size;
}

function weekRangeFromDateKey(dateKey) {
  // Interpret dateKey as local date (YYYY-MM-DD)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  // Monday-start week
  const day = dt.getDay(); // 0 Sun .. 6 Sat
  const diffToMonday = (day + 6) % 7;

  const start = new Date(dt);
  start.setDate(dt.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const toKey = (d) => {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  };

  return { startKey: toKey(start), endKey: toKey(end) };
}

function authFromHeader(req) {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return sessions.find((s) => s.token === token) ?? null;
}

app.post("/auth/signup", (req, res) => {
  const userName = normalizeUserName(req.body?.userName);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const squad = Number(req.body?.squad);
  const batchRaw = typeof req.body?.batch === "string" ? req.body.batch.trim().toUpperCase() : "";
  const batch = batchRaw === "A" || batchRaw === "B" ? batchRaw : "";

  if (!userName) return res.status(400).json({ error: "userName is required" });
  if (password.length < 4) return res.status(400).json({ error: "password must be at least 4 characters" });
  if (!Number.isInteger(squad) || squad < 1 || squad > 10)
    return res.status(400).json({ error: "squad must be an integer 1..10" });
  if (!batch) return res.status(400).json({ error: "batch must be A or B" });

  const exists = users.some((u) => u.userName.toLowerCase() === userName.toLowerCase());
  if (exists) return res.status(409).json({ error: "user already exists" });

  users.push({ userName, passwordHash: hashPassword(password), squad, batch });
  const token = crypto.randomUUID();
  sessions.push({ token, userName });

  return res.status(201).json({ ok: true, token, userName, squad, batch });
});

app.post("/auth/login", (req, res) => {
  const userName = normalizeUserName(req.body?.userName);
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!userName) return res.status(400).json({ error: "userName is required" });
  if (!password) return res.status(400).json({ error: "password is required" });

  const user = users.find((u) => u.userName.toLowerCase() === userName.toLowerCase());
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const token = crypto.randomUUID();
  sessions.push({ token, userName: user.userName });
  return res.json({ ok: true, token, userName: user.userName, squad: user.squad, batch: user.batch });
});

app.post("/auth/logout", (req, res) => {
  const session = authFromHeader(req);
  if (!session) return res.status(401).json({ error: "not logged in" });
  const idx = sessions.findIndex((s) => s.token === session.token);
  if (idx >= 0) sessions.splice(idx, 1);
  return res.json({ ok: true });
});

app.get("/seats", (req, res) => {
  const dateKey = normalizeDateKey(req.query.date);
  const result = seats.map((s) => {
    const booked = dateKey
      ? bookings.some((b) => b.seatId === s.id && b.date === dateKey)
      : false;
    const type = s.id >= 41 ? "floating" : "fixed";
    return { id: s.id, type, booked };
  });
  res.json(result);
});

app.get("/eligibility", (req, res) => {
  const session = authFromHeader(req);
  if (!session) return res.status(401).json({ error: "not logged in" });
  const user = users.find((u) => u.userName.toLowerCase() === session.userName.toLowerCase());
  if (!user) return res.status(401).json({ error: "invalid session" });

  const dateKey = normalizeDateKey(req.query.date);
  if (!dateKey) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const eligFixed = bookingEligibility(user.batch, dateKey);
  const weekday = weekdayFromDateKey(dateKey);
  const allowedFloating = Boolean(weekday && weekday !== "Sat" && weekday !== "Sun");
  return res.json({
    ok: true,
    allowedFixed: eligFixed.allowed,
    allowedFloating,
    reasonFixed: eligFixed.reason,
    cycleWeek: eligFixed.cycleWeek,
    weekday: eligFixed.weekday,
    batch: user.batch,
    squad: user.squad,
    userName: user.userName,
  });
});

app.get("/stats", (req, res) => {
  const dateKey = normalizeDateKey(req.query.date);
  const userName = normalizeUserName(req.query.userName);

  const totalSeats = seats.length;
  const bookedCount = dateKey ? getBookedCount(dateKey) : 0;
  const availableCount = totalSeats - bookedCount;
  const occupancyPercent = totalSeats ? Math.round((bookedCount / totalSeats) * 100) : 0;

  const activeBooking =
    dateKey && userName
      ? bookings.find((b) => b.date === dateKey && b.userName.toLowerCase() === userName.toLowerCase()) ?? null
      : null;

  res.json({ date: dateKey, totalSeats, bookedCount, availableCount, occupancyPercent, activeBooking });
});

app.get("/bookings/week", (req, res) => {
  const dateKey = normalizeDateKey(req.query.date);
  if (!dateKey) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const range = weekRangeFromDateKey(dateKey);
  if (!range) return res.status(400).json({ error: "invalid date (YYYY-MM-DD)" });

  const weekBookings = bookings
    .filter((b) => b.date >= range.startKey && b.date <= range.endKey)
    .slice()
    .sort((a, b) => (a.date === b.date ? a.seatId - b.seatId : a.date.localeCompare(b.date)));

  res.json({ start: range.startKey, end: range.endKey, bookings: weekBookings });
});

app.get("/bookings/recent", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 10;

  const recent = bookings
    .slice()
    .sort((a, b) => (a.date === b.date ? b.seatId - a.seatId : b.date.localeCompare(a.date)))
    .slice(0, limit)
    .map((b) => ({
      ...b,
      seatType: b.seatId >= 41 ? "floating" : "fixed",
    }));

  res.json({ bookings: recent });
});

app.post("/leave", (req, res) => {
  const session = authFromHeader(req);
  if (!session) return res.status(401).json({ error: "not logged in" });
  const userName = normalizeUserName(session.userName);
  const dateKey = normalizeDateKey(req.body?.date);
  if (!dateKey) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const before = bookings.length;
  for (let i = bookings.length - 1; i >= 0; i--) {
    const b = bookings[i];
    if (b.date === dateKey && b.userName.toLowerCase() === userName.toLowerCase()) {
      bookings.splice(i, 1);
    }
  }
  const removed = before - bookings.length;
  return res.json({ ok: true, removed });
});

app.post("/book", (req, res) => {
  const session = authFromHeader(req);
  if (!session) return res.status(401).json({ error: "not logged in" });
  const user = users.find((u) => u.userName.toLowerCase() === session.userName.toLowerCase());
  if (!user) return res.status(401).json({ error: "invalid session" });

  const { seatId, date } = req.body ?? {};

  const parsedSeatId = Number(seatId);
  if (!Number.isInteger(parsedSeatId) || parsedSeatId < 1 || parsedSeatId > 50) {
    return res.status(400).json({ error: "seatId must be an integer 1..50" });
  }
  const userName = user.userName;

  const dateKey = normalizeDateKey(date);
  if (!dateKey) {
    return res.status(400).json({ error: "date is required (e.g. 2026-04-14)" });
  }

  const isFloating = parsedSeatId >= 41;
  if (!isFloating) {
    const elig = bookingEligibility(user.batch, dateKey);
    if (!elig.allowed) {
      return res.status(403).json({ error: elig.reason || "Not allowed to book on this day" });
    }
  } else {
    const weekday = weekdayFromDateKey(dateKey);
    if (!weekday || weekday === "Sat" || weekday === "Sun") {
      return res.status(403).json({ error: "Weekend bookings are not allowed" });
    }
  }

  // 3 PM rule: bookings allowed only after 3 PM (server local time)
  {
    const now = new Date();
    if (now.getHours() < 15) {
      return res.status(403).json({ error: "Booking allowed only after 3 PM" });
    }
  }

  // One seat per user per day
  const alreadyHasBooking = bookings.some(
    (b) => b.date === dateKey && b.userName.toLowerCase() === userName.toLowerCase()
  );
  if (alreadyHasBooking) {
    return res.status(409).json({ error: "User already booked for that day" });
  }

  const exists = bookings.some((b) => b.seatId === parsedSeatId && b.date === dateKey);
  if (exists) {
    return res.status(409).json({ error: "Seat already booked" });
  }

  // Max 5 bookings per 2-week cycle
  const cycle = cycleRangeFromDateKey(dateKey);
  if (cycle) {
    const countInCycle = bookings.filter(
      (b) =>
        b.userName.toLowerCase() === userName.toLowerCase() &&
        b.date >= cycle.startKey &&
        b.date <= cycle.endKey
    ).length;
    if (countInCycle >= 5) {
      return res.status(403).json({ error: "Max 5 bookings per 2-week cycle" });
    }
  }

  const booking = { seatId: parsedSeatId, userName: userName.trim(), date: dateKey };
  bookings.push(booking);

  return res.status(201).json({ ok: true, booking });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});

