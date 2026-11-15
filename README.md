# Neural network resume site

A single scrolling page shaped like a neural network: a feed-forward diagram (n layers of m neurons, deliberately uneven so it looks grown rather than drawn on a grid) that a 3D camera flies over. Each section of the resume sits at its own node; scrolling flies the camera from node to node.

All text comes from **`content.md`**. To change the site, edit that one file.

- No build step, no command line needed. Plain HTML, CSS and JavaScript.
- Libraries load from a CDN: Three.js 0.187, GSAP 3.15 + ScrollTrigger, marked 18, plus Space Grotesk and Manrope from Google Fonts.

## What is in this folder

```
(top of the repository)
├── .nojekyll                        empty file; tells GitHub Pages to serve content.md untouched
├── index.html                       page skeleton and social preview tags
├── style.css                        colours, type, layout
├── script.js                        reads content.md, builds the page and the 3D network
├── content.md                       ALL resume content lives here
├── README.md                        this file
├── images/
│   └── profile.jpg                  hero photo (1400 × 2100 px)
└── files/
    └── Kartikeya_Singh_Resume.pdf   the CV behind the "Download CV" button
```

Everything goes in the **top level** of the `kartikeyavi.github.io` repository, exactly as laid out above. Do not upload the enclosing folder itself, only what is inside it.

---

## 1. Clear the existing files from the repository (GitHub website)

You only need to remove old files that this project does not replace. Files with the same name (for example `index.html`) are overwritten when you upload. Clearing everything first is still the cleanest route.

**Fastest way: the web editor**

1. Open `https://github.com/kartikeyavi/kartikeyavi.github.io` while signed in.
2. Press the `.` (full stop) key. The repository opens in an editor in your browser (the address changes to `github.dev/...`).
3. In the file list on the left, click the first item, hold `Shift`, and click the last item so everything is selected.
4. Right-click the selection and choose **Delete Permanently**.
5. Click the **Source Control** icon in the left bar (the branch symbol), type a message such as `Clear old site`, and press **Commit & Push**.
6. Close the tab.

**Alternative: file by file on github.com**

- A file: open it, click the **⋯** menu at the top right of the file view, choose **Delete file**, then **Commit changes**.
- A folder: open it, click the **⋯** menu at the top right, choose **Delete directory**, then **Commit changes**.

Do not delete the repository itself, and leave a `CNAME` file in place if you have one (see section 8).

## 2. What to upload, and where

Upload these eight items into the top level of the repository:

| Item | Type | Goes to |
|---|---|---|
| `.nojekyll` | file (empty) | top level |
| `index.html` | file | top level |
| `style.css` | file | top level |
| `script.js` | file | top level |
| `content.md` | file | top level |
| `README.md` | file | top level |
| `images/` | folder, containing `profile.jpg` | top level |
| `files/` | folder, containing `Kartikeya_Singh_Resume.pdf` | top level |

After uploading, `https://github.com/kartikeyavi/kartikeyavi.github.io` should show `index.html` directly in its file list, not inside another folder.

## 3. Upload through the GitHub website

1. Unzip the project on your computer and open the folder.
2. On the repository page, click **Add file → Upload files**.
3. Select everything **inside** the project folder (the six files and the two folders) and drag it onto the upload area. Folders keep their structure when dragged from Chrome, Edge or Firefox.
4. Wait for the list of files to finish loading, type a message such as `New resume site`, keep **Commit directly to the main branch** selected, and click **Commit changes**.

**About `.nojekyll`:** files whose names start with a dot are hidden on macOS (press `Cmd + Shift + .` in Finder to show them) and sometimes get left out of a drag. Check the repository afterwards. If `.nojekyll` is missing, click **Add file → Create new file**, type `.nojekyll` as the name, leave the contents empty and click **Commit changes**.

**Optional: the same thing with git**

```bash
git clone https://github.com/kartikeyavi/kartikeyavi.github.io.git
cd kartikeyavi.github.io
git rm -r -q .                      # removes the old files (history is kept)
# now copy everything from inside the project folder into this folder, including .nojekyll
git add -A
git commit -m "New resume site"
git push
```

## 4. Check GitHub Pages is switched on

1. In the repository, open **Settings → Pages** (left sidebar, under "Code and automation").
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` (or `master`, if that is what your repository uses) and the folder to **/ (root)**, then click **Save**.
4. The top of that page shows "Your site is live at `https://kartikeyavi.github.io/`" once it is published.

