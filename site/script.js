(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const pick = (arr, not) => {
    if (arr.length < 2) return arr[0];
    let item;
    do { item = arr[Math.floor(Math.random() * arr.length)]; } while (item === not);
    return item;
  };

  /* ---------- Mobile menu ---------- */
  const nav = $(".nav");
  const navToggle = $(".nav-toggle");

  function setMenu(open) {
    nav.classList.toggle("open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  navToggle.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
  nav.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) setMenu(false);
  });

  /* ---------- Footer year ---------- */
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Raid clock in the fake HUD ---------- */
  const clock = $("#raid-clock");
  const start = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    clock.textContent = `${mm}:${ss}`;
  }, 1000);

  /* ---------- Auto-Excuse Engine ---------- */
  const excuses = [
    "I heard his footsteps. On the other side of the map.",
    "That's just crosshair placement, bro.",
    "I have 5,000 hours. It's called game sense.",
    "He was peeking wide. Through the wall. Wide.",
    "It's the gaming chair.",
    "I saw a pixel move. One single pixel.",
    "My headset is really, really good.",
    "Everyone holds that angle. Everyone knows that.",
    "I wasn't pre-firing, I was checking if my gun works.",
    "I check that spot every raid. (First time on this map.)",
    "Chat, I have a monitor. That's how I saw him.",
    "I just have fast reactions. I drink a lot of water.",
    "Lucky spray. Lucky spray. Lucky spray. Lucky spray.",
    "I read his mind. He was thinking about loot.",
    "Stream delay makes it look sus. On my screen it was normal.",
    "That's not tracking through smoke, I could hear him breathing.",
    "My teammate called it out. (I play solo.)",
    "I've played shooters since I was 3. My first word was 'prefire.'",
    "That red just… called out to me.",
    "Bernard always sits there. Everybody knows Bernard sits there.",
    "I've run Forbidden TV 3,000 times, chat. I know where everyone stands.",
    "Reds just spawn like that in Forbidden TV. Look it up.",
    "It's Forbidden. Everyone's cracked in Forbidden.",
    "I heard Kurt on the floor below. TV Station has thin floors.",
    "Other maps? Never heard of them.",
    "It's not cheats, chat. It's Nova's Secret Sauce.",
    "Every safe has a red in it if you believe hard enough.",
    "I spent all my Koen on audio upgrades.",
    "ACE would've caught it if it was cheats. Checkmate.",
    "Bartholomew told me where he was. Then he zapped me.",
    "That second monitor is for Spotify, chat. Stop asking.",
    "Sound in this game is actually really good if you know how to listen.",
    "I just had a feeling. Gamer intuition.",
  ];
  const chatLines = [
    "“?????? how did he know”",
    "“bro is walling 💀”",
    "“CLIP IT”",
    "“he pre-fired through a MOUNTAIN”",
    "“mods check his pc”",
    "“is he cheating?”",
    "“how did you see him???”",
    "“report”",
    "“ACE where are you”",
    "“he knew Bernard was there before Bernard did”",
  ];

  const excuseEl = $("#excuse");
  const chatEl = $("#chat-q");
  const countEl = $("#excuse-count");
  let used = 0;

  $("#excuse-btn").addEventListener("click", () => {
    excuseEl.textContent = `“${pick(excuses, excuseEl.textContent.slice(1, -1))}”`;
    chatEl.textContent = pick(chatLines, chatEl.textContent);
    excuseEl.classList.remove("flash");
    void excuseEl.offsetWidth; // restart animation
    excuseEl.classList.add("flash");
    countEl.textContent = (++used).toLocaleString();
  });

  /* ---------- Chat reviews (real ones, via /api/reviews) ---------- */
  const wall = $("#review-wall");
  const reviewForm = $("#review-form");
  const reviewStatus = $("#review-status");
  const reviewText = reviewForm.elements.text;
  const charCount = $("#char-count");
  let wallReviews = [];

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function timeAgo(iso) {
    const secs = Math.max(0, (Date.now() - new Date(iso)) / 1000);
    const units = [["y", 31536000], ["d", 86400], ["h", 3600], ["m", 60]];
    for (const [unit, size] of units) {
      if (secs >= size) return `${Math.floor(secs / size)}${unit} ago`;
    }
    return "just now";
  }

  function renderWall(newId) {
    if (!wallReviews.length) {
      wall.replaceChildren(make("p", "wall-empty", "No reviews yet. Be the first to get zapped."));
      return;
    }
    wall.replaceChildren(...wallReviews.map((review) => {
      const item = make("article", review.id === newId ? "wall-item is-new" : "wall-item");
      const meta = make("div", "wall-meta");
      const stars = make("span", "wall-stars", "★".repeat(review.stars));
      stars.setAttribute("aria-label", `${review.stars} out of 5 stars`);
      stars.append(make("span", "dim", "★".repeat(5 - review.stars)));
      const when = make("time", "wall-when", timeAgo(review.at));
      when.dateTime = review.at;
      meta.append(stars, when);
      item.append(meta, make("p", "wall-text", review.text), make("p", "wall-name", `— ${review.name}`));
      return item;
    }));
  }

  function setReviewStatus(message, kind) {
    reviewStatus.textContent = message;
    reviewStatus.className = kind ? `form-status ${kind}` : "form-status";
  }

  async function loadWall() {
    try {
      const res = await fetch("/api/reviews");
      if (!res.ok) throw new Error(res.status);
      wallReviews = (await res.json()).reviews;
      renderWall();
    } catch {
      wall.replaceChildren(make("p", "wall-empty", "Couldn't load reviews right now. ACE is probably looking at them."));
    }
  }

  reviewText.addEventListener("input", () => { charCount.textContent = reviewText.value.length; });

  // Only 5 stars allowed: picking fewer pops up a joke and puts it back to 5.
  const ratingModal = $("#rating-modal");
  const fiveStars = $("#star5");
  const ratingJokes = {
    1: ["1 star? Bold.", "Bartholomew has been notified. He's on his way. He's gonna zap you."],
    2: ["2 stars detected.", "The Auto-Excuse Engine reviewed your rating and says it was lag."],
    3: ["3 stars? That's a Lockdown rating.", "This is a Forbidden website."],
    4: ["4 stars? So close.", "Nova added the missing star with a dash of Secret Sauce."],
  };

  function closeRatingModal() {
    ratingModal.hidden = true;
    document.body.style.overflow = "";
    fiveStars.focus();
  }

  reviewForm.querySelectorAll('input[name="stars"]').forEach((input) => {
    input.addEventListener("change", () => {
      const stars = Number(input.value);
      if (stars === 5) return;
      const [title, body] = ratingJokes[stars];
      $("#rating-title").textContent = title;
      $("#rating-body").textContent = body;
      fiveStars.checked = true;
      ratingModal.hidden = false;
      document.body.style.overflow = "hidden";
      ratingModal.querySelector(".modal-card .btn").focus();
    });
  });
  ratingModal.querySelectorAll("[data-close-rating]").forEach((el) => el.addEventListener("click", closeRatingModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !ratingModal.hidden) closeRatingModal();
  });

  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(reviewForm));
    data.stars = Number(data.stars);
    if (reviewText.value.trim().length < 3) {
      setReviewStatus("Write at least a few words.", "err");
      reviewText.focus();
      return;
    }
    const button = reviewForm.querySelector("button[type=submit]");
    button.disabled = true;
    setReviewStatus("Posting…");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Couldn't post that. Try again in a bit.");
      if (out.review) {
        wallReviews = [out.review, ...wallReviews.filter((r) => r.id !== out.review.id)];
        renderWall(out.review.id);
      }
      reviewForm.reset();
      charCount.textContent = "0";
      setReviewStatus("Posted. Thanks for your totally honest review.", "ok");
    } catch (err) {
      setReviewStatus(err instanceof TypeError ? "Couldn't reach the review server. Try again in a bit." : err.message, "err");
    } finally {
      button.disabled = false;
    }
  });

  loadWall();

  /* ---------- Nova's Safe Simulator ---------- */
  const safeBtn = $("#safe-btn");
  const safeStage = $("#safe-stage");
  const safeDial = safeBtn.querySelector(".safe-dial");
  const safeAlert = $("#safe-alert");
  const safeLoot = $("#safe-loot");
  const safeMsg = $("#safe-msg");
  const SAFE_KEY = "bifdma-safe";
  const PURPLE_CHANCE = 1 / 1000;
  const redNames = [
    "A red",
    "Another red",
    "Red (sauced)",
    "Suspiciously convenient red",
    "Red, again",
    "Red with extra sauce",
    "Red (Nova approved)",
    "A red that wasn't there a second ago",
  ];
  const purpleNames = [
    "A purple. Somehow.",
    "Purple (unsauced)",
    "A purple that should've been a red",
    "Slightly disappointing purple",
    "Mid-tier something",
  ];
  const safeLines = [
    "Red. Obviously.",
    "Red again. The sauce never misses.",
    "It's always red.",
    "Another one for the Trophy Room.",
    "Chat is typing “is he cheating?”",
    "Safe opened. Red inside. As expected.",
  ];
  const milestones = {
    1: "Your first red. It won't be your last.",
    10: "10 reds. Your Trophy Room is getting crowded.",
    50: "50 reds. The Market is starting to ask questions.",
    100: "100 reds. bif's chat has started clipping you.",
    500: "500 reds. Red prices have crashed. Thanks, Nova.",
    1000: "1,000 reds. ACE is watching. ACE is also clicking.",
    5000: "5,000 reds. There aren't that many safes in TV Station. Keep going.",
    10000: "10,000 reds. Nova is proud of you.",
  };

  const safe = { opened: 0, reds: 0, purples: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(SAFE_KEY)) || {};
    // The rare drop used to be a white item; older saves call it "whites".
    Object.assign(safe, { opened: saved.opened, reds: saved.reds, purples: saved.purples ?? saved.whites });
  } catch { /* storage blocked */ }
  for (const key of Object.keys(safe)) {
    if (!Number.isSafeInteger(safe[key]) || safe[key] < 0) safe[key] = 0;
  }
  let dialTurn = 0;
  let alertTimer;

  function renderSafe() {
    $("#safe-reds").textContent = safe.reds.toLocaleString();
    $("#safe-opened").textContent = safe.opened.toLocaleString();
    $("#safe-purples").textContent = safe.purples.toLocaleString();
    $("#safe-rate").textContent = safe.purples ? `${((safe.reds / safe.opened) * 100).toFixed(2)}%` : "100%";
  }

  function saveSafe() {
    try { localStorage.setItem(SAFE_KEY, JSON.stringify(safe)); } catch { /* storage blocked */ }
  }

  function setLoot(tier, name, isPurple) {
    safeLoot.classList.toggle("is-purple", isPurple);
    safeLoot.querySelector(".loot-tier").textContent = tier;
    safeLoot.querySelector(".loot-name").textContent = name;
  }

  function floatLoot(text, isPurple) {
    // Without animation the "+1 RED" bits would just pile up on the safe.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bit = make("span", isPurple ? "float-loot purple" : "float-loot", text);
    bit.style.left = `calc(50% + ${Math.round(Math.random() * 120 - 60)}px)`;
    safeStage.append(bit);
    setTimeout(() => bit.remove(), 1000);
  }

  safeBtn.addEventListener("click", () => {
    safe.opened += 1;
    const isPurple = Math.random() < PURPLE_CHANCE;
    if (isPurple) {
      safe.purples += 1;
      setLoot("PURPLE", pick(purpleNames), true);
      floatLoot("+1 PURPLE?!", true);
      safeMsg.textContent = "A purple item. In a safe. Nova has been informed.";
      safeAlert.hidden = false;
      clearTimeout(alertTimer);
      alertTimer = setTimeout(() => { safeAlert.hidden = true; }, 4000);
    } else {
      safe.reds += 1;
      setLoot("RED", pick(redNames), false);
      floatLoot("+1 RED", false);
      safeMsg.textContent = milestones[safe.reds] || pick(safeLines, safeMsg.textContent);
    }
    dialTurn += 137;
    safeDial.style.transform = `rotate(${dialTurn}deg)`;
    safeBtn.classList.remove("pop");
    void safeBtn.offsetWidth; // restart the bounce
    safeBtn.classList.add("pop");
    renderSafe();
    saveSafe();
    if (player) {
      if (isPurple) player.pendingPurples += 1;
      else player.pendingReds += 1;
      savePlayer();
      queueSync();
    }
  });

  renderSafe();

  /* ---------- Safe Simulator leaderboard (via /api/safe) ---------- */
  const PLAYER_KEY = "bifdma-safe-player";
  const OLD_PLAYER_KEY = "bifdma-safe-old-player"; // kept when a name disappears, in case it comes back
  const boardForm = $("#board-form");
  const boardStatus = $("#board-status");
  const boardList = $("#board-list");
  const boardMe = $("#board-me");
  // Once joined: { id, token, name, pendingReds, pendingPurples, seq, inflight }.
  // inflight is the batch being sent; it keeps its number until the server confirms it.
  let player = null;
  let myScore = null;
  let myRank = null;
  let syncTimer = null;
  let syncing = false;
  const SYNC_DELAY_MS = 10_000; // finds are sent in batches to keep server use low
  const BOARD_REFRESH_MS = 60_000;

  try { player = JSON.parse(localStorage.getItem(PLAYER_KEY)); } catch { /* storage blocked */ }
  if (!player || !/^[a-f0-9]{16}$/.test(player.id) || typeof player.token !== "string") {
    player = null;
  } else {
    const count = (n) => (Number.isSafeInteger(n) && n > 0 ? n : 0);
    player.pendingReds = count(player.pendingReds);
    player.pendingPurples = count(player.pendingPurples ?? player.pendingWhites);
    delete player.pendingWhites;
    player.seq = count(player.seq);
    const batch = player.inflight;
    player.inflight = batch && count(batch.seq) > player.seq
      ? { seq: batch.seq, reds: count(batch.reds), purples: count(batch.purples ?? batch.whites) }
      : null;
  }

  function savePlayer() {
    try {
      if (player) localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
      else localStorage.removeItem(PLAYER_KEY);
    } catch { /* storage blocked */ }
  }

  function setBoardStatus(message, kind) {
    boardStatus.textContent = message;
    boardStatus.className = kind ? `form-status ${kind}` : "form-status";
  }

  // Once joined, the leaderboard is the source of truth: "Reds found" shows the saved score
  // plus any finds that haven't been sent yet, so the two numbers always match.
  function matchServer(out) {
    const inflight = player.inflight || { reds: 0, purples: 0 };
    safe.reds = out.reds + player.pendingReds + inflight.reds;
    safe.purples = (out.purples ?? 0) + player.pendingPurples + inflight.purples;
    safe.opened = safe.reds + safe.purples;
    saveSafe();
    renderSafe();
  }

  function renderMe() {
    boardForm.hidden = Boolean(player);
    boardMe.hidden = !player;
    if (!player) return;
    $("#board-me-name").textContent = player.name;
    $("#board-me-score").textContent = myScore === null ? "…" : myScore.toLocaleString();
    $("#board-me-rank").textContent = myRank ? `#${myRank}` : myScore === null ? "…" : "50+";
  }

  function renderBoard(players) {
    if (!players.length) {
      boardList.replaceChildren(make("li", "board-empty", "Nobody yet. Join and take #1."));
      return;
    }
    boardList.replaceChildren(...players.map((p) => {
      const row = make("li", player && p.name === player.name ? "board-row is-me" : "board-row");
      row.append(
        make("span", `board-rank rank-${p.rank}`, `#${p.rank}`),
        make("span", "board-name", p.name),
        make("span", "board-reds", p.reds.toLocaleString()),
      );
      return row;
    }));
  }

  async function loadBoard() {
    try {
      const res = await fetch("/api/safe");
      if (!res.ok) throw new Error(res.status);
      const { players } = await res.json();
      renderBoard(players);
      if (player) {
        const me = players.find((p) => p.name === player.name);
        if (me && (myScore === null || me.reds >= myScore)) {
          myScore = me.reds;
          myRank = me.rank;
          renderMe();
        }
      }
    } catch {
      boardList.replaceChildren(make("li", "board-empty", "Couldn't load the leaderboard right now. Nova is looking into it."));
    }
  }

  function queueSync() {
    if (!player || syncTimer) return;
    syncTimer = setTimeout(syncNow, SYNC_DELAY_MS);
  }

  // Sends the reds/purples found since the last sync. keepalive lets it finish while the page closes;
  // force sends even with nothing new, to fetch the player's current score and rank.
  async function syncNow(keepalive = false, force = false) {
    clearTimeout(syncTimer);
    syncTimer = null;
    if (!player || syncing) return;
    if (!player.inflight) {
      if (!player.pendingReds && !player.pendingPurples && !force) return;
      player.inflight = { seq: player.seq + 1, reds: player.pendingReds, purples: player.pendingPurples };
      player.pendingReds = 0;
      player.pendingPurples = 0;
      savePlayer();
    }
    const batch = player.inflight;
    syncing = true;
    try {
      const res = await fetch("/api/safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", id: player.id, token: player.token, ...batch }),
        keepalive,
      });
      if (res.status === 401 || res.status === 404) {
        const oldName = player.name;
        const confirmedReds = Math.max(0, safe.reds - player.pendingReds - batch.reds);
        const confirmedPurples = Math.max(0, safe.purples - player.pendingPurples - batch.purples);
        try {
          localStorage.setItem(OLD_PLAYER_KEY, JSON.stringify({
            id: player.id, token: player.token, name: player.name, seq: player.seq, reds: confirmedReds, purples: confirmedPurples,
          }));
        } catch { /* storage blocked */ }
        player = null;
        savePlayer();
        renderMe();
        boardForm.elements.name.value = oldName;
        setBoardStatus("Your name isn't on the leaderboard any more (it was removed or the board was reset). Join again to get back on it.", "err");
        return;
      }
      if (!res.ok) throw new Error(res.status);
      const out = await res.json();
      player.seq = batch.seq;
      player.inflight = null;
      savePlayer();
      matchServer(out);
      myScore = out.reds;
      myRank = out.rank;
      renderMe();
    } catch {
      // Keep the batch (same number) and send it again later.
    } finally {
      syncing = false;
      if (player && (player.inflight || player.pendingReds || player.pendingPurples)) queueSync();
    }
  }

  // If the board was reset and the old one later brought back, the key saved when the name
  // disappeared gets the player their old name and score back, plus anything found since.
  async function reclaimOldName(onlyName) {
    let old = null;
    try { old = JSON.parse(localStorage.getItem(OLD_PLAYER_KEY)); } catch { /* storage blocked */ }
    if (player || !old || !/^[a-f0-9]{16}$/.test(old.id) || typeof old.token !== "string") return false;
    if (onlyName && onlyName.toLowerCase() !== String(old.name).toLowerCase()) return false;
    const seq = (Number.isSafeInteger(old.seq) && old.seq > 0 ? old.seq : 0) + 1;
    try {
      const res = await fetch("/api/safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", id: old.id, token: old.token, seq, reds: 0, purples: 0 }),
      });
      if (!res.ok || player) return false;
      const out = await res.json();
      const since = (now, then) => (Number.isSafeInteger(then) ? Math.max(0, now - then) : 0);
      player = {
        id: old.id, token: old.token, name: old.name, seq, inflight: null,
        pendingReds: since(safe.reds, old.reds), pendingPurples: since(safe.purples, old.purples),
      };
      savePlayer();
      try { localStorage.removeItem(OLD_PLAYER_KEY); } catch { /* storage blocked */ }
      matchServer(out);
      myScore = out.reds;
      myRank = out.rank;
      renderMe();
      setBoardStatus(`Welcome back, ${old.name}. Your old score is back on the board.`, "ok");
      queueSync();
      loadBoard();
      return true;
    } catch {
      return false;
    }
  }

  boardForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = boardForm.elements.name.value.trim();
    if (name.length < 2) {
      setBoardStatus("Pick a name with at least 2 characters.", "err");
      return;
    }
    const button = boardForm.querySelector("button[type=submit]");
    button.disabled = true;
    setBoardStatus("Joining…");
    try {
      const res = await fetch("/api/safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", name, reds: safe.reds, purples: safe.purples, website: boardForm.elements.website.value }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.status === 409 && (await reclaimOldName(name))) return;
      if (!res.ok) throw new Error(out.error || "Couldn't join right now. Try again in a bit.");
      player = { id: out.id, token: out.token, name: out.name, pendingReds: 0, pendingPurples: 0, seq: 0, inflight: null };
      savePlayer();
      matchServer(out);
      myScore = out.reds;
      myRank = out.rank;
      renderMe();
      setBoardStatus(out.capped
        ? `You're on the board as ${out.name}. New players can bring at most ${out.reds.toLocaleString()} reds (anti-sauce rules), so your count starts there. Keep clicking.`
        : `You're on the board as ${out.name}. Keep clicking.`, "ok");
      loadBoard();
    } catch (err) {
      setBoardStatus(err instanceof TypeError ? "Couldn't reach the leaderboard. Try again in a bit." : err.message, "err");
    } finally {
      button.disabled = false;
    }
  });

  // Send anything unsynced when the visitor leaves or switches tabs.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") syncNow(true);
  });
  addEventListener("pagehide", () => syncNow(true));

  renderMe();
  loadBoard();
  if (player) syncNow(false, true);
  else reclaimOldName();
  setInterval(() => { if (!document.hidden) loadBoard(); }, BOARD_REFRESH_MS);

  /* ---------- Fake "recent purchase" toasts ---------- */
  const toast = $("#toast");
  const toastText = $("#toast-text");
  const purchases = [
    "Someone in Ohio just bought <b>Forbidden</b>. They were bad at the game anyway.",
    "A guy named Kyle just bought <b>The Bif</b>. His reputation has been deducted.",
    "Someone's little brother tried to pay for <b>Lockdown</b> in Bonds. Declined.",
    "A user named b*******r just renewed <b>Forbidden</b> (auto-pay).",
    "A guy camping a hallway in TV Station just bought <b>Lockdown</b>. He's still in the hallway.",
    "⚡ Bartholomew is nearby. He's gonna zap you.",
    "Someone just added <b>Nova's Secret Sauce</b>. Every safe they open is red now.",
    "Someone just asked “is this real?” For the last time: no.",
  ];
  let toastIndex = 0;
  let toastsOff = false;
  let hideTimer;

  function showToast() {
    if (toastsOff) return;
    toastText.innerHTML = purchases[toastIndex++ % purchases.length];
    toast.hidden = false;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { toast.hidden = true; }, 6000);
  }

  $("#toast-close").addEventListener("click", () => {
    toast.hidden = true;
    toastsOff = true;
  });

  setTimeout(() => {
    showToast();
    setInterval(showToast, 18000);
  }, 7000);

  /* ---------- Site stats (anonymous counts for the admin page) ---------- */
  function track(event) {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => { /* stats are best-effort */ });
  }
  track("view");

  /* ---------- Killcam clips (added by admins, via /api/clips) ---------- */
  const clipsSection = $("#clips");
  const replayScreen = $("#replay-screen");
  const replayList = $("#replay-list");
  const verdicts = [
    "definitely just audio",
    "crosshair placement (allegedly)",
    "game sense, according to bif",
    "inconclusive. ACE is still reviewing",
    "chat says walls, bif says headset",
    "Bartholomew was involved",
    "Nova's Secret Sauce detected",
  ];
  let clips = [];
  let current = 0;

  function exhibit(index) {
    return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
  }

  // Same clip, same verdict, every visit.
  function verdictFor(clip) {
    let n = 0;
    for (const ch of clip.id) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
    return verdicts[n % verdicts.length];
  }

  // Twitch needs to know which site is embedding the clip.
  function embedUrl(clip) {
    return clip.source === "twitch"
      ? `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip.videoId)}&parent=${location.hostname}&autoplay=true`
      : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(clip.videoId)}?autoplay=1`;
  }

  function playClip() {
    const clip = clips[current];
    const frame = make("iframe", "replay-frame");
    frame.src = embedUrl(clip);
    frame.title = clip.title;
    frame.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    replayScreen.replaceChildren(frame);
  }

  // Shows a clip in the player. The video itself only loads when someone presses play.
  function showClip(index, autoplay) {
    current = index;
    const clip = clips[index];
    $("#replay-exhibit").textContent = `EXHIBIT ${exhibit(index)}`;
    $("#replay-source").textContent = clip.source === "twitch" ? "TWITCH" : "YOUTUBE";
    $("#replay-verdict").textContent = verdictFor(clip);
    replayList.querySelectorAll(".replay-item").forEach((item, i) => {
      item.classList.toggle("is-active", i === index);
      if (i === index) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    });
    if (autoplay) {
      playClip();
      return;
    }
    const poster = make("button", "replay-poster");
    poster.type = "button";
    poster.setAttribute("aria-label", `Play: ${clip.title}`);
    if (clip.source === "youtube") {
      const thumb = make("img", "replay-thumb");
      thumb.src = `https://i.ytimg.com/vi/${encodeURIComponent(clip.videoId)}/hqdefault.jpg`;
      thumb.alt = "";
      poster.append(thumb);
    }
    const caption = make("span", "replay-caption");
    caption.append(make("span", "replay-caption-tag", "KILLCAM"), make("strong", "", clip.title));
    poster.append(make("span", "replay-play", "▶"), caption);
    poster.addEventListener("click", playClip);
    replayScreen.replaceChildren(poster);
  }

  function renderClips() {
    $("#replay-count").textContent = `(${clips.length})`;
    replayList.replaceChildren(...clips.map((clip, i) => {
      const item = make("button", "replay-item");
      item.type = "button";
      const text = make("span", "replay-item-text");
      text.append(
        make("span", "replay-item-title", clip.title),
        make("span", "replay-item-meta", `${clip.source === "twitch" ? "Twitch clip" : "YouTube"} · ${timeAgo(clip.at)}`),
      );
      item.append(make("span", "replay-letter", exhibit(i)), text);
      item.addEventListener("click", () => showClip(i, true));
      const row = make("li");
      row.append(item);
      return row;
    }));
    showClip(0, false);
  }

  (async () => {
    try {
      const res = await fetch("/api/clips");
      if (!res.ok) throw new Error(res.status);
      clips = (await res.json()).clips;
    } catch {
      clips = [];
    }
    // No clips yet: keep the section (and its menu links) hidden.
    if (!clips.length) return;
    renderClips();
    clipsSection.hidden = false;
    document.querySelectorAll(".nav-clips").forEach((link) => { link.hidden = false; });
  })();

  /* ---------- Suggestion box (only admins can read these) ---------- */
  const feedbackForm = $("#feedback-form");
  const feedbackStatus = $("#feedback-status");
  const feedbackText = feedbackForm.elements.text;

  function setFeedbackStatus(message, kind) {
    feedbackStatus.textContent = message;
    feedbackStatus.className = kind ? `form-status ${kind}` : "form-status";
  }

  feedbackText.addEventListener("input", () => { $("#feedback-count").textContent = feedbackText.value.length; });

  feedbackForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (feedbackText.value.trim().length < 5) {
      setFeedbackStatus("Write a little more so the admins know what you mean.", "err");
      feedbackText.focus();
      return;
    }
    const button = feedbackForm.querySelector("button[type=submit]");
    button.disabled = true;
    setFeedbackStatus("Sending…");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(feedbackForm))),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Couldn't send that. Try again in a bit.");
      feedbackForm.reset();
      $("#feedback-count").textContent = "0";
      setFeedbackStatus("Sent. The admins will read it (and probably laugh).", "ok");
    } catch (err) {
      setFeedbackStatus(err instanceof TypeError ? "Couldn't reach the server. Try again in a bit." : err.message, "err");
    } finally {
      button.disabled = false;
    }
  });

  /* ---------- Bartholomew ---------- */
  const zap = $("#zap");
  let zapTimer;

  function zapYou() {
    track("zap");
    zap.hidden = false;
    // restart the flash/shake if he zaps you twice in a row
    zap.style.animation = "none";
    void zap.offsetWidth;
    zap.style.animation = "";
    clearTimeout(zapTimer);
    zapTimer = setTimeout(() => { zap.hidden = true; }, 3200);
  }

  zap.addEventListener("click", () => { zap.hidden = true; });
  document.querySelectorAll("[data-zap]").forEach((el) => el.addEventListener("click", zapYou));

  // Secret: type "zap" anywhere on the page
  let typed = "";
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !zap.hidden) { zap.hidden = true; return; }
    if (e.key.length !== 1 || e.target.closest("input, textarea")) return;
    typed = (typed + e.key.toLowerCase()).slice(-3);
    if (typed === "zap") zapYou();
  });
})();
