# BifDMA

A parody "cheat store" website for **bifdma.org**. It's a joke fan site about bifsterr's chat
constantly accusing him of cheating in Arena Breakout: Infinite.

Nothing on the site is real. Every "Buy" button opens a joke popup, and the footer and FAQ state that
it's a parody. There is no product, no download, and no payment form.

## Files

| File          | What it is                                                           |
| ------------- | -------------------------------------------------------------------- |
| `index.html`  | The whole page (all the jokes live here — edit freely)               |
| `styles.css`  | Styling                                                              |
| `script.js`   | Excuse generator, "payment declined" popup, fake purchase toasts     |
| `favicon.svg` | Browser tab icon                                                     |
| `og.png`      | Preview image shown when the link is shared on Discord/Twitter/etc. |
| `CNAME`       | Tells GitHub Pages to serve the site on `bifdma.org`                 |

To preview locally, open `index.html` in a browser, or run `python3 -m http.server` in this folder
and visit http://localhost:8000.

## Putting it live on bifdma.org (GitHub Pages + GoDaddy)

### 1. Turn on GitHub Pages

1. On GitHub, open this repo → **Settings** → **Pages**.
   (On a free GitHub account the repo has to be **public** for Pages to work.)
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Pick the branch the site is on (for example `main`) and the **/ (root)** folder, then click **Save**.
4. Under **Custom domain**, enter `bifdma.org` and click **Save**. The `CNAME` file in this repo already
   contains that domain, so it should fill in by itself.

### 2. Point the domain at GitHub (GoDaddy)

In GoDaddy, go to **My Products** → **bifdma.org** → **DNS** (Manage DNS). Then:

1. **Delete** any existing `A` record for `@` (GoDaddy's "Parked" record) and any "Forwarding" set
   on the domain.
2. **Add four `A` records**, all with Name `@`:

   | Type | Name | Value             |
   | ---- | ---- | ----------------- |
   | A    | @    | 185.199.108.153   |
   | A    | @    | 185.199.109.153   |
   | A    | @    | 185.199.110.153   |
   | A    | @    | 185.199.111.153   |

3. **Edit (or add) the `CNAME` record** for `www`:

   | Type  | Name | Value                         |
   | ----- | ---- | ----------------------------- |
   | CNAME | www  | `abrisbane21-alt.github.io`   |

DNS usually updates within an hour, but it can take up to 24–48 hours.

### 3. Turn on HTTPS

Once GitHub's Pages settings show the domain check passing, tick **Enforce HTTPS**. GitHub issues the
certificate automatically. This can take a little while after DNS starts working.
