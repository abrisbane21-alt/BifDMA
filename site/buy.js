(function () {
  "use strict";

  // bif's PayPal link, e.g. "https://paypal.me/bifsterr". Leave empty to keep the tip button off.
  // With a paypal.me link the chosen amount is filled in for the tipper.
  const PAYPAL_LINK = "";
  const CURRENCY_SYMBOL = "$";

  const $ = (sel) => document.querySelector(sel);
  const button = $("#tip-btn");
  const amounts = document.querySelectorAll('input[name="amount"]');

  $("#year").textContent = new Date().getFullYear();
  document.querySelectorAll(".tip-price[data-amount]").forEach((el) => {
    el.textContent = `${CURRENCY_SYMBOL}${el.dataset.amount}`;
  });

  // Anonymous counts for the admin stats page.
  function track(event) {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => { /* stats are best-effort */ });
  }
  track("buy"); // someone pressed a Buy button and landed on "out of stock"

  // paypal.me/name/5 opens PayPal with 5 filled in. Other PayPal links open as they are.
  function tipUrl(amount) {
    let url;
    try {
      url = new URL(PAYPAL_LINK);
    } catch {
      return null;
    }
    const host = url.hostname.replace(/^www\./, "");
    if (amount !== "other" && (host === "paypal.me" || (host === "paypal.com" && url.pathname.startsWith("/paypalme/")))) {
      url.pathname = `${url.pathname.replace(/\/+$/, "")}/${amount}`;
    }
    return url.toString();
  }

  function update() {
    const amount = document.querySelector('input[name="amount"]:checked').value;
    const href = tipUrl(amount);
    if (!href) {
      button.removeAttribute("href");
      button.setAttribute("aria-disabled", "true");
      button.textContent = "Tipping opens soon";
      return;
    }
    button.href = href;
    button.removeAttribute("aria-disabled");
    button.textContent = amount === "other" ? "Tip on PayPal" : `Tip ${CURRENCY_SYMBOL}${amount} on PayPal`;
  }

  amounts.forEach((input) => input.addEventListener("change", update));
  button.addEventListener("click", (e) => {
    if (button.getAttribute("aria-disabled") === "true") {
      e.preventDefault();
      return;
    }
    track("tip");
  });
  update();
})();