A change usually goes live within 1–2 minutes and can take up to about 10. You can watch progress in the repository's **Actions** tab: wait for the "pages build and deployment" run to show a green tick.

## 5. Preview on your own computer first

The page loads `content.md` over HTTP, which browsers block when you simply double-click `index.html`. Start a small local server instead:

```bash
cd path/to/the/project/folder
python -m http.server 8000
```

(On Windows use `py -m http.server 8000` if `python` is not found; on macOS use `python3`.)

Then open <http://localhost:8000>. Press `Ctrl + C` in the terminal to stop the server. An internet connection is needed, because the libraries and fonts come from a CDN.

Useful switches while testing, added to the end of the address:

| Address | Shows |
|---|---|
| `?motion=full` | the full camera flight, even on a slow device |
| `?motion=fade` | the low-power mode: the camera cuts between nodes behind a fade |
| `?motion=static` | what visitors with "reduce motion" switched on will see |

## 6. Updating the site later

### Text: edit `content.md`

On GitHub, open `content.md`, click the pencil icon, make your changes and click **Commit changes**. Or edit the file on your computer and upload it again (same name, so it replaces the old one). Nothing else needs touching.

How the file is read:

```markdown
---
name: Your Name                 <- hero heading, page title, footer
title: Role · Affiliation       <- white line under the name
subtitle: Research interests    <- cyan line
photo: images/profile.jpg       <- leave empty to hide the photo
email: you@example.com
linkedin: https://...           <- any link left empty is simply not shown
github:
scholar:
orcid:
website: https://...
cv: files/Your_CV.pdf           <- leave empty to hide the Download CV buttons
location: City, Country
---

## About
A paragraph of text.

## News
- 2026-09: Dated items use YEAR-MONTH, then a colon.

## Skills
- Category: item, item (detail, detail), item

## Experience
### Position | Organisation | Jan 2025 – Present
- Lab or group · Advisor: Name      <- optional; a first bullet containing "Advisor:" becomes the advisor line
- What you did.

## Education
### Degree | University | Sep 2026 – Present
- Detail.

## Publications
- **Singh, K.**, Coauthor, A. "Paper Title." *Venue*, 2026. [PDF](files/paper.pdf) [arXiv](https://...) [Code](https://...) [BibTeX](files/paper.bib)

## Projects
### Project title
- Detail.

## Courses
- A course.

## Conferences
### Conference | Place | 2024
- Detail.

## Awards
- An award.
```

Rules worth knowing:

- **A missing or empty section disappears**, together with its node in the network and its dot on the mini map. Publications is hidden right now because it only contains a comment. Add a bullet in the format above and it appears, with the network growing by one layer.
- Text inside `<!-- ... -->` is ignored.
- `**bold**`, `*italics*` and `[links](https://...)` work everywhere.
- A new `## Heading` that the site does not know about still gets its own node, placed just before Contact.
- Contact is built from the links at the top of the file.

### Photo

Upload a new picture to the `images/` folder with the **same name**, `profile.jpg`, and it replaces the old one. To use a different file name, upload it and change the `photo:` line in `content.md`. A portrait around 1400 px wide and under 500 KB loads quickly. If the crop cuts off your face, change `object-position` under `.hero-photo img` in `style.css`.

### CV

Upload the new PDF to `files/` as `Kartikeya_Singh_Resume.pdf`, or use a new name and change the `cv:` line in `content.md`.

### Re-uploading

Use **Add file → Upload files** in the right folder on GitHub and commit. After a minute or two, reload the site with `Ctrl + Shift + R` (`Cmd + Shift + R` on a Mac) so the browser fetches the new files.

### Two things that are not in `content.md`

- **Link previews.** LinkedIn, Slack and search engines do not run JavaScript, so the page title, description and preview image they show are written near the top of `index.html`. If your name, headline or domain changes, update those few lines.
- **Look and layout of the network.** Open `script.js`: the `CONFIG` block at the top sets the number of neurons per layer (`neurons`), how uneven the network is (`irregular`; change `seed` for a different arrangement), spacing, camera height and speed, and the `SECTIONS` list maps each `## Heading` to its node (order, and how far left or right the node sits). Colours and fonts are the variables at the top of `style.css`.

