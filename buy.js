(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const plans = {
    lockdown: {
      name: "Lockdown",
      price: "42M Koen/day",
      soldOut: "Every Lockdown key went to people who still get sniped by Bernard.",
    },
    forbidden: {
      name: "Forbidden",
      price: "690M Koen/month",
      soldOut: "bif's chat bought every last Forbidden key. (There were zero. This site is a joke.)",
    },
    bif: {
      name: "The Bif",
      price: "1B Koen + your reputation",
      soldOut: "There's only one bif, and he isn't for sale.",
    },
  };
  const payNames = { koen: "Koen", bonds: "Bonds", vibes: "Vibes" };
  const payNotes = {
    koen: "",
    bonds: " Also, we don't take Bonds. Keep your Bonds.",
    vibes: " Your vibes were accepted. It's still out of stock.",
  };
  const extras = [
    "Someone in Ohio bought the last one 0.2 seconds before you clicked.",
    "Restock ETA: never.",
    "We sold the last one to a guy who swears he just has really good audio.",
    "ACE finally caught something: this checkout page.",
    "Bartholomew zapped the warehouse.",
    "If you wanted to pre-fire corners you could just… practice. Like bif. Allegedly.",
  ];

  $("#year").textContent = new Date().getFullYear();

  /* ---------- Order form ---------- */
  const form = $("#checkout");
  const { plan: planInput, sauce: sauceInput, pay: payInput } = form.elements;

  // Pre-select whatever was clicked on the main page (buy.html?plan=bif&sauce=1)
  const params = new URLSearchParams(location.search);
  if (plans[params.get("plan")]) planInput.value = params.get("plan");
  if (params.get("sauce") === "1") sauceInput.checked = true;

  function updateSummary() {
    const plan = plans[planInput.value];
    $("#sum-plan").textContent = plan.name;
    $("#sum-addon").textContent = sauceInput.checked ? "Nova's Secret Sauce" : "None";
    $("#sum-pay").textContent = payNames[payInput.value];
    $("#sum-total").textContent = plan.price + (sauceInput.checked ? " + ??? Koen" : "");
  }
  form.addEventListener("change", updateSummary);
  updateSummary();

  /* ---------- Out of stock ---------- */
  const modal = $("#modal");
  const stock = $("#stock");
  const buyBtn = $("#buy-btn");
  let lastFocus = null;

  function openModal() {
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

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let body = plans[planInput.value].soldOut;
    if (sauceInput.checked) body += " Nova's Secret Sauce is gone too. Nova used the last jar.";
    body += payNotes[payInput.value];
    $("#modal-body").textContent = body;
    $("#modal-extra").textContent = pick(extras);

    stock.classList.add("stock-out");
    $("#stock-text").textContent = "Out of stock · Restock: never";
    buyBtn.textContent = "Try again anyway";
    openModal();
  });

  modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });
})();
