(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const form = $("#admin-form");
  const status = $("#admin-status");
  const list = $("#admin-wall");
  const boardList = $("#admin-board");
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

  function renderBoard(players) {
    if (!players.length) {
      boardList.replaceChildren(make("li", "board-empty", "Nobody on the leaderboard."));
      return;
    }
    boardList.replaceChildren(...players.map((p) => {
      const row = make("li", "board-row admin-board-row");
      const del = make("button", "btn btn-ghost btn-sm admin-delete", "Remove");
      del.type = "button";
      del.addEventListener("click", () => removePlayer(p, row, del));
      row.append(make("span", "board-rank", `#${p.rank}`), make("span", "board-name", p.name), make("span", "board-reds", p.reds.toLocaleString()), del);
      return row;
    }));
  }

  async function load() {
    setStatus("Loading…");
    try {
      // The timestamps skip the CDN cache so the lists are current.
      const [reviewsRes, boardRes] = await Promise.all([
        fetch(`/api/reviews?limit=200&fresh=${Date.now()}`),
        fetch(`/api/safe?limit=50&fresh=${Date.now()}`),
      ]);
      if (!reviewsRes.ok || !boardRes.ok) throw new Error();
      const { reviews } = await reviewsRes.json();
      const { players } = await boardRes.json();
      render(reviews);
      renderBoard(players);
      setStatus(`${reviews.length} review${reviews.length === 1 ? "" : "s"} and ${players.length} leaderboard name${players.length === 1 ? "" : "s"} loaded.`, "ok");
    } catch {
      setStatus("Couldn't load. Is the site deployed on Netlify?", "err");
    }
  }

  async function removePlayer(p, row, button) {
    if (!confirm(`Remove ${p.name} from the leaderboard? Their name becomes free for anyone to take.`)) return;
    button.disabled = true;
    try {
      const res = await fetch(`/api/safe?name=${encodeURIComponent(p.name)}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Remove failed.");
      row.remove();
      setStatus(`Removed ${p.name}. It can take a few seconds to disappear for everyone.`, "ok");
    } catch (err) {
      button.disabled = false;
      setStatus(err.message, "err");
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
