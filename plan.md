# Isla's Salon: Development Plan

Based on `intent.md`. Decisions below were confirmed by the owner.

**Convention: every "left" and "right" in the game, the code and these docs is from the player's perspective** (the way they see the screen), never Isla's own sides. Left is the half of the picture on the screen-left when Isla faces the player. This covers the colour chooser, the cutting regions and the left and right views.

## Status

| Stage | State |
|---|---|
| 0 Foundations | Done and approved |
| 1 Procedural character, four views, backdrops | Done and approved |
| 2 Colouring | Done (feedback applied; you asked to move on) |
| 3 Cutting | Done (you asked to move on) |
| 4 Washing | Done (you asked to move on) |
| 5 Styling | Done (you asked to move on) |
| 6 Photo export and polish | Done (you asked to move on) |
| 7 Release | Built and release-ready; host chosen: Cloudflare Pages (you have an account); going live needs you to connect it (see below) |
| Version 1 fixes | **F1, F3, F4 and F5 done; F2 and F6 planned, not started** (checklist F1 to F6 in section 6, after the enhancements) |
| Open bug | Stray lines on mobile Chrome and Firefox (fan from the top-left of the picture on every stage); not yet diagnosed. The latest source was lost; work restarted from the Stage 7 source (see "Rebuilding the enhancements") |
| Version 1 enhancements | **Being rebuilt on the Stage 7 source: 8 of 9 rebuilt** (the version you deployed has all nine) (checklist in section 6, after Stage 7) |

Stage 2 notes (decisions made while building):
- Colouring has three modes: one colour, left and right (as you see Isla from the front: Left is the screen-left), and ombre (roots to tips).
- The chooser has 11 quick-pick swatches (natural shades first, then vibrant), a mixer with hue, vividness and lightness sliders, and the device's own colour picker. Every control is at least 44px and has an accessible name.
- Switching to left and right or ombre while both colours are still the same fills the second colour with a contrasting one, so the change shows immediately. Going back to one colour remembers the second colour.
- Ombre is drawn in flat bands to keep the cel-shaded look, measured along each lock so both colours show at every length. Blends go round the hue circle (blonde to purple passes through orange and pink, not grey).
- Feedback applied: Left/Right labelled as the player sees them, ombre unchanged, and every colour change fades in over one second (instant with reduced motion).
- Checked by measuring the rendered pixels for every length and view (72 cases: split on the correct side, ombre running roots to tips, single staying single), a frame-stepped check of the one-second fade, plus a 60-point test of the chooser driven by touch on phone-sized screens.

Stage 3 notes (decisions made while building):
- Cutting has a region row (All, Front, Left, Right, Back) and six length buttons (Long, Shoulder, Bob, Short, Shorter, Crop), each with a little head showing the length. Tapping her head or hair also picks the region. Every button is at least 44px.
- **Left and right are the player's**, the same as the colour chooser: Left is the screen-left side of the front view. The 'left' and 'right' views follow the same rule (see the convention at the top), so the left view shows the Left region face on.
- Pressing a length cuts at once in the data, then scissors snip twice and the hair drops, with clippings in the hair's tip colour falling off the cut. Going longer needs no scissors: it grows with a soft chime. Reduced motion skips the animation. Mashing buttons ends on the last length.
- Sound is made with Web Audio (no files): a snip and a grow chime, both respecting the mute button.
- A white dot marks the end of each visible lock in the chosen region, so you can see what you are about to cut. If the region faces away, the panel says to turn Isla round.
- Seams between regions already blend smoothly (the reach grades between region lengths), so mixed cuts such as a long Left with a cropped Right read as one haircut.
- Checked in a real browser: controls, tap-to-select in every view, the snip stepped through by exact time (hair intact until the second snip, gone after), reduced motion, growing, and button mashing; plus a contact sheet of mixed cuts from all four views.

