---
name: site-screenshots
description: 'Use when retaking or adding app screenshots for the project site (gliplog.com), for example after a change to the Today or Progress screen.'
---

# Site screenshots

The project site shows phone screenshots in `site/assets/screens/` of the `gliplog.github.io`
repository, one light and one dark file per screen. They always come from this app's production
build with sample data, never real records.

## Retake the Today and Progress screenshots

1. Check out `Gliplog/gliplog.github.io` next to this repository (`../gliplog.github.io`).
2. Run `make screenshots`. It builds the app, serves it on port 4175, restores a sample backup
   through Settings, and writes `today-` and `progress-` `light.webp` and `dark.webp` into the site. The
   `trials-` images are taken by hand.
   Pass another folder with `node scripts/site-screenshots.mjs <dir>` to review first.
3. Look at all four images. Check that the cards are in the order each tab shows them, that nothing
   covers them, and that the dates read naturally.
4. If the screen changed, update the `alt` text on the `<img>` in the site's `site/index.html`.
5. In the site repository, run `make check`, then commit the images.

## How the script works

`scripts/site-screenshots.mjs` holds everything:

- **Sample data:** a 20-week Wegovy course dated relative to now, so "next dose" text stays true.
- **Loading:** a backup file restored through Settings, the way a user moves data. Restore
  replaces settings, so the backup also accepts the first-run notice and dismisses the install
  hint.
- **Frame:** a 360 x 733 viewport at 1.5x, saved as 540 x 1099 WebP to match the site's phone
  frames.
- **Notifications:** "Ready to use offline" and "Backup restored" are hidden with a style tag.

## Adding another screen

The Progress and trial-comparison images on the site were taken by hand. To script one, add a
step after the restore that opens the screen, waits for its chart by accessible name, and
saves `<screen>-<scheme>.webp`, then add it to this skill. Keep the sample data free of
anything that looks like a real person.
