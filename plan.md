# Isla's Salon: Development Plan

Based on `intent.md`. Decisions below were confirmed by the owner.

## Status

| Stage | State |
|---|---|
| 0 Foundations | Done and approved |
| 1 Procedural character, four views, backdrops | Done and approved |
| 2 Colouring | Done (feedback applied; you asked to move on) |
| 3 Cutting | **Built, awaiting your feedback** |
| 4 to 7 | Not started |

Stage 2 notes (decisions made while building):
- Colouring has three modes: one colour, left and right (as you see Isla from the front: Left is the screen-left), and ombre (roots to tips).
- The chooser has 11 quick-pick swatches (natural shades first, then vibrant), a mixer with hue, vividness and lightness sliders, and the device's own colour picker. Every control is at least 44px and has an accessible name.
- Switching to left and right or ombre while both colours are still the same fills the second colour with a contrasting one, so the change shows immediately. Going back to one colour remembers the second colour.
- Ombre is drawn in flat bands to keep the cel-shaded look, measured along each lock so both colours show at every length. Blends go round the hue circle (blonde to purple passes through orange and pink, not grey).
- Feedback applied: Left/Right labelled as the player sees them, ombre unchanged, and every colour change fades in over one second (instant with reduced motion).
- Checked by measuring the rendered pixels for every length and view (72 cases: split on the correct side, ombre running roots to tips, single staying single), a frame-stepped check of the one-second fade, plus a 60-point test of the chooser driven by touch on phone-sized screens.

Stage 3 notes (decisions made while building):
- Cutting has a region row (All, Front, Left, Right, Back) and six length buttons (Long, Shoulder, Bob, Short, Shorter, Crop), each with a little head showing the length. Tapping her head or hair also picks the region. Every button is at least 44px.
- **Left and right regions are as you see Isla from the front**, the same as the colour chooser (my choice, as you asked for consistency in Stage 2; easy to flip). The 'left' and 'right' views still name Isla's own sides, so the left view shows the Right region.
- Pressing a length cuts at once in the data, then scissors snip twice and the hair drops, with clippings in the hair's tip colour falling off the cut. Going longer needs no scissors: it grows with a soft chime. Reduced motion skips the animation. Mashing buttons ends on the last length.
- Sound is made with Web Audio (no files): a snip and a grow chime, both respecting the mute button.
- A white dot marks the end of each visible lock in the chosen region, so you can see what you are about to cut. If the region faces away, the panel says to turn Isla round.
- Seams between regions already blend smoothly (the reach grades between region lengths), so mixed cuts such as a long Left with a cropped Right read as one haircut.
- Checked in a real browser: controls, tap-to-select in every view, the snip stepped through by exact time (hair intact until the second snip, gone after), reduced motion, growing, and button mashing; plus a contact sheet of mixed cuts from all four views.

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
| 3 | Rotate button cycling front, left, back, right views (v1) |
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
- **Curl** perturbs the strand curve (amplitude and frequency); **spiky** biases tips upward and tightens clumps; **flat** pulls strands against the scalp and reduces volume.
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
- Interaction rules with length (e.g. spiky reads best on short cuts; defined behaviour for long hair)
- **Done when:** curl, product and length combinations all render acceptably in all views.

### Stage 6: Photo export and polish
- Camera button: hide UI, render head and shoulders on the salon backdrop at fixed export resolution (current view), download PNG; Web Share fallback where downloads are unreliable (iOS)
- Export framing: fixed crop and aspect ratio (e.g. 4:5) so the result is consistent across screen sizes
- Idle animation (blink, breathing), transitions, sound effect polish, mute toggle
- Reduced-motion mode, accessibility pass, performance pass on low-end phones
- Reset button

### Stage 7: Release
- Cross-device and cross-browser testing
- Optional service worker for offline play
- Deploy to a static host

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
- Salon backdrop colour scheme and exact shelf contents; I'll propose a palette and prop list in Stage 1 unless you have a preference.
- Since the character is a young child, keep all content and framing strictly wholesome (assumed; no changes requested).
