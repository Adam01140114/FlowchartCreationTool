---
name: publish-live-site
description: Build the project packet - the page the thank-you screen's "Download Payload" packages - into its own live folder, live-sites/<name>/, in two modes (one question at a time, one section at a time) with its CSS, logo, county lookup and every PDF, served by the dev server; check it works and hand back both links. Use when the user says "run this" about the project, packet, or site, or asks to publish, build, rebuild, refresh, or set up the live site / live HTML site.
---

# Publish the live site

The user's standing request: when they say **"run this"**, take the project package
from the thank-you screen and set it up as a live HTML site in its own folder, with
all the CSS and PDFs it needs - then give them the links.

"The project package at the thank-you screen" is **Download Payload** (test mode):
the generated packet with Firebase, Stripe and the cart stripped, plus
`generate.css`, `generate2.css`, `logo.png` and the PDFs. This process builds the
same page and has the dev server write it straight into `live-sites/<name>/`
instead of a zip, so it is live the moment it is written.

It is built twice, because how the questions are asked is fixed when a page is
generated: `question.html` (one question at a time) and `section.html` (one
section at a time). `index.html` is a router - `index.html?mode=question` and
`index.html?mode=section` are the two links to hand out. Both are test mode.

## Steps

1. **Server.** `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/index.html`.
   Anything but 200: start it with the Browser pane tool `preview_start`, name
   `flowchart-dev` (`.claude/launch.json` runs `node dev-server.js`). If
   `dev-server.js` changed since the server started, restart it (`preview_stop`,
   then `preview_start`) - the publish route lives there.

2. **Source.** The project's GUI export, `dv-packet-gui.json`. If the flowcharts or
   hints changed since it was exported, re-export it first: in the editor
   (`http://localhost:8080/index.html`) run
   `applyProjectJson(await (await fetch('/dv-packet-project.json')).text())`, wait a
   few seconds, then `exportProjectGuiJson(false)` and POST the parsed result to
   `/api/dev-save` as `{ name: 'dv-packet-gui.json', data }`. Otherwise use it as it is.

3. **Build.** In the Browser pane, open `http://localhost:8080/FormWiz%20GUI/gui.html`
   and run:

   ```js
   const s = document.createElement('script');
   s.src = '/live-site-builder.js?t=' + Date.now();
   document.head.appendChild(s);
   await new Promise(r => { s.onload = r; });
   await window.buildLiveSite({ gui: '/dv-packet-gui.json' })
   ```

   `modes` defaults to `['question', 'section']`; `'all'` (every section on one
   page) can be added if asked for. The result lists the folder, its files, the
   PDFs copied, any `missingPdfs`, and `links` - one per mode.

4. **Check it.** Open each link in the Browser pane and confirm it lands on its
   page (`question.html` / `section.html`), the first question shows, and
   `read_console_messages` (errors only) has nothing from the live page - errors
   naming `/CountyLookup/` at the site root come from the builder page, not the
   site. Confirm the PDFs fill:
   `(await fetch('/edit_pdf?pdf=dv100.pdf', { method: 'POST', body: new FormData() })).headers.get('content-type')`
   is `application/pdf`. Report any missing PDF by name - never claim a check you
   did not run.

5. **Hand back** the links by project id first -
   `http://localhost:8080/form/<projectId>/section.html` and `.../question.html`
   (`formLinks` in the result; they follow the project through renames) - then
   the folder links `http://localhost:8080/live-sites/<name>/index.html?mode=question`
   and `...?mode=section`, the folder path, what is in it, and the limits below. If the
   Demo Form Hub lists this packet (`auto-form/public/Auto-Form-Creator/Demo_form_hub/`),
   its entry points at these same links, so it needs no change.

## What the live site is

- The same page Download Payload zips: test deployment, so the thank-you screen has
  Download PDFs / Preview PDFs and the debug menu; there is no sign-in, no saved
  answers, no Stripe and no cart.
- Its PDFs are filled by the dev server's `POST /edit_pdf`, so it has to be opened
  through the dev server, not as a file. The folder still keeps its own copies of
  every PDF so it is complete on its own.
- `CountyLookup/` inside the folder is a copy of `FormWiz GUI/CountyLookup/`, made
  fresh on every run. Never edit it by hand - regenerate the source and rebuild.
- A rebuild replaces the whole folder, but only a folder this process made (it
  holds `live-site.json`); any other folder of the same name is left alone and the
  route says so.

## Where things are

- Route: `POST /api/publish-live-site` in `dev-server.js` (takes `pages: { question, section }`).
- Builder: `live-site-builder.js` at the repo root, loaded into `gui.html`.
- Output: `live-sites/<name>/` - `index.html` (router), `question.html`,
  `section.html`, `generate.css`, `generate2.css`, `logo.png`, `CountyLookup/*.js`,
  the PDFs, `live-site.json`, `README.txt`.
