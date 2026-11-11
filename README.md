# Erdizah Ghodi Al Haidar — portfolio

A static site: plain HTML, CSS and JavaScript, with no build step and no dependencies.
The opening corridor and the city in Contact are drawn on canvases by the scripts in `js/`.

## Structure

```
index.html                    home page: all its content (text, links, projects, experience)
project/
  tb-xray-screening/          one folder per project page -> erdizah.my.id/project/tb-xray-screening/
    index.html
    img/                      that page's images
  mimpi-sang-pemikir/         the puzzle game, with its design document as a PDF beside the page
  proposed-loss/, teliti/, high-5/, rag-cpu-gpu/, kv-cache-eviction/, food-nutrition-calculator/
  _template/index.html        copy this to start a new project page
  index.html                  /project/ itself just sends visitors to the work list on the home page
css/
  base.css                    design tokens (colours, fonts, spacing), reset, page basics
  chrome.css                  fixed interface: header, menu overlay, cursor cube
  hero.css                    the opening: corridor, name, scroll cue, interface toggle, opening shot, loading screen
  sections.css                shared by every section: frame and heading, cube background and lighting,
                              entrances, fact lists, block buttons
  about.css                   About: topic cube
  experience.css              Experience timeline
  work.css                    Selected work tiles and covers, the More projects list
  skills.css                  Skills, certifications, competitions
  contact.css                 Contact links, block city, footer
  project.css                 project pages
js/
  util.js                     shared helpers and state (window.Portfolio); must load first
  menu.js                     the menu overlay, on every page
  selection.js                selected text: the amber highlight that sweeps in, on every page
  corridor.js                 the opening corridor renderer and the jumper (home)
  city.js                     the block city renderer (home)
  main.js                     home page controller: scenes, opening shot, hero name and scroll, picking up the
                              jumper, About cube, loading
  background.js               the cube field behind each section
  reveal.js                   section entrances
  cursor.js                   the cursor cube
tools/
  inline_art.py               redraws the project covers and About-cube faces inside the pages
  covers.py                   cover drawings
  faces.py                    About-cube face drawings
```

Each page lists its stylesheets in page order and its scripts in dependency order; keep those orders.
The home page loads everything. Project pages load `base`, `chrome`, `sections`, `work` and `project` styles
and the `util`, `selection`, `menu`, `background`, `reveal` and `cursor` scripts.

The scripts are classic scripts rather than ES modules, so a page also opens straight from disk. The one-line
script in each `<head>` stays inline on purpose: it marks the page as scripted before anything is drawn, which a
separate file would delay.

## Running it

Serve the folder, so links between pages behave as they will online:

```
python -m http.server 8000
```

and visit http://localhost:8000. Opening `index.html` directly also works, but links to a folder such as
`project/tb-xray-screening/` then show a file listing instead of the page.

## Adding a project page

Every project page is a folder with an `index.html` inside, so its address needs no `.html`:
`project/tb-xray-screening/index.html` is served at `erdizah.my.id/project/tb-xray-screening/`. GitHub Pages and
Netlify redirect the address without the final slash to it; on Vercel, add `{ "trailingSlash": true }` to a
`vercel.json`, because the page's relative paths (`img/...`, `../../css/...`) need that slash.

1. Copy `project/_template/` to `project/your-project-name/`, in lowercase with words joined by hyphens.
   That name becomes the address.
2. Fill in every `[bracketed]` placeholder, including the canonical address in `<head>`, and delete the
   sections you don't need. Put images in an `img/` folder beside it; `.webp` at about 400 px keeps them light.
3. For a cover, write a drawing in `tools/covers.py`, register it in `COVERS`, change `NAME` in the page's
   `<!--cover:NAME-->` marker to that key, and run `python tools/inline_art.py`.
4. On the home page, point that project's "View project" link at `project/your-project-name/`.

Other kinds of pages work the same way: `blog/first-post/index.html` would be served at
`erdizah.my.id/blog/first-post/`. Start from the project template, keep the `../../` in front of the
`css/` and `js/` paths (one `../` per folder level), and keep the header and menu.

## Publishing at erdizah.my.id

Any static host works. On GitHub Pages: push this folder to a repository, enable Pages for the branch, set
`erdizah.my.id` as the custom domain in the Pages settings (it adds a `CNAME` file), and point the domain's DNS
at GitHub as its documentation describes. Netlify and Vercel take the folder as it is and have their own
custom-domain settings.

## Editing

- **Content** lives in the pages themselves. Search for `[` to find what is still to fill in. On the home page:
  the Experience entries, the More projects links (`href="#"`), the certificate links for the competitions, the
  competition name for TELITI and the year of the AWS certification. On the project pages: your part where it
  is marked, and the results and screenshots of the projects still in progress.
- **Work tiles**: a tile's cover turns amber on hover and opens the project when its "View project" link points
  to a page; a tile whose link is still `#` stays as it is.
- **Colours and fonts** are tokens at the top of `css/base.css`. The canvas scenes keep their own palettes:
  `THEME` in `js/corridor.js` and `CITY_MAT` in `js/city.js`.
- **Covers and About-cube faces** are drawn in `tools/covers.py` and `tools/faces.py`. After editing, run
  `python tools/inline_art.py` to write them into every page that uses them.
