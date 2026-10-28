# Isla's Salon

A casual haircut game for phones, tablets and computers. Choose one of nine characters (or change their face, skin,
brows and hair), then wash, colour, cut and style their hair, turn them round to see every side, and take a photo in
the photo booth against five backgrounds: Salon, Beach, City, Forest and Clouds. Everything is drawn in code, there is no server, and once loaded it works offline.

Left and right in the game, the code and these notes are always the player's: the way you see the screen.

## Running it

```
npm install
npm run dev       # play it while editing, at the address shown
npm test          # 275 unit tests
npm run check     # type check
npm run build     # type check, then the finished game in dist/
npm run preview   # try the finished game locally
```

Add `?debug` to the address to expose the game's state as `window.salonDebug` (for automated tests), and `?still` to
switch off the blinking and breathing.

## Putting it on the web

`dist/` is the whole game: plain files, no server code. Any static host works. It uses relative addresses, so it can sit
at the top of a site or in a sub-folder.

- **Netlify or Cloudflare Pages:** build command `npm run build`, publish folder `dist`. The `_headers` file is picked up
  automatically (it keeps the service worker fresh and the hashed files cached for ever).
- **GitHub Pages:** put the project in a repository, choose "GitHub Actions" under Settings > Pages, and the included
  `.github/workflows/pages.yml` builds and publishes it.
- **Anything else:** copy the contents of `dist/` to the web root. It must be served over HTTPS (or localhost) for
  offline play and "add to home screen" to work. Make sure `sw.js`, `index.html` and `manifest.webmanifest` are not cached
  for long, so a new version reaches people.

Offline play: the first visit stores the whole game in the browser (under 1 MB), after which it opens with no network.
A new build replaces the stored copy the next time the page is opened with a connection.

The page has a strict content security policy: it can only load its own files, and the game makes no network requests of
its own. It collects nothing.

## Browser support

Built for iOS and iPadOS Safari 15.4 or later, Chrome and Edge 90 or later, Firefox 90 or later, and Android browsers
of the same era. It draws with WebGL, falls back to a plain canvas without it, and shows a message if neither works.

## Checking it on real devices

Automated checks ran in Chromium with phone, tablet and desktop emulation. Firefox and Safari were not available to the
automated tests, so before a public launch, open it on a real iPhone and in Firefox and try:

1. Each of the six stages (Character, Wash, Colour, Cut, Style, Photo booth): the controls respond to touch, and holding "Hold for water" keeps the water running.
2. Rotate through all four views, and take a photo in each, on every background. On iPhone the share sheet should open; choose "Save Image".
3. Turn the phone to landscape, and back: nothing should be cut off.
4. Start over (two taps) and mute, reload: the sound setting is remembered.
5. Switch to aeroplane mode and reload: the game still opens and plays.
6. Add it to the home screen: it should open full screen with Isla's icon.

## Layout

- `src/` the game: `state.ts` (everything the game remembers), `render/` (drawing: hair, character, backdrops, effects),
  `*.svelte` (the control panels), `audio.ts` (all sound, made in the browser), `photo.ts` (saving the photo)
- `public/` icons, install manifest and hosting headers
- `docs/style-guide.md` how everything should look and behave
- `plan.md` the development plan and what was built at each stage
