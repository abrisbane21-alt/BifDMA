(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const pick = (arr, not) => {
    if (arr.length < 2) return arr[0];
    let item;
    do { item = arr[Math.floor(Math.random() * arr.length)]; } while (item === not);
    return item;
  };

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
    "I check the Villa every raid. It's Doss Anthony's house, chat, I'm being polite.",
    "Reds just spawn like that on Farm. Look it up.",
    "It's Forbidden. Everyone's cracked in Forbidden.",
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

  /* ---------- "Buy" modal ---------- */
  const modal = $("#modal");
  const modalTitle = $("#modal-title");
  const modalBody = $("#modal-body");
  const declines = [
    ["Payment declined: skill issue.", "BifDMA isn't real. There's nothing to buy and nothing to download."],
    ["Insufficient Koen.", "Go sell some reds first. (Kidding. Nothing here is for sale. This site is a joke.)"],
    ["Error 69: this website is a joke.", "There's no DMA, no checkout, and no Discord. Just vibes."],
    ["Blocked by ACE.", "Wow, it finally caught something. Unfortunately that something is a parody website."],
    ["Payment zapped.", "Bartholomew got to your card first. He said his name, and then he zapped it."],
    ["Out of stock.", "We sold the last one to a guy who swears he just has really good audio."],
    ["Nice try.", "If you wanted to pre-fire corners you could just… practice. Like bif. Allegedly."],
  ];
  let lastFocus = null;

  function openModal() {
    const [title, body] = pick(declines, null);
    modalTitle.textContent = title;
    modalBody.textContent = body;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modal.querySelector(".modal-card .btn").focus();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  document.querySelectorAll("[data-buy]").forEach((btn) => btn.addEventListener("click", openModal));
  modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  /* ---------- Fake "recent purchase" toasts ---------- */
  const toast = $("#toast");
  const toastText = $("#toast-text");
  const purchases = [
    "Someone in Ohio just bought <b>Forbidden</b>. They were bad at the game anyway.",
    "A guy named Kyle just bought <b>The Bif</b>. His reputation has been deducted.",
    "Someone's little brother tried to pay for <b>Lockdown</b> in Bonds. Declined.",
    "A user named b*******r just renewed <b>Forbidden</b> (auto-pay).",
    "A bush camper on Valley just bought <b>Lockdown</b>. He's still in the bush.",
    "⚡ Bartholomew is nearby. He's gonna zap you.",
    "Someone just asked “is this real?” For the last time: no.",
  ];
  let toastIndex = 0;
  let toastsOff = false;
  let hideTimer;

  function showToast() {
    if (toastsOff || !modal.hidden) return;
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
    if (!modal.hidden) closeModal();
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
