(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const form = $("#admin-form");
  const status = $("#admin-status");
  const app = $("#admin-app");
  let adminKey = "";
  let me = null; // { role, name } once signed in

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = kind ? `form-status ${kind}` : "form-status";
  }

  function number(n) {
    return n >= 10000
      ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n)
      : n.toLocaleString();
  }

  function plural(n, word) {
    return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
  }

  function when(iso) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  // Calls an API with the admin key. Throws an Error with the server's message on failure.
  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(path, {
      method,
      headers: { "x-admin-key": adminKey, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const out = await res.json().catch(() => ({}));
    if (res.status === 401 && me) {
      const message = "Your admin key stopped working. It may have been revoked.";
      signOut(message);
      throw new Error(message);
    }
    if (!res.ok) throw new Error(out.error || "Something went wrong.");
    return out;
  }

  function deleteButton(label, onClick) {
    const button = make("button", "btn btn-ghost btn-sm admin-delete", label);
    button.type = "button";
    button.addEventListener("click", () => onClick(button));
    return button;
  }

  // Shared delete flow: confirm, call the API, remove the row.
  async function removeRow({ question, path, row, button, done }) {
    if (!confirm(question)) return;
    button.disabled = true;
    try {
      await api(path, { method: "DELETE" });
      row.remove();
      setStatus(done, "ok");
    } catch (err) {
      button.disabled = false;
      setStatus(err.message, "err");
    }
  }

  /* ---------- Sign in / out ---------- */
  try { adminKey = sessionStorage.getItem("bifdma-admin-key") || ""; } catch { /* storage blocked */ }
  form.elements.key.value = adminKey;

  async function signIn() {
    setStatus("Signing in…");
    try {
      me = await api("/api/admin?action=whoami");
    } catch (err) {
      me = null;
      setStatus(err instanceof TypeError ? "Couldn't reach the server. Is the site deployed on Vercel?" : err.message, "err");
      return;
    }
    try { sessionStorage.setItem("bifdma-admin-key", adminKey); } catch { /* storage blocked */ }
    form.hidden = true;
    $("#admin-me").hidden = false;
    $("#admin-name").textContent = me.name;
    $("#admin-role").textContent = me.role === "owner" ? "Owner" : "Admin";
    $("#tab-admins").hidden = me.role !== "owner";
    app.hidden = false;
    setStatus("");
    selectTab("tab-stats");
  }

  function signOut(message) {
    me = null;
    adminKey = "";
    try { sessionStorage.removeItem("bifdma-admin-key"); } catch { /* storage blocked */ }
    form.elements.key.value = "";
    form.hidden = false;
    $("#admin-me").hidden = true;
    app.hidden = true;
    setStatus(message || "Signed out.", message ? "err" : "ok");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    adminKey = form.elements.key.value.trim();
    if (adminKey) signIn();
  });
  $("#sign-out").addEventListener("click", () => signOut());

  /* ---------- Tabs ---------- */
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const loaders = {
    "tab-stats": loadStats,
    "tab-feedback": loadFeedback,
    "tab-clips": loadClips,
    "tab-reviews": loadReviews,
    "tab-board": loadBoard,
    "tab-admins": loadAdmins,
  };

  function selectTab(id) {
    hideTooltip();
    for (const tab of tabs) {
      const selected = tab.id === id;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $(`#${tab.getAttribute("aria-controls")}`).hidden = !selected;
    }
    loaders[id]();
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab.id));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const visible = tabs.filter((t) => !t.hidden);
      const next = visible[(visible.indexOf(tab) + (e.key === "ArrowRight" ? 1 : -1) + visible.length) % visible.length];
      next.focus();
      selectTab(next.id);
    });
  });

  /* ---------- Stats ---------- */
  function tiles(container, items) {
    container.replaceChildren(...items.map(([label, value, note]) => {
      const tile = make("div", "stat-tile");
      tile.append(make("span", "stat-label", label), make("strong", "stat-value", value));
      if (note) tile.append(make("span", "stat-note", note));
      return tile;
    }));
  }

  let lastStats = null;

  async function loadStats() {
    try {
      const s = await api("/api/admin?action=stats");
      lastStats = s;
      tiles($("#tiles-traffic"), [
        ["Visitors today", number(s.visitors.today), "Unique people, counted once per day"],
        ["Page views today", number(s.views.today)],
        ["Page views, last 7 days", number(s.views.week)],
        ["Page views, all time", number(s.views.total)],
      ]);
      tiles($("#tiles-jokes"), [
        ["Tried to buy a DMA", number(s.buyAttempts), "Pressed a Buy button and hit “out of stock”"],
        ["Tip button presses", number(s.tipClicks || 0), "Opened PayPal to tip bif"],
        ["Bartholomew zaps", number(s.zaps)],
        ["Reviews on the wall", number(s.reviews)],
      ]);
      tiles($("#tiles-community"), [
        ["Leaderboard players", number(s.players)],
        ["Reds found by players", number(s.redsFound)],
        ["Top player", s.topPlayer ? s.topPlayer.name : "Nobody yet", s.topPlayer ? `${number(s.topPlayer.reds)} reds` : ""],
        ["Suggestions waiting", number(s.feedback)],
        ["Clips", number(s.clips)],
        ["Admins", number(s.admins), "Including the owner"],
      ]);
      renderChart(s.byDay);
    } catch (err) {
      setStatus(err.message, "err");
    }
  }
  $("#stats-refresh").addEventListener("click", loadStats);

  /* Page views per day: one series, so one colour and no legend (the title names it). */
  const tooltip = $("#chart-tooltip");

  // Smallest whole-number step of 1, 2 or 5 × 10ⁿ that is at least `value`, so ticks stay clean.
  function niceStep(value) {
    if (value <= 1) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    for (const step of [1, 2, 5, 10]) {
      if (step * power >= value) return step * power;
    }
    return 10 * power;
  }

  function dayLabel(day, style) {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { timeZone: "UTC", ...style });
  }

  function svg(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  // A column with a 4px rounded top and a square base.
  function columnPath(x, y, w, h) {
    const r = Math.min(4, h, w / 2);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  function renderChart(byDay) {
    // Drawn at the card's real width (not stretched), so text stays the same size on any screen.
    const W = Math.max(300, $("#chart-body").clientWidth || 640);
    const H = 240;
    const pad = { top: 22, right: 8, bottom: 30, left: 44 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;
    // About four clean ticks, with the top one just above the busiest day.
    const busiest = Math.max(...byDay.map((d) => d.views));
    const step = niceStep(busiest / 4);
    const max = Math.max(step * 2, Math.ceil(busiest / step) * step);
    const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
    const band = plotW / byDay.length;
    const barW = Math.min(24, band * 0.6);
    const y = (v) => pad.top + plotH - (v / max) * plotH;

    const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "chart-svg", role: "img", "aria-label": "Page views per day for the last 7 days" });

    for (const tick of ticks) {
      chart.append(svg("line", { x1: pad.left, x2: W - pad.right, y1: y(tick), y2: y(tick), class: "chart-grid" }));
      const label = svg("text", { x: pad.left - 8, y: y(tick) + 4, class: "chart-tick", "text-anchor": "end" });
      label.textContent = tick.toLocaleString();
      chart.append(label);
    }

    byDay.forEach((d, i) => {
      const cx = pad.left + band * i + band / 2;
      const top = y(d.views);
      const g = svg("g", { class: "chart-bar", tabindex: "0", role: "img", "aria-label": `${dayLabel(d.day, { weekday: "long", day: "numeric", month: "short" })}: ${plural(d.views, "page view")}, ${plural(d.visitors, "visitor")}` });
      // Hit area: the whole column band, much bigger than the bar itself.
      g.append(svg("rect", { x: pad.left + band * i, y: pad.top, width: band, height: plotH, class: "chart-hit" }));
      if (d.views > 0) g.append(svg("path", { d: columnPath(cx - barW / 2, top, barW, pad.top + plotH - top), class: "chart-col" }));
      const tick = svg("text", { x: cx, y: H - 10, class: "chart-tick", "text-anchor": "middle" });
      tick.textContent = i === byDay.length - 1 ? "Today" : dayLabel(d.day, { weekday: "short" });
      g.append(tick);
      // Only today's value is printed on the chart; the rest are in the tooltip and table.
      if (i === byDay.length - 1) {
        const value = svg("text", { x: cx, y: top - 6, class: "chart-value", "text-anchor": "middle" });
        value.textContent = d.views.toLocaleString();
        g.append(value);
      }
      const show = () => showTooltip(g, d);
      g.addEventListener("pointerenter", show);
      g.addEventListener("focus", show);
      g.addEventListener("pointerleave", hideTooltip);
      g.addEventListener("blur", hideTooltip);
      chart.append(g);
    });
    $("#chart-body").replaceChildren(chart);

    const table = make("table", "stats-table");
    const head = make("tr");
    head.append(make("th", "", "Day"), make("th", "", "Page views"), make("th", "", "Visitors"));
    table.append(head, ...byDay.map((d) => {
      const row = make("tr");
      row.append(make("td", "", dayLabel(d.day, { weekday: "short", day: "numeric", month: "short" })), make("td", "", d.views.toLocaleString()), make("td", "", d.visitors.toLocaleString()));
      return row;
    }));
    $("#chart-table").replaceChildren(table);
  }

  function showTooltip(bar, d) {
    tooltip.replaceChildren(
      make("strong", "", plural(d.views, "page view")),
      make("span", "", plural(d.visitors, "visitor")),
      make("span", "tip-day", dayLabel(d.day, { weekday: "long", day: "numeric", month: "short" })),
    );
    tooltip.hidden = false;
    const box = bar.getBoundingClientRect();
    const tip = tooltip.getBoundingClientRect();
    const left = Math.min(Math.max(8, box.left + box.width / 2 - tip.width / 2), innerWidth - tip.width - 8);
    tooltip.style.left = `${left + scrollX}px`;
    tooltip.style.top = `${box.top + scrollY + 8}px`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  // Redraw at the new width when the window is resized.
  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (lastStats && !$("#chart-body").hidden) renderChart(lastStats.byDay); }, 150);
  });

  $("#chart-toggle").addEventListener("click", (e) => {
    const showTable = e.currentTarget.getAttribute("aria-pressed") !== "true";
    e.currentTarget.setAttribute("aria-pressed", String(showTable));
    e.currentTarget.textContent = showTable ? "Show chart" : "Show table";
    $("#chart-table").hidden = !showTable;
    $("#chart-body").hidden = showTable;
    if (!showTable && lastStats) renderChart(lastStats.byDay);
  });

  /* ---------- Suggestions ---------- */
  async function loadFeedback() {
    const list = $("#feedback-list");
    try {
      const { feedback } = await api("/api/feedback");
      if (!feedback.length) {
        list.replaceChildren(make("p", "wall-empty", "No suggestions yet."));
        return;
      }
      list.replaceChildren(...feedback.map((f) => {
        const item = make("article", "wall-item admin-item");
        const meta = make("div", "wall-meta");
        meta.append(make("span", "wall-name", f.name), make("span", "wall-when", when(f.at)));
        item.append(meta, make("p", "wall-text", f.text), deleteButton("Delete", (button) => removeRow({
          question: `Delete this suggestion from ${f.name}?`,
          path: `/api/feedback?id=${encodeURIComponent(f.id)}`,
          row: item, button, done: "Suggestion deleted.",
        })));
        return item;
      }));
    } catch (err) {
      setStatus(err.message, "err");
    }
  }

  /* ---------- Clips ---------- */
  async function loadClips() {
    const list = $("#clip-list");
    try {
      const res = await fetch(`/api/clips?fresh=${Date.now()}`);
      const { clips } = await res.json();
      if (!clips.length) {
        list.replaceChildren(make("p", "wall-empty", "No clips yet. Add one above."));
        return;
      }
      list.replaceChildren(...clips.map((c) => {
        const item = make("article", "wall-item admin-item");
        const meta = make("div", "wall-meta");
        meta.append(make("span", "wall-name", c.source === "twitch" ? "Twitch clip" : "YouTube"), make("span", "wall-when", when(c.at)));
        const link = make("a", "clip-link", c.source === "twitch" ? `clips.twitch.tv/${c.videoId}` : `youtu.be/${c.videoId}`);
        link.href = c.source === "twitch" ? `https://clips.twitch.tv/${encodeURIComponent(c.videoId)}` : `https://youtu.be/${encodeURIComponent(c.videoId)}`;
        link.target = "_blank";
        link.rel = "noopener";
        item.append(meta, make("p", "wall-text", c.title), link, deleteButton("Delete", (button) => removeRow({
          question: `Remove the clip "${c.title}" from the site?`,
          path: `/api/clips?id=${encodeURIComponent(c.id)}`,
          row: item, button, done: "Clip removed. It can take up to 15 seconds to disappear from the site.",
        })));
        return item;
      }));
    } catch {
      setStatus("Couldn't load clips.", "err");
    }
  }

  $("#clip-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const clipForm = e.currentTarget;
    const button = clipForm.querySelector("button");
    button.disabled = true;
    try {
      await api("/api/clips", { method: "POST", body: { url: clipForm.elements.url.value, title: clipForm.elements.title.value } });
      clipForm.reset();
      setStatus("Clip added. It shows on the site within 15 seconds.", "ok");
      loadClips();
    } catch (err) {
      setStatus(err.message, "err");
    } finally {
      button.disabled = false;
    }
  });

  /* ---------- Reviews ---------- */
  async function loadReviews() {
    const list = $("#review-list");
    try {
      const res = await fetch(`/api/reviews?limit=200&fresh=${Date.now()}`);
      const { reviews } = await res.json();
      if (!reviews.length) {
        list.replaceChildren(make("p", "wall-empty", "No reviews on the wall."));
        return;
      }
      list.replaceChildren(...reviews.map((review) => {
        const item = make("article", "wall-item admin-item");
        const meta = make("div", "wall-meta");
        const stars = make("span", "wall-stars", "★".repeat(review.stars));
        stars.append(make("span", "dim", "★".repeat(5 - review.stars)));
        meta.append(stars, make("span", "wall-when", when(review.at)));
        item.append(meta, make("p", "wall-text", review.text), make("p", "wall-name", `— ${review.name}`), deleteButton("Delete", (button) => removeRow({
          question: `Delete this review by ${review.name}?\n\n"${review.text}"`,
          path: `/api/reviews?id=${encodeURIComponent(review.id)}`,
          row: item, button, done: "Review deleted. It can take up to 15 seconds to disappear for everyone.",
        })));
        return item;
      }));
    } catch {
      setStatus("Couldn't load reviews.", "err");
    }
  }

  /* ---------- Leaderboard ---------- */
  async function loadBoard() {
    const list = $("#board-list");
    try {
      const res = await fetch(`/api/safe?limit=50&fresh=${Date.now()}`);
      const { players } = await res.json();
      if (!players.length) {
        list.replaceChildren(make("li", "board-empty", "Nobody on the leaderboard."));
        return;
      }
      list.replaceChildren(...players.map((p) => {
        const row = make("li", "board-row admin-board-row");
        row.append(
          make("span", "board-rank", `#${p.rank}`),
          make("span", "board-name", p.name),
          make("span", "board-reds", p.reds.toLocaleString()),
          deleteButton("Remove", (button) => removeRow({
            question: `Remove ${p.name} from the leaderboard? Their name becomes free for anyone to take.`,
            path: `/api/safe?name=${encodeURIComponent(p.name)}`,
            row, button, done: `Removed ${p.name}.`,
          })),
        );
        return row;
      }));
    } catch {
      setStatus("Couldn't load the leaderboard.", "err");
    }
  }

  /* ---------- Admins (owner only) ---------- */
  async function loadAdmins() {
    const list = $("#admin-list");
    try {
      const { admins } = await api("/api/admin?action=admins");
      const owner = make("li", "admin-person");
      owner.append(make("span", "board-name", "Owner (you)"), make("span", "role-badge", "Owner"));
      list.replaceChildren(owner, ...admins.map((a) => {
        const row = make("li", "admin-person");
        row.append(
          make("span", "board-name", a.name),
          make("span", "wall-when", `Added ${when(a.createdAt)}`),
          deleteButton("Revoke", (button) => removeRow({
            question: `Revoke ${a.name}'s admin access? Their key stops working straight away.`,
            path: `/api/admin?id=${encodeURIComponent(a.id)}`,
            row, button, done: `${a.name} is no longer an admin.`,
          })),
        );
        return row;
      }));
    } catch (err) {
      setStatus(err.message, "err");
    }
  }

  $("#add-admin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const addForm = e.currentTarget;
    const button = addForm.querySelector("button");
    button.disabled = true;
    try {
      const out = await api("/api/admin", { method: "POST", body: { action: "create-admin", name: addForm.elements.name.value } });
      addForm.reset();
      $("#new-key-name").textContent = out.admin.name;
      $("#new-key-value").textContent = out.key;
      $("#new-key").hidden = false;
      setStatus(`${out.admin.name} is now an admin.`, "ok");
      loadAdmins();
    } catch (err) {
      setStatus(err.message, "err");
    } finally {
      button.disabled = false;
    }
  });

  $("#copy-key").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText($("#new-key-value").textContent);
      e.currentTarget.textContent = "Copied";
    } catch {
      e.currentTarget.textContent = "Select and copy it";
    }
  });

  if (adminKey) signIn();
})();
