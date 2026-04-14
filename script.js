
const API_URL = "http://localhost:5000";
const AUTH_KEY = "stitch_auth";
let lastEligibility = null;

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

function setAuth(auth) {
  if (!auth) localStorage.removeItem(AUTH_KEY);
  else localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

function getUserName() {
  return getAuth()?.userName || "";
}

function getUser() {
  return getAuth();
}

function getBatch() {
  return getUser()?.batch || lastEligibility?.batch || "";
}

function authHeader() {
  const token = getAuth()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setStatus(text) {
  const el = document.getElementById("seatStatus");
  if (el) el.textContent = text ?? "";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getSelectedDate() {
  const el = document.getElementById("datePicker");
  const raw = el && typeof el.value === "string" ? el.value : "";
  return raw && raw.length >= 10 ? raw.slice(0, 10) : todayKey();
}

function formatTodayLong() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function showError(prefix, err) {
  const msg = err instanceof Error ? err.message : String(err);
  setStatus(`${prefix}: ${msg}`);
}

function isoWeekNumberFromDateKey(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey));
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(dt.getTime())) return null;
  const d = new Date(dt);
  d.setHours(0, 0, 0, 0);
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
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey));
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const day = dt.getDay();
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day] ?? null;
}

function isEligibleForBatch(batch, dateKey) {
  const weekday = weekdayFromDateKey(dateKey);
  const isoWeek = isoWeekNumberFromDateKey(dateKey);
  if (!weekday || !isoWeek) return false;
  if (weekday === "Sat" || weekday === "Sun") return false;

  const cycleWeek = isoWeek % 2 === 1 ? 1 : 2; // odd => week1, even => week2
  const allowed =
    batch === "A"
      ? cycleWeek === 1
        ? ["Mon", "Tue", "Wed"]
        : ["Thu", "Fri"]
      : cycleWeek === 1
        ? ["Thu", "Fri"]
        : ["Mon", "Tue", "Wed"];
  return allowed.includes(weekday);
}

function renderAccessRules() {
  const el = document.getElementById("accessRulesLabel");
  if (!el) return;
  const batch = getBatch();
  if (!batch) {
    el.textContent = "—";
    return;
  }
  if (batch === "A") el.textContent = "Week 1: Mon–Wed • Week 2: Thu–Fri";
  else el.textContent = "Week 1: Thu–Fri • Week 2: Mon–Wed";
}

function renderEligibilityCalendar() {
  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("calendarMonthLabel");
  if (!grid || !monthLabel) return;

  const selected = getSelectedDate();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selected);
  const year = m ? Number(m[1]) : new Date().getFullYear();
  const monthIndex = m ? Number(m[2]) - 1 : new Date().getMonth();

  const first = new Date(year, monthIndex, 1);
  const monthName = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  monthLabel.textContent = monthName;

  // Clear + weekday headers
  grid.innerHTML = "";
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d) => {
    const h = document.createElement("div");
    h.className = "text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center";
    h.textContent = d;
    grid.appendChild(h);
  });

  const startDay = (first.getDay() + 6) % 7; // Monday=0
  for (let i = 0; i < startDay; i++) {
    const pad = document.createElement("div");
    grid.appendChild(pad);
  }

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const pad2 = (n) => String(n).padStart(2, "0");
  const batch = getBatch();

  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
    const eligible = batch ? isEligibleForBatch(batch, key) : false;
    const isSelected = key === selected;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "h-9 rounded-lg text-xs font-bold transition-colors " +
      (isSelected ? "ring-2 ring-primary/30 " : "");
    btn.textContent = String(day);

    if (eligible) {
      btn.style.backgroundColor = "#9ff5c1";
      btn.style.color = "#00142f";
    } else {
      btn.style.backgroundColor = "#e5e9eb";
      btn.style.color = "#444650";
    }

    btn.addEventListener("click", () => {
      const dp = document.getElementById("datePicker");
      if (dp) dp.value = key;
      // trigger refresh path
      loadSeats().catch(() => {});
      loadDashboardStats().catch(() => {});
      renderEligibilityCalendar();
    });

    grid.appendChild(btn);
  }
}

function mondayOfWeek(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey));
  const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
  const day = (dt.getDay() + 6) % 7; // Mon=0
  const mon = new Date(dt);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(dt.getDate() - day);
  return mon;
}

function toDateKeyLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function renderScheduleCard() {
  const list = document.getElementById("scheduleList");
  if (!list) return;

  const userName = getUserName();
  const batch = getBatch();
  const selected = getSelectedDate();
  const mon = mondayOfWeek(selected);
  const today = todayKey();

  let weekBookings = [];
  if (userName) {
    try {
      const res = await fetch(`${API_URL}/bookings/week?date=${encodeURIComponent(selected)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.bookings)) weekBookings = data.bookings;
    } catch {
      weekBookings = [];
    }
  }

  const userBookingsByDate = new Map();
  for (const b of weekBookings) {
    if (String(b.userName).toLowerCase() === String(userName).toLowerCase()) {
      userBookingsByDate.set(b.date, b);
    }
  }

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const items = [];

  for (let i = 0; i < days.length; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const key = toDateKeyLocal(d);
    const dayLabel = days[i];
    const dayNum = d.getDate();

    const eligible = batch ? isEligibleForBatch(batch, key) : false;
    const booking = userBookingsByDate.get(key);
    const isToday = key === today;

    const containerClass = isToday
      ? "flex items-center gap-4 border-2 border-white/20 p-3 rounded-xl"
      : `flex items-center gap-4 ${eligible ? "" : "opacity-40"}`;

    const boxClass = isToday
      ? "w-12 h-12 bg-white rounded-xl flex flex-col items-center justify-center text-primary"
      : "w-12 h-12 bg-white/10 rounded-xl flex flex-col items-center justify-center border border-white/10";

    const title = isToday ? "Today" : eligible ? "Office Access Day" : "Remote Only";
    const subtitle = booking
      ? `Booked: Seat ${booking.seatId}`
      : eligible
        ? `Batch ${batch} Allowed`
        : "Not in your batch schedule";

    const rightIcon = booking
      ? '<span class="material-symbols-outlined ml-auto text-secondary-fixed">check_circle</span>'
      : eligible
        ? '<span class="material-symbols-outlined ml-auto text-secondary-fixed">check_circle</span>'
        : "";

    items.push(`
<div class="${containerClass}">
  <div class="${boxClass}">
    <span class="text-[10px] uppercase font-bold opacity-70">${dayLabel}</span>
    <span class="text-lg font-bold">${dayNum}</span>
  </div>
  <div>
    <p class="text-sm ${isToday ? "font-bold" : "font-semibold"}">${title}</p>
    <p class="text-xs ${booking ? "text-secondary-fixed" : "opacity-60"}">${subtitle}</p>
  </div>
  ${rightIcon}
</div>`);
  }

  list.innerHTML = items.join("");
}

async function loadDashboardStats() {
  const userName = getUserName();
  const date = getSelectedDate();

  const todayLabel = document.getElementById("todayLabel");
  if (todayLabel) todayLabel.textContent = formatTodayLong();

  const welcomeName = document.getElementById("welcomeName");
  if (welcomeName) welcomeName.textContent = userName || "—";

  const user = getUser();
  const batchEl = document.getElementById("userBatchLabel");
  const squadEl = document.getElementById("userSquadLabel");
  if (batchEl) batchEl.textContent = user?.batch ? `Batch ${user.batch}` : "—";
  if (squadEl) squadEl.textContent = user?.squad ? `Squad ${user.squad}` : "—";
  renderAccessRules();

  if (!userName) return;

  const res = await fetch(
    `${API_URL}/stats?date=${encodeURIComponent(date)}&userName=${encodeURIComponent(userName)}`
  );
  const stats = await res.json();

  const floatingSeatsValue = document.getElementById("floatingSeatsValue");
  if (floatingSeatsValue) floatingSeatsValue.textContent = `${stats.availableCount} Available`;

  const occupancyValue = document.getElementById("occupancyValue");
  if (occupancyValue) occupancyValue.textContent = `${stats.occupancyPercent}% Full`;

  const occupancyMeta = document.getElementById("occupancyMeta");
  if (occupancyMeta) occupancyMeta.textContent = `${stats.bookedCount}/${stats.totalSeats} seats booked`;

  const analyticsOccupancy = document.getElementById("analyticsOccupancy");
  if (analyticsOccupancy) analyticsOccupancy.textContent = `${stats.occupancyPercent}%`;
  const analyticsAvailable = document.getElementById("analyticsAvailable");
  if (analyticsAvailable) analyticsAvailable.textContent = String(stats.availableCount);
  const analyticsBooked = document.getElementById("analyticsBooked");
  if (analyticsBooked) analyticsBooked.textContent = String(stats.bookedCount);

  const activeBookingTitle = document.getElementById("activeBookingTitle");
  const activeBookingMeta = document.getElementById("activeBookingMeta");
  if (stats.activeBooking?.seatId) {
    if (activeBookingTitle) activeBookingTitle.textContent = `Seat ${stats.activeBooking.seatId}`;
    if (activeBookingMeta) activeBookingMeta.textContent = `${stats.activeBooking.date} • ${stats.activeBooking.userName}`;
  } else {
    if (activeBookingTitle) activeBookingTitle.textContent = "No active booking";
    if (activeBookingMeta) activeBookingMeta.textContent = `For ${date}`;
  }
}
// Fetch seats
async function loadSeats() {
  setStatus("Loading seats…");
  const date = getSelectedDate();
  const seatsRes = await fetch(`${API_URL}/seats?date=${encodeURIComponent(date)}`);
  const seats = await seatsRes.json();

  let eligibility = null;
  try {
    const eligRes = await fetch(`${API_URL}/eligibility?date=${encodeURIComponent(date)}`, {
      headers: { ...authHeader() },
    });
    eligibility = await eligRes.json().catch(() => null);
  } catch {
    eligibility = null;
  }
  lastEligibility = eligibility;
  renderAccessRules();
  renderEligibilityCalendar();

  const container = document.getElementById("seats");
  if (!container) return;
  container.innerHTML = "";

  const canBookFixed = Boolean(eligibility?.allowedFixed);
  const canBookFloating = Boolean(eligibility?.allowedFloating);
  if (eligibility && !canBookFixed) {
    setStatus(
      (eligibility?.reasonFixed || `Fixed seats not allowed on ${date}.`) +
        (canBookFloating ? " Floating seats are still available." : "")
    );
  }

  seats.forEach((seat) => {
    const btn = document.createElement("button");
    btn.innerText = String(seat.id);
    btn.className =
      "w-10 h-10 rounded-lg text-xs font-bold transition-transform hover:scale-105 disabled:opacity-60";
    
    const isFloating = seat.type === "floating" || (Number(seat.id) >= 41 && Number(seat.id) <= 50);

    if (seat.booked) {
      btn.style.backgroundColor = "#ba1a1a";
      btn.style.color = "#ffffff";
      btn.disabled = true;
    } else {
      btn.style.backgroundColor = isFloating ? "#002a4c" : "#0a6c44";
      btn.style.color = "#ffffff";
      const canBookThisSeat = isFloating ? canBookFloating : canBookFixed;
      if (!eligibility || !canBookThisSeat) {
        btn.disabled = true;
        btn.style.backgroundColor = "#e0e3e5";
        btn.style.color = "#444650";
      } else {
        btn.onclick = () => {
          console.log("clicked seat", seat.id);
          bookSeat(seat.id);
        };
      }
    }

    container.appendChild(btn);
  });
  if (!eligibility || canBook) setStatus(`Showing availability for ${date}.`);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadRecentBookings() {
  const list = document.getElementById("recentBookingsList");
  if (!list) return;

  list.innerHTML = '<p class="text-xs text-on-surface-variant font-semibold">Loading…</p>';
  const res = await fetch(`${API_URL}/bookings/recent?limit=10`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    list.innerHTML = `<p class="text-xs text-error font-semibold">${escapeHtml(
      data?.error || `Request failed (${res.status})`
    )}</p>`;
    return;
  }

  const rows = Array.isArray(data.bookings) ? data.bookings : [];
  if (rows.length === 0) {
    list.innerHTML = '<p class="text-xs text-on-surface-variant font-semibold">No bookings yet.</p>';
    return;
  }

  list.innerHTML = rows
    .map((b) => {
      const seatType = b.seatId >= 41 ? "Floating" : "Fixed";
      const badgeBg = b.seatId >= 41 ? "bg-tertiary-container text-on-tertiary-container" : "bg-secondary-container text-on-secondary-container";
      return `<div class="flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl group hover:scale-[1.01] transition-transform">
  <div class="w-12 h-12 rounded-lg bg-surface-container-high flex flex-col items-center justify-center flex-shrink-0">
    <span class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Seat</span>
    <span class="text-lg font-extrabold text-primary">${escapeHtml(b.seatId)}</span>
  </div>
  <div class="flex-1">
    <p class="font-bold text-primary">${escapeHtml(b.userName)}</p>
    <p class="text-xs text-on-surface-variant">${escapeHtml(b.date)}</p>
  </div>
  <div class="text-right mr-2">
    <span class="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${badgeBg}">${seatType}</span>
  </div>
  <span class="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
</div>`;
    })
    .join("");
}

async function loadWeekBookings() {
  const date = getSelectedDate();
  const res = await fetch(`${API_URL}/bookings/week?date=${encodeURIComponent(date)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

  const container = document.getElementById("weekBookings");
  if (!container) return;

  const rows = Array.isArray(data.bookings) ? data.bookings : [];
  if (rows.length === 0) {
    container.innerHTML = `<p class="text-xs text-on-surface-variant font-semibold">No bookings for ${escapeHtml(
      data.start
    )} → ${escapeHtml(data.end)}.</p>`;
    return;
  }

  const list = rows
    .map((b) => {
      const seatType = b.seatId >= 41 ? "Floating" : "Fixed";
      return `<div class="flex items-center justify-between py-2 text-xs">
  <div class="font-semibold text-primary">${escapeHtml(b.date)}</div>
  <div class="text-on-surface-variant">Seat <span class="font-bold text-primary">${escapeHtml(
    b.seatId
  )}</span> • ${seatType}</div>
  <div class="font-bold text-primary">${escapeHtml(b.userName)}</div>
</div>`;
    })
    .join("");

  container.innerHTML = `<div class="flex items-center justify-between mb-3">
  <p class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">This week (${escapeHtml(
    data.start
  )} → ${escapeHtml(data.end)})</p>
</div>
<div class="divide-y divide-outline-variant/20">${list}</div>`;
}

// Book seat
async function bookSeat(seatId) {
  try {
    const userName = getUserName();
    if (!userName) {
      alert("Please login first.");
      showAuth(true);
      return;
    }
    setStatus(`Booking seat ${seatId}…`);
    const res = await fetch(`${API_URL}/book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify({
        seatId,
        date: getSelectedDate(),
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error ?? `Request failed (${res.status})`;
      alert(msg);
      setStatus(msg);
      return;
    }

    alert(`Booked seat ${seatId} for ${data?.booking?.date ?? getSelectedDate()}`);
    await loadSeats(); // refresh
    await loadDashboardStats();
    await renderScheduleCard();
    await loadRecentBookings();
  } catch (err) {
    showError("Booking failed", err);
  }
}

function showAuth(show) {
  const authView = document.getElementById("authView");
  const appView = document.getElementById("appView");
  if (authView) authView.classList.toggle("hidden", !show);
  if (appView) appView.classList.toggle("hidden", show);
}

function setAuthMode(mode) {
  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const submit = document.getElementById("authSubmit");
  const toggleText = document.getElementById("authToggleText");
  const toggleBtn = document.getElementById("authToggleBtn");
  const err = document.getElementById("authError");

  if (err) err.textContent = "";

  if (mode === "signup") {
    document.getElementById("signupFields")?.classList.remove("hidden");
    if (title) title.textContent = "Sign Up";
    if (subtitle) subtitle.textContent = "Create an account to book seats.";
    if (submit) submit.textContent = "Create account";
    if (toggleText) toggleText.textContent = "Already have an account?";
    if (toggleBtn) toggleBtn.textContent = "Login";
  } else {
    document.getElementById("signupFields")?.classList.add("hidden");
    if (title) title.textContent = "Login";
    if (subtitle) subtitle.textContent = "Sign in to book seats.";
    if (submit) submit.textContent = "Login";
    if (toggleText) toggleText.textContent = "New here?";
    if (toggleBtn) toggleBtn.textContent = "Create an account";
  }

  document.getElementById("authForm")?.setAttribute("data-mode", mode);
}

document.addEventListener("DOMContentLoaded", () => {
  // Left navigation scroll targets
  const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("navDashboard")?.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToId("dashboardSection");
  });
  document.getElementById("navSeatMap")?.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToId("seatMapSection");
  });
  document.getElementById("navSchedule")?.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToId("scheduleSection");
  });
  document.getElementById("navAnalytics")?.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToId("analyticsSection");
  });

  const datePicker = document.getElementById("datePicker");
  if (datePicker && !datePicker.value) datePicker.value = todayKey();
  datePicker?.addEventListener("change", async () => {
    try {
      await loadSeats();
      await loadDashboardStats();
      await renderScheduleCard();
      await loadRecentBookings();
      const week = document.getElementById("weekBookings");
      if (week && !week.classList.contains("hidden")) await loadWeekBookings();
      renderEligibilityCalendar();
    } catch (err) {
      showError("Failed to refresh", err);
    }
  });

  // Calendar month navigation
  let calendarMonthOffset = 0;
  const shiftCalendarMonth = (delta) => {
    calendarMonthOffset += delta;
    const selected = getSelectedDate();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selected);
    const base = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date();
    const view = new Date(base.getFullYear(), base.getMonth() + calendarMonthOffset, 1);
    const key = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}-01`;
    const dp = document.getElementById("datePicker");
    if (dp) dp.value = key;
    renderEligibilityCalendar();
    loadSeats().catch(() => {});
    loadDashboardStats().catch(() => {});
    renderScheduleCard().catch(() => {});
  };

  document.getElementById("calPrev")?.addEventListener("click", () => shiftCalendarMonth(-1));
  document.getElementById("calNext")?.addEventListener("click", () => shiftCalendarMonth(1));

  const viewWeekBookingsBtn = document.getElementById("viewWeekBookingsBtn");
  viewWeekBookingsBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    const container = document.getElementById("weekBookings");
    if (!container) return;
    container.classList.toggle("hidden");
    if (!container.classList.contains("hidden")) {
      try {
        container.innerHTML =
          '<p class="text-xs text-on-surface-variant font-semibold">Loading weekly bookings…</p>';
        await loadWeekBookings();
      } catch (err) {
        container.innerHTML = "";
        showError("Failed to load weekly bookings", err);
      }
    }
  });

  const leaveBtn = document.getElementById("leaveBtn");
  leaveBtn?.addEventListener("click", async () => {
    const userName = getUserName();
    if (!userName) {
      alert("Please login first.");
      showAuth(true);
      return;
    }
    const date = getSelectedDate();
    try {
      const res = await fetch(`${API_URL}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ date }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || `Request failed (${res.status})`);
        return;
      }
      alert(data.removed ? "Leave marked. Booking removed." : "Leave marked. No booking found for that date.");
      await loadSeats();
      await loadDashboardStats();
      await renderScheduleCard();
      await loadRecentBookings();
      const week = document.getElementById("weekBookings");
      if (week && !week.classList.contains("hidden")) await loadWeekBookings();
    } catch (err) {
      showError("Failed to mark leave", err);
    }
  });

  // Auth wiring
  const authForm = document.getElementById("authForm");
  const toggleBtn = document.getElementById("authToggleBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  setAuthMode("login");

  toggleBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const mode = authForm?.getAttribute("data-mode") === "signup" ? "login" : "signup";
    setAuthMode(mode);
  });

  authForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mode = authForm.getAttribute("data-mode") || "login";
    const userName = document.getElementById("authUserName")?.value || "";
    const password = document.getElementById("authPassword")?.value || "";
    const squad = Number(document.getElementById("authSquad")?.value || "");
    const batch = document.getElementById("authBatch")?.value || "A";
    const err = document.getElementById("authError");
    if (err) err.textContent = "";

    try {
      const res = await fetch(`${API_URL}/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup" ? { userName, password, squad, batch } : { userName, password }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (err) err.textContent = data?.error || `Request failed (${res.status})`;
        return;
      }
      setAuth({ token: data.token, userName: data.userName, squad: data.squad, batch: data.batch });
      showAuth(false);
      await loadSeats();
      await loadDashboardStats();
      await renderScheduleCard();
      await loadRecentBookings();
    } catch (ex) {
      if (err) err.textContent = ex instanceof Error ? ex.message : String(ex);
    }
  });

  logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/auth/logout`, { method: "POST", headers: { ...authHeader() } });
    } catch {
      // ignore
    }
    setAuth(null);
    showAuth(true);
    await loadDashboardStats();
    await renderScheduleCard();
    await loadRecentBookings();
  });

  const bookSeatBtn = document.getElementById("bookSeatBtn");
  if (bookSeatBtn) {
    bookSeatBtn.addEventListener("click", () => {
      document.getElementById("seats")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const isLoggedIn = Boolean(getUserName());
  showAuth(!isLoggedIn);
  loadDashboardStats().catch((err) => showError("Failed to load stats", err));
  renderScheduleCard().catch(() => {});
  loadRecentBookings().catch(() => {});
  if (isLoggedIn) {
    loadSeats().catch((err) => showError("Failed to load seats", err));
    renderEligibilityCalendar();
  }
});