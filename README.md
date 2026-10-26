# 3R Motivational TV Slideshow

Static GitHub Pages slideshow of the 3R motivational posters in `assets/slides/` (currently 29 optimized JPGs, about 8 MB).

## Publish on GitHub Pages

The TV opens a normal static site. It does not call the GitHub API. On every push, the **Slideshow** workflow rewrites `slides.js` from `assets/slides/` and, when Pages is set to GitHub Actions, publishes that site.

1. Push this folder to the repository's default branch.
2. In GitHub: **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open the Pages URL on the TV browser. This repository is published at <https://ross680.github.io/Motivational-Board/>.

Leave the source on **GitHub Actions**. A branch deploy does not rebuild when this workflow pushes the updated `slides.js`, because GitHub does not run Pages for a commit made with the Actions token. The workflow publishes the static files itself, including the new poster list, on the same push that added the file.

## Controls
- Auto-rotates every 18 seconds.
- Right Arrow or Space: next
- Left Arrow: previous
- `P`: pause/resume
- `F`: fullscreen
- Hover to show controls and slide count.

## URL options
- `?seconds=25` changes the slide duration to 25 seconds.
- `?shuffle=1` randomizes the order at page load.
- `?reload=4` reloads the page every 4 hours (default) so new posters appear on the TV automatically.
- `?loadms=20000` is how long to wait for a poster before skipping it (default 20 seconds).
- A poster that does not load is skipped until that reload. One bad file does not stop the board or get retried on every pass.
- Combine them: `?seconds=25&shuffle=1`

## Add or remove a poster

1. Put a 16:9 image in `assets/slides/` (JPG, JPEG, PNG, WEBP, or GIF; 1920×1080 works well). Files play in numeric filename order, so name the next one `30-your-title.jpg`.
2. To take a poster off the board, delete that file and leave the others in place.
3. Commit and push.

Do not edit `slides.js` by hand. The next push overwrites it from the folder. To refresh the list locally before you push:

```bash
node scripts/generate-slides.js
```
