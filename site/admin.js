(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const form = $("#admin-form");
  const status = $("#admin-status");
  const list = $("#admin-wall");
  let adminKey = "";

  // Remember the key for this tab only, so a refresh doesn't ask again.
  try { adminKey = sessionStorage.getItem("bifdma-admin-key") || ""; } catch { /* storage blocked */ }
  form.elements.key.value = adminKey;

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = kind ? `form-status ${kind}` : "form-status";
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function render(reviews) {
    if (!reviews.length) {
      list.replaceChildren(make("p", "wall-empty", "No reviews on the wall."));
      return;
    }
    list.replaceChildren(...reviews.map((review) => {
      const item = make("article", "wall-item admin-item");
      const meta = make("div", "wall-meta");
      const stars = make("span", "wall-stars", "★".repeat(review.stars));
      stars.append(make("span", "dim", "★".repeat(5 - review.stars)));
      meta.append(stars, make("span", "wall-when", new Date(review.at).toLocaleString()));
      const del = make("button", "btn btn-ghost btn-sm admin-delete", "Delete");
      del.type = "button";
      del.addEventListener("click", () => remove(review, item, del));
      item.append(meta, make("p", "wall-text", review.text), make("p", "wall-name", `— ${review.name}`), del);
      return item;
    }));
  }

  async function load() {
    setStatus("Loading…");
    try {
      // The timestamp skips the 15-second CDN cache so the list is current.
      const res = await fetch(`/api/reviews?limit=200&fresh=${Date.now()}`);
      if (!res.ok) throw new Error();
      const { reviews } = await res.json();
      render(reviews);
      setStatus(`${reviews.length} review${reviews.length === 1 ? "" : "s"} loaded.`, "ok");
    } catch {
      setStatus("Couldn't load reviews. Is the site deployed on Netlify?", "err");
    }
  }

  async function remove(review, item, button) {
    if (!confirm(`Delete this review by ${review.name}?\n\n"${review.text}"`)) return;
    button.disabled = true;
    try {
      const res = await fetch(`/api/reviews?id=${encodeURIComponent(review.id)}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Delete failed.");
      item.remove();
      setStatus("Deleted. It can take up to 15 seconds to disappear for everyone.", "ok");
    } catch (err) {
      button.disabled = false;
      setStatus(err.message, "err");
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    adminKey = form.elements.key.value.trim();
    try { sessionStorage.setItem("bifdma-admin-key", adminKey); } catch { /* storage blocked */ }
    load();
  });
})();
