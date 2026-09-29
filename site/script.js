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

  /* ---------- Bartholomew ---------- */
  const zap = $("#zap");
  let zapTimer;

  function zapYou() {
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