Stage 7 notes (what is built):
- **Offline play**: a service worker is generated at build time (`sw.js`), listing every file of that build and a hash of their contents. The first visit stores the game (about 0.8 MB); after that it opens and plays with no network, including the camera. A new build gets its own copy and the old one is deleted. Tested by going offline in a real browser: reload, play, take a photo, open a fresh tab.
- **Installable**: icon (Isla's face with scissors, drawn as an SVG and made into 192, 512, maskable and Apple touch PNGs), web manifest and home-screen meta tags, so it opens full screen when added to a phone's home screen.
- **Nothing leaves the page**: a strict content security policy (own files only, no outside scripts, fonts, images or connections). A request audit of a full session shows every request went to the game's own server. To work under that policy the graphics library runs in its policy-safe mode. No analytics, no tracking, no network calls.
- **Every screen**: tested in Chromium emulating iPhone SE, iPhone 13 (portrait and landscape), Pixel 7, Galaxy S9+, iPad (portrait and landscape), a tiny 320 x 480 screen, a short wide phone and a 1440 x 900 desktop: no page scrolling, no buttons off screen, controls inside the panel reachable. Found and fixed: on short pictures the four round buttons ran off the bottom; they now start a second column. Older browsers get a fallback for the new viewport-height units.
- **Graphics fallback**: without WebGL the game falls back to a plain canvas and still plays, camera included (checked). If nothing can draw at all, a clear message appears instead of a blank page.
- **iPhone saving**: with an iPhone's identity and a simulated share sheet, the photo goes to the share sheet as a PNG and the message says it is ready to save. Not yet tried on a real iPhone.
- **Hosting files**: `README.md` (running, building, hosting, browser support, a real-device checklist), `public/_headers` for Netlify and Cloudflare Pages, and `.github/workflows/pages.yml` for GitHub Pages.
- **Not done, needs you**: you chose Cloudflare Pages. Deploying needs your Cloudflare account (I have no access to it): upload `dist/` or connect the repository; `public/_headers` already suits it. Firefox and Safari were not available to the automated tests; the README's real-device checklist covers them.
- All earlier checks still pass on the final build (157 unit tests, colour 72 cases, cutting, styling, washing, fade, photo and accessibility audit with zero problems).

Stage 6 notes (what is built):
- **Camera button**: takes a photo of Isla and the salon backdrop in the current view, head and shoulders in the black gown, with no buttons, markers, scissors or messages in it. Always 1080 x 1350 (4:5) whatever the screen size or orientation, and named for the view and time (for example isla-front-2026-10-21-0730.png). It plays a flash and shutter sound, downloads the file, and shows a short "Photo saved" message. On iPhones and iPads it opens the share sheet instead (the dependable way to save a picture there), falling back to a download if sharing fails.
- **Start over** button (recycle icon): two taps, so a stray touch can't wipe the hair. It puts hair, colour, cut, style and washing back to the start at once (no scissors or fades) and keeps your stage, view and sound setting.
- **Idle life**: she blinks every few seconds and breathes with a gentle lift. Both stop with reduced motion.
- **Sound**: shutter, plus the existing snip, boing, spray, water and foam sounds. The mute choice is now remembered between visits. All sound is synthesised, no files.
- **Reduced motion**: no idle animation, no flash, instant colour, cut, style and view changes.
- **Accessibility**: an automated audit (axe, WCAG 2 A and AA plus best practice) finds no problems on any stage. Fixed this stage: a hidden page heading, a darker pink for small text, and pinch-zoom is no longer blocked (double-tap zoom still is). Every control is at least 44px with an accessible name.
- **Performance**: the picture is only redrawn when something changes. An idle salon draws about 8 frames a second (mostly the breathing) instead of 60, and none at all with reduced motion. Rebuilding Isla takes about 1.5 ms on the test machine. The whole app is about 130 KB compressed.
- Checked in a real browser: the photo (size, name, content, no interface in it, same size in landscape, other views), start over, remembered mute, blink, idle cost, reduced motion; plus the accessibility audit and every earlier check. Test pages can add ?still to freeze the idle animation.

Stage 5 notes (what is built):
- Styling has a Curl row (Straight, Waves, Curls, Tight curls, each with a little head showing the waviness) and a Product row (None, Spiky, Flat). One product at a time; curl and product combine freely. Every button is at least 44px.
- Curl swings each lock side to side and in and out, so the outline ripples in every view; tighter curl waves faster and wider, fills the hair out a little, and lifts it so curled hair hangs slightly shorter than straight.
- Spiky (reworked in version 1 enhancement 9) grows real spikes that stick up and out from the scalp, in three rings (crown, upper and mid head), 31 in all. Each spike's length follows the hair length at that part of the head, from short stubs on a crop to long spikes on long hair, and each part of the head follows its own length. The hair that lies on the head is cut back to a short cap round it while gel is on, and the spikes grow out of the head as the look eases in.
- Flat presses the hair thin and sleek against the head, removes the natural wave and most (85%) of the curl, so tight curls with flat product come out only gently wavy.
- Changes ease in over 0.6 seconds (instant with reduced motion). Curling plays a burst of stars and a boing; product plays a puff of mist and a spray hiss (flat adds a soft pat). Sounds are Web Audio, no files, and respect mute.
- Styling survives cutting and colouring: the cut stage keeps curl and product, and the scissors still work on styled hair.
- Checked: styled hair never covers the eyes, brows or cheeks for all 1,296 cuts under six looks (including in-between looks mid-change); every sample stays finite and inside the picture; a browser check of the panel, the morph stepped by exact time, product exclusivity, reduced motion, and cuts on styled hair; plus contact sheets of every look at short, bob and long lengths from all four views. All earlier checks still pass.

Stage 4 notes (what is built):
- Washing has a Temperature slider (Cold, Warm, Hot), a Water tap slider (Off, Gentle, Medium, Strong) that matches the wall tap, a product row (Mint, Citrus, Tropical, Conditioner) and a "Squirt" button for the chosen product (this changed in version 1 enhancements 4, 6 and 7). Every control is at least 44px.
- The sink scene is interactive too: tap a bottle on the wall shelf to choose it, or press the wall dial and drag up for hotter, down for colder.
- Holding uses Pointer Events with capture, so sliding off the button keeps the press; a cancelled touch, the long-press menu, losing focus, hiding the page or leaving the stage all let go. Space and Enter work for keyboards.
- Hair responds in a simple model: water soaks it (faster under higher pressure) and rinses lather and cream away; shampoo builds lather, quicker on wet hair, and cleans; conditioner builds cream and silkiness, which rinsing keeps. Clean, silky, rinsed hair sparkles.
- Animations: a water stream (more streaks, faster and wider with pressure), chill and frost when cold, steam when hot, splashes and drips, lather bubble by bubble in a colour of its own for each shampoo (mint green with leaves, citrus yellow with droplets, tropical pink with petals), and a soft cream for the conditioner.
- Sound (Web Audio, no files): running water that follows the pressure, fizzing foam and a soft conditioner bubble, all muted by the mute button.
- The washed state (wet, clean, silky) is saved with the hair, so later stages see it.
- Checked in a real browser: controls, holds by mouse, keyboard and cancelled touch, a full soak, lather for each shampoo, rinse, conditioner, rinse and sparkle, both temperature controls, the dial, bottle taps, and the water stopping when you leave the stage. The three lathers measure as three different colours.

Stage 1 notes (decisions made while building):
- Hair is 24 locks hanging from the scalp, projected for any view angle; the same model will carry colour, curl and product later.
- Long front hair is swept behind the cheeks so the eyes, brows, cheeks and mouth are never covered (tested for all 1,296 region/length combinations). Short front lengths are fringes that stop above the brows.
- Short cuts finish lower at the nape than at the temples, so the hairline tapers instead of running level round the head.
- Style rules are in `docs/style-guide.md`. Opening the app with `?debug` exposes the store for automated checks; normal visitors are unaffected.

## 1. Product summary

A browser-based, offline-capable, single-player sandbox game simulating a salon visit. A head-and-shoulders character (v1: **Isla, a six-year-old blonde girl**) sits centre screen. A stage switch (Wash / Colour / Cut / Style) changes the control panel. A rotate button cycles four views (front, left, back, right). A camera button downloads a clean image of the character with no UI. Visual style is cel-shaded cartoon with vibrant colours.

## 2. Confirmed decisions

| # | Decision |
|---|---|
| 1 | 2D rendering |
| 2 | Procedural vector art (all art generated in code, no hand-drawn asset pipeline) |
| 3 | Rotate button cycling front, left, back, right views (v1). Left and right are the player's, so the left view shows the side of her head that was on the player's left in the front view |
| 4 | Mobile is a target: touch-first, no hover, no right-click, no keyboard required |
| 5 | Pure sandbox: no goals, scoring or network functions |
| 6 | v1 has one fixed character, Isla; architecture must allow more characters later |
| 7 | Camera-icon button downloads an image with all UI hidden; image shows head and shoulders on the salon backdrop |
| 10 | Isla wears a black hairdresser's gown covering all other clothing (the only clothing to draw) |
| 8 | Sound effects, no music |
| 9 | Stack chosen by me (below) |

## 3. Technology stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Safety for a state-heavy game |
| Build | Vite | Fast dev, static output |
| Rendering | **PixiJS v8** (WebGL with Canvas fallback) | Fast 2D, built-in Graphics, masks, filters, ticker; handles hundreds of animated particles on phones |
| UI | **Svelte 5** DOM overlay | Small bundle, reactive stores suit the state model, accessible native controls (sliders, buttons) |
| State | Svelte stores holding a single typed `SalonState` | One source of truth; renderer subscribes |
| Animation | Pixi ticker plus **GSAP** (core only) | Tweens for curl, rotation, snips, foam |
| Procedural art | Parametric shape generators (bezier paths, seeded noise) in TypeScript | Meets the procedural vector art requirement; deterministic per-character via seed |
| Audio | **Web Audio API** (synthesised effects), with optional small compressed samples | Tiny payload, no licensing; needs unlock on first tap for iOS |
| Input | Pointer Events with `touch-action: none` on hold buttons | Unified touch and mouse; hold-to-apply with pointer capture and cancel handling |
| Image export | `renderer.extract` to canvas, then `toBlob`, then download (Web Share API fallback on iOS) | Clean render with UI excluded |
| Testing | Vitest (state and geometry), Playwright (mobile viewport smoke tests) | Core logic is pure |
| Hosting | Static host; optional service worker for offline play | No backend, no analytics, no network calls at runtime |

### Non-functional requirements
- Current Chrome, Safari (iOS 16+), Firefox, Edge; phones, tablets, desktop
- Portrait and landscape layouts; controls at least 44px, no hover-dependent UI
- 60fps target on mid-range phones; bundle under about 500KB gzipped
- No network requests after load; no accounts, tracking or personal data
- Respects `prefers-reduced-motion`; sound mute toggle (default on, unlocks on first tap)
- Accessible labels on all controls; sufficient colour contrast

## 4. Key technical approach: procedural hair viewable from four angles

Because hair must look right from front, left, back and right, hair is modelled **semi-3D** and drawn flat:

- Hair is a set of **strands/locks** defined in head-space by azimuth (angle around the head), root height and length. A strand is a 3D curve (root on the scalp ellipsoid, then falling and curling under a simple rule set).
- A view angle (0°, 90°, 180°, 270°) is an orthographic projection of those curves into 2D. Locks are sorted by depth, drawn as filled, outlined bezier ribbons with a hard-edged shadow band (cel shading).
- **Regions** (front, left, right, back) are azimuth sectors. Each region has its own length setting, with blended seams between sectors to avoid visible steps.
- **Colour**: single = one fill; split = chosen by the strand's side (left/right in head-space, so it stays correct as the view rotates); ombre = gradient along strand length from root colour to tip colour.
- **Curl** perturbs the strand curve (amplitude and frequency); **spiky** grows separate spikes from the scalp, up and out, with length following the hair length; **flat** pulls strands against the scalp and thins them.
- **Washing** is a layered effect: wet (darker, flatter, droopy) versus dry, foam particles, rinse streams.
- The rotate button animates between views (quick swing, then snap to the cardinal angle). Rendering uses continuous angle internally, so the transition costs nothing extra.
- Head, face, ears, neck, shoulders and the **black hairdresser's gown** (collar, cape-style drape with cel-shaded folds, no other clothing visible) are also procedural with the same four-view projection (face visible only in the front and partially in the side views, back of the head otherwise).
- The gown also receives cosmetic effects: foam and water droplets land on it during washing, and cut hair clippings fall onto it (clippings are visible against the black, so use light/hair-coloured fragments).
- The **salon backdrop** is a procedural layer behind the character with two scenes, switched by stage; it stays fixed or shifts subtly with the view so rotation reads clearly:
  - **Washing stage:** the shampoo sink/basin (positioned so water, foam and rinse effects line up with Isla's head) with a few potted plants around it.
  - **Colour, Cut and Style stages:** a salon mirror, plus a shelf holding the usual hairdressing tools (scissors, comb, brush, hairdryer, spray bottle, clips, colour bowl and brush, razor/clippers), and more potted plants.
  - Each scene is built from small reusable procedural props (plant, pot, bottle, tool) so variety comes from parameters and seeds, not extra art. Props share the same outline weight and cel-shaded style as the character.
  - Switching stages cross-fades or slides between scenes (skipped under reduced motion), and the camera export captures whichever scene is currently showing.

Characters are data (`CharacterDef`: skin tone, eye style, head proportions, base hair colour, seed), so later characters are additional definitions rather than new code.

## 5. Data model

```ts
type Stage = 'wash' | 'colour' | 'cut' | 'style';
type View = 'front' | 'left' | 'back' | 'right';
type Length = 'back' | 'shoulders' | 'bob' | 'short1' | 'short2' | 'short3';
type Region = 'front' | 'left' | 'right' | 'back';

interface SalonState {
  character: CharacterDef;            // v1: Isla
  stage: Stage;
  view: View;
  hair: {
    wetness: number;                  // 0..1
    cleanliness: number;              // 0..1
    conditioned: number;              // 0..1
    colour: { mode: 'single' | 'split' | 'ombre'; a: string; b: string };
    length: Record<Region, Length>;
    curl: 0 | 1 | 2 | 3;
    product: 'none' | 'spiky' | 'flat';
  };
  wash: { temperature: number; pressure: number; shampoo: 'mint' | 'citrus' | 'tropical'; conditioner: boolean };
  audio: { muted: boolean };
}
```

The renderer is a pure function of `SalonState` plus transient animation state (droplets, foam, tweens).

## 6. Development stages

### Stage 0: Foundations
- Vite, TypeScript, Svelte, PixiJS, ESLint/Prettier, Vitest, CI
- Responsive layout: canvas stage with DOM overlay, portrait and landscape
- Stage switcher, rotate button, camera button, mute button (non-functional shells)
- **Done when:** the app loads on a phone and desktop, with stages switching.

### Stage 1: Procedural character and four-view rendering (de-risking spike)
- Cel-shading style guide: palette, outline weight, shadow band rules
- Procedural Isla: head, face, ears, neck, shoulders, black hairdresser's gown, in four views
- Procedural salon backdrop layer, both scenes: sink with potted plants (wash), and mirror with tool shelf and potted plants (colour, cut, style)
- Reusable procedural prop generators (plants, pots, bottles, scissors, comb, brush, hairdryer, clips, clippers)
- Strand-based hair model with projection, depth sorting, outlines and cel shadow
- Rotate button with swing animation
- **Done when:** Isla's default blonde hair looks right and consistent from all four views, and you approve the look.

### Stage 2: Colouring
- Colour chooser: touch-friendly swatches plus custom picker (native `<input type="color">` plus own hue/lightness control for consistent mobile behaviour)
- Single, left/right split, ombre; correct in all four views
- **Done when:** all modes render correctly at every length and view.

### Stage 3: Cutting
- Region selector (front, left, right, back) plus six-step length control; region can also be selected by tapping the head
- Snip animation and sound; clipped hair falls
- Seam blending between regions
- **Done when:** all region and length combinations look coherent from all views.

### Stage 4: Washing
- Controls: temperature, pressure, shampoo (mint/citrus/tropical), conditioner
- Hold-to-apply buttons using Pointer Events with capture, cancel and context-menu suppression
- Animations: water stream (pressure), steam or chill tint (temperature), scented foam with distinct colours/particles per shampoo, rinse, conditioner sheen
- Sound: water, foam, rinse
- **Done when:** a full wash, shampoo, rinse and condition cycle plays smoothly on a phone.

### Stage 5: Styling
- Curl strengths (four levels including none), spiky and very flat product application
- Interaction rules with length (spiky spike length follows the hair length; see enhancement 9)
- **Done when:** curl, product and length combinations all render acceptably in all views.

### Stage 6: Photo export and polish
- Camera button: hide UI, render head and shoulders on the salon backdrop at fixed export resolution (current view), download PNG; Web Share fallback where downloads are unreliable (iOS)
- Export framing: fixed crop and aspect ratio (e.g. 4:5) so the result is consistent across screen sizes
- Idle animation (blink, breathing), transitions, sound effect polish, mute toggle
- Reduced-motion mode, accessibility pass, performance pass on low-end phones
- Reset button

### Stage 7: Release
- Cross-device and cross-browser testing (done in Chromium emulation; real Firefox and Safari still to check by hand)
- Service worker for offline play (done)
- Deploy to a static host (ready; host chosen: Cloudflare Pages; waiting for the owner to deploy from their account)

### Rebuilding the enhancements

The source with enhancements 1 to 9 was lost, so they are being redone, one at a time, from the Stage 7 source (the deployed build has all nine). Rebuilt so far: **1, 2, 3, 4, 5, 6, 7, 8**. The tick boxes and "Done:" notes below describe the deployed version; the list here says which are back in the source. The fixes below are not started.

### Version 1 enhancements (all built in the deployed version)

A checklist of changes requested after the first build. Tick each box when it is built and checked.

**Overall**
- [x] 1. When switching stages, slide the background in from the side. Done (rebuilt in the source): the new backdrop pans in while the old one slides out, in 0.45 s, from the right when moving forward through the tabs (Washing, Colouring, Cutting, Styling) and from the left when moving back. Isla stays put. It is off with reduced motion.

**Washing stage**
- [x] 2. Make the shampoo and conditioner bottles larger, so they are obviously things to tap. Mint has a mint leaf on its label, citrus an orange segment, tropical a pineapple. Done (rebuilt in the source): bottles are 1.5 times bigger, with those three pictures (the conditioner keeps its heart), wider shelves and larger tap targets.
- [x] 3. Enlarge the temperature control by 50%. Done (rebuilt in the source; it moved slightly left and up so the plant does not cover it): the wall dial is 1.5 times bigger, with a bigger target.
- [x] 4. Add a tap next to the temperature control that controls the water pressure. It works like a real tap: the lowest setting is off, then low pressure rising to high pressure. Done (rebuilt in the source; the old towel shelf is gone, and where the tap and dial targets overlap the nearer one wins): a tap with a turning cross handle sits just above the dial; drag up for more pressure, drag right down to snap it off. Pressure still has its panel slider (which reads Off at zero). With the tap off, holding the water button gives no water and the button reads "Tap is off". Item 7 will make the tap stay on by itself.
- [x] 5. Water hotter than warm: keep the steam, and turn the character more pink; the hottest water makes her look a bit annoyed. Cold water: keep the ice effect, and turn her more blue. The facial colour change fades slowly back to normal over three seconds. Done (rebuilt in the source): while the water runs her skin goes pink above warm (more so as it gets hotter), the hottest water also slants her brows and turns her smile into a frown, and cold water turns her blue, in about a second. When the water stops, or is changed to a gentler setting, the colour and expression fade back to normal over three seconds. The fade carries on if you switch stage.
- [x] 6. Applying shampoo or conditioner shows as a blob on top of her head, fading into the hair over a second, with a "squirting" sound. Only when the user swipes back and forth across the hair (or clicks and drags) does the bubbles effect from before play, with a "foamy" sound. She shuts her eyes for this. Done (rebuilt in the source): the product button is now "Squirt (product)", a tap. It pops a blob in the product's colour onto her crown, which sinks into the hair over one second, with a new wet "pfft-pt" squirt sound. Lather only appears while the user swipes back and forth (or drags) across her hair, and only while there is product on it: one squirt is worth about two thirds of a full lather, so squirt again to keep going. The bubbles, scent leaves and sparkles from before play while rubbing, with a new foamy sound (a squelchy rub with many small bursting bubbles and the odd gloop) that follows how hard the hair is being rubbed. Her eyes close from the squirt until half a second after the rubbing stops. A hint line in the panel explains it. The sounds were built from the Web Audio code and could not be listened to here, so please check how they sound.
- [x] 7. When the water tap is on it stays on until turned off (the pressure tap in item 4 is the on/off control: off at its lowest setting). When the user swipes, the shower nozzle moves back and forth with the finger too. She closes her eyes for this as well. Done (rebuilt in the source): the water runs whenever the tap (wall tap or panel slider) is above off, and stops the moment it is turned back to off, with no button involved; the tap starts off, and moving to another stage turns it off. The "Hold for water" button was removed. Swiping across her hair moves the shower nozzle back and forth with the finger (the stream and splashes follow), and it eases back to its place afterwards. She closes her eyes while the water runs.

**Cutting stage**
- [x] 8. Choosing a hair length does not cut at once. It waits for the user to swipe back and forth across the hair, and the hair moves to the new length over 8 swipes. Done (rebuilt in the source): tapping a length now only queues it (the hair does not change). Once a length is chosen, swiping back and forth across her hair (or click and drag) moves it an eighth of the way each time, smoothly rather than in jumps, and the cut finishes on the eighth swipe. A swipe is a pass of about a finger's width or more in one direction; turning back starts the next one, and small wiggles do not count. Each swipe snips the scissors (or chimes when the hair is growing) and drops clippings. The panel shows eight progress pips and a Snip button that counts as one swipe, for anyone who cannot swipe. Choosing another length part-way carries on from where the hair has got to, and the parts already heading somewhere keep going. A plain tap on her head still chooses a part, and the choice is kept if you move to another stage.

**Styling stage**
- [x] 9. The spiky style is wrong. Spiky hair sticks up and out from the head, according to the length of the hair. Done: see the Spiky note under Stage 5. The old crown tufts and flicked ends are gone.

### Version 1 fixes (F1, F3, F4 and F5 done; the rest planned, not started)

A second checklist, from testing the enhancements. Nothing here is implemented yet, and none will be until the owner asks. Tick each box when it is built and checked.

**Washing stage**
- [x] F1. When the water is off, swiping across her hair does not move the shower head. Done: the shower head only follows a swiping finger while the tap is on; with the tap off it stays at her crown however much you swipe (rubbing product in still works). Checked in a browser by comparing the sprayer's part of the picture during a swipe with the tap off (no change) and on (it moves).
- [ ] F2. Coming back to the washing stage, her hair shows as dry even if it was wet when she left, and there is no drip animation.
- [x] F3. Conditioner: after it is squirted on, swiping no longer shows the cream effect. Instead her hair turns a lighter and lighter shade, reaching its lightest after 8 swipes. Done: the cream blobs and the bloop sound are gone. Each swipe across her hair at the sink with conditioner squirted on lightens it a step (an eighth of the way to a pale tint of its own colour, so split and ombre colours stay split and ombre), easing smoothly, and uses an eighth of the squirt: one squirt lasts exactly the 8 swipes, then more swipes do nothing until you squirt again. The hair also gets silkier with each swipe. The lightness stays until water rinses it off (the rinse rate is unchanged until fix F4), and shows at the sink only, like wet hair. Swiping while the water runs rinses instead. Checked in a browser: eight steady steps lighter, nothing on the 9th and 10th swipe, and the water bringing the level back to zero while the silkiness stays.
- [x] F4. Washing removes the lather or the conditioner effect faster at higher water pressure. Done: the rinse speed rises evenly from 1 times at the lowest setting above off to 3 times at full pressure (the strongest water is exactly three times faster; the gentlest still rinses steadily). Lather clears in about 5 seconds at the gentlest and 1.7 at full pressure; conditioner lightness in about 7 and 2.4. Checked in a browser by timing both from full cover.

**Cutting stage**
- [x] F5. When cutting to a longer length from a shorter one, the swipes show a magic wand instead of the scissors, with a sparkly sound instead of the snip. (The owner chose a magic wand in place of the original glue pot.) Done: a swipe where every changing part is getting longer shows a star-tipped wand that sweeps in beside the most visible growing part, waves twice and sends up a fountain of little stars, with a rising run of bell notes (`playSparkle`) and no snip. As soon as any part is getting shorter the scissors, clippings and snip play instead (never both). The choice is the tested rule `toolFor` in cut.ts. With reduced motion only the sound plays. The old plain chime is gone. Checked in a browser: wand on a lengthening swipe, scissors on a shortening one. The sparkle sound can't be heard here, so the owner should listen to it.

**Whole game**
- [ ] F6. The little white dots at the ends of the hair strands are not shown. (They are the cut-region markers described in the Stage 3 notes; remove them everywhere, and update those notes when built.)

### Later versions (not in scope for v1, but architecture-ready)
- Additional characters via `CharacterDef`
- Smooth drag-to-rotate in addition to the four-view button

## 7. Risks

| Risk | Mitigation |
|---|---|
| Procedural hair looking crude or inconsistent across views | Stage 1 spike gates all later work; tune the strand model before building features |
| Region seams (e.g. bob next to shoulder-length) looking jagged | Blend lengths across azimuth; test all pairings |
| Performance with many strands plus particles on phones | Strand count budget, cached geometry per state, pooled particles, 60fps testing early |
| iOS audio and download quirks | Unlock audio on first tap; Web Share fallback; test on real iOS Safari |
| Hold-to-apply conflicting with touch gestures | `touch-action: none`, pointer capture, suppress context menu and text selection |

## 8. Remaining open questions
- Fixes, to settle when they are built (none blocks the checklist):
  - Fix F2: should coming back to the sink also clear any lather or conditioner, or only the wetness and drips? (Assumed: only wetness and drips; the lather and conditioner levels stay, so a lightened head of hair stays lightened until rinsed.)
  - Fix F3: how long does the lightening last, and how light is "lightest"? (Assumed: it stays until water rinses it off, as in F4, and the lightest is a clearly lighter tint of her current hair colour that still works with split and ombre colours. It replaces the cream and bloop effects; the squirt blob stays.)
  - Fix F4: how much faster? (Assumed: roughly three times faster at full pressure than at the gentlest, and still slow but steady at the gentlest.)
  - Fix F6: are the white dots wanted anywhere, for example as a hint of the part being cut? (Assumed: no; they are removed entirely, and the selected region is still shown by the panel and by tapping the head.)
  - Fix F5: when a cut makes some parts longer and others shorter at once, which tool shows? (Assumed: the wand for a swipe where every changing part is getting longer, and scissors as soon as any part is getting shorter.)
- Enhancements, to settle when they are built (none blocks the checklist):
  - Item 3: is "the temperature control" the wall dial only, or the temperature slider in the panel as well? (Assumed: the wall dial, with the panel slider kept alongside.)
  - Item 4: should the new pressure tap replace the pressure slider in the panel, or sit alongside it? (Assumed: alongside, so there is always a non-gesture way to set it. Settled: the tap's lowest setting is off.)
  - Items 6 and 7 (settled): the "Hold for water" button is gone, because the tap's lowest setting is off; the product button became a "Squirt" tap.
  - Item 8: do swipes count in either direction (one back-and-forth is two swipes), and can the player grow the hair back longer the same way? (Assumed: each stroke in a direction counts as one, and longer lengths use the same eight strokes.)
- Salon backdrop colour scheme and exact shelf contents; I'll propose a palette and prop list in Stage 1 unless you have a preference.
- Since the character is a young child, keep all content and framing strictly wholesome (assumed; no changes requested).