## 7. Optional: try it in a separate repository first

1. On GitHub, click **+ → New repository**, name it `portfolio-v2`, set it to **Public**, and create it.
2. Upload the same files as in sections 2 and 3.
3. Open **Settings → Pages**, choose **Deploy from a branch**, `main`, **/ (root)**, and **Save**.
4. After a minute or two the test copy is at `https://kartikeyavi.github.io/portfolio-v2/`.

Every path in the project is relative, so it works unchanged in a sub-folder like this. When you are happy, upload the same files to `kartikeyavi.github.io` and delete `portfolio-v2` (its **Settings → General → Delete this repository**) if you no longer want it.

## 8. Connecting a custom domain later

Replace `example.com` below with your domain.

1. **Tell GitHub the domain.** In the repository, open **Settings → Pages**, type the domain (for example `www.example.com`) under **Custom domain** and click **Save**. GitHub adds a file named `CNAME` to the repository containing that one line. You can also create it yourself: **Add file → Create new file**, name it `CNAME` (capitals, no extension), with the domain as its only content. Keep this file whenever you re-upload the site.
2. **Verify the domain** so nobody else can claim it. Click your profile picture → **Settings → Pages → Add a domain**, enter the domain, and GitHub shows a TXT record to add at your DNS provider (its name starts with `_github-pages-challenge-kartikeyavi`). Add it, wait a few minutes, then click **Verify**.
3. **Add DNS records** at the company where you bought the domain:

   | Type | Name / Host | Value |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA | `@` | `2606:50c0:8000::153` |
   | AAAA | `@` | `2606:50c0:8001::153` |
   | AAAA | `@` | `2606:50c0:8002::153` |
   | AAAA | `@` | `2606:50c0:8003::153` |
   | CNAME | `www` | `kartikeyavi.github.io` |

   These addresses are taken from GitHub's documentation ("Managing a custom domain for your GitHub Pages site"); check that page when you do this in case they have changed.
4. **Wait for DNS.** Changes can take up to 24 hours to spread. **Settings → Pages** shows "DNS check successful" when it is ready.
5. **Switch on HTTPS.** Tick **Enforce HTTPS** on the same page. The box can stay greyed out for up to an hour while GitHub issues the certificate.
6. **Update the preview tags.** In `index.html`, change `https://kartikeyavi.github.io/` in the `og:url`, `og:image` and `twitter:image` lines to the new domain, and update `website:` in `content.md`.

## 9. Troubleshooting

**Blank page, or only the photo area and background**
- Opened by double-clicking `index.html`? Use the local server from section 5.
- On GitHub: check that `content.md` and `.nojekyll` are both in the top level. Without `.nojekyll`, GitHub Pages converts `content.md` into a web page and the site cannot read it. Open `https://kartikeyavi.github.io/content.md` directly: you should see the raw text.
- Check that `index.html` sits in the top level, not inside a sub-folder.
- A broken first block in `content.md` (the lines between the two `---`) stops the hero from filling in. Each line must be `key: value`.
- Press `F12` and look at the **Console** tab for a red message naming the file that failed.

**Text is there but there is no 3D network**
- The network needs WebGL and the Three.js CDN. Privacy extensions, strict office networks or very old browsers can block either. The text still works without it.

**Photo not loading**
- The `photo:` line must match the file exactly, including capitals: `images/profile.jpg` is not `images/Profile.JPG`.
- No leading slash: write `images/profile.jpg`, not `/images/profile.jpg`.

**Content not updating**
- Wait for the green tick in the **Actions** tab, then hard-reload (`Ctrl + Shift + R`).
- Make sure you edited `content.md` in the top level of the right repository and branch.
- A section stays hidden if its `## Heading` has nothing under it, or only a comment.

**Site not live yet (404)**
- **Settings → Pages** must show **Deploy from a branch**, `main`, **/ (root)**.
- The repository must be named exactly `kartikeyavi.github.io` and be **Public** (private repositories need a paid plan for Pages).
- The first publish can take up to 10 minutes.

**The camera cuts with a fade instead of flying**
- That is the automatic low-power mode. If the device cannot hold a steady frame rate, the site first lowers the resolution and then swaps flights for fades. Add `?motion=full` to the address to force the full flight.
- With "reduce motion" switched on in the operating system, the network is shown as a still picture by design.
