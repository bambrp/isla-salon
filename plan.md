# Isla's Salon: Development Plan

Based on `intent.md`. Decisions below were confirmed by the owner. Version 1 is built and described as it now behaves (all enhancements and fixes are folded in). Version 2.0 is planned in section 9 and not started.

**Convention: every "left" and "right" in the game, the code and these docs is from the player's perspective** (the way they see the screen), never the character's own sides. Left is the half of the picture on the screen-left when the character faces the player. This covers the colour chooser, the cutting regions and the left and right views.

## Status

| Item | State |
|---|---|
| Version 1 | Built, tested and deployed to Cloudflare Pages at `isla-salon.swedeheart.net` (the owner deploys the `dist/` build). 224 unit tests; type check clean |
| Version 2.0 | Planned in section 9 (characters, photo booth). **Stages 2.1 to 2.3 built** (awaiting the owner's review); quick fixes Q1 to Q3 built and Q4 to Q7 planned (section 9.7) before 2.4; 2.4 and 2.5 not started. 252 unit tests; type check clean |
| Needs the owner on a real phone | (1) Confirm the stray-lines fix: lines fanning from the top-left corner on mobile Chrome and Firefox (cause fixed: repeated points in some outlines made broken vertices that phone chips draw as lines; see section 7). (2) Listen to the synthesised sounds (squeak, sparkle, snip, squirt, foam), which could not be heard in the build environment. (3) A report that the shine sparkles stop animating could not be reproduced; if it recurs, note the stage, whether the tap was on and whether they show frozen or not at all. (4) Real Safari and Firefox have not been tried by hand |

## 1. Product summary

A browser-based, offline-capable, single-player sandbox game simulating a salon visit. A head-and-shoulders character (version 1: **Isla, a six-year-old blonde girl**) sits centre screen in a black hairdresser's gown. A stage switch (Wash, Colour, Cut, Style) changes the control panel. A rotate button cycles four views (front, left, back, right). A camera button downloads a clean image with no interface. A recycle button starts over (two taps). A sound button mutes. Visual style is cel-shaded cartoon with vibrant colours; all art is drawn in code.

## 2. Confirmed decisions (version 1)

| # | Decision |
|---|---|
| 1 | 2D rendering, procedural vector art (no hand-drawn assets) |
| 2 | Rotate button cycles front, left, back, right; left and right are the player's |
| 3 | Mobile first: touch-first, no hover, no right-click, no keyboard required |
| 4 | Pure sandbox: no goals, scoring or network functions |
| 5 | Sound effects only, no music, synthesised with Web Audio |
| 6 | Black hairdresser's gown covers all other clothing |
| 7 | Strictly child-friendly content and framing |

## 3. Technology

| Concern | Choice |
|---|---|
| Language, build | TypeScript (strict), Vite, static output |
| Rendering | PixiJS v8 (WebGL, canvas fallback, policy-safe mode for the content security policy) |
| UI | Svelte 5 DOM overlay on top of the canvas |
| State | Svelte stores holding one typed `SalonState`; the renderer is a function of it plus transient animation state |
| Animation | Pixi ticker plus GSAP core; the picture redraws only when something changes |
| Audio | Web Audio, synthesised effects, unlocked on first tap, mute remembered |
| Input | Pointer Events with capture; `touch-action: none` where dragging |
| Photo | `renderer.extract` to canvas then PNG; Web Share sheet on iPhone and iPad |
| Tests | Vitest for logic and geometry; Playwright browser checks by hand-written scripts |

Non-functional: current Chrome, Safari (iOS 16+), Firefox and Edge; portrait and landscape; controls at least 44 px; 60 fps target; bundle about 130 KB compressed; no network requests after load, no accounts or tracking; respects `prefers-reduced-motion`; accessible names and contrast on every control (automated audit finds no problems). Test pages accept `?still` (freezes idle animation and hides effects such as scissors) and `?debug` (exposes the store as `window.salonDebug`).

## 4. How the game works (version 1)

### Character and views
- Isla is data: `CharacterDef` (id, name, skin, eyes, hair colour, seed). Head, face, ears, neck, shoulders and gown are procedural and projected for any view angle; the face is visible front-on and partly from the sides. She blinks every few seconds and breathes (both off with reduced motion).
- The eyebrows are a 50 per cent darker shade of her natural hair colour (the character's own colour, not the dye), the same for both brows and for split and ombre hair.
- The rotate button swings between the four views; the picture stays correct in all of them.

### Hair model
- 24 locks hang from the scalp, each a ribbon on a shell round the head in head space, projected per view, depth-sorted, filled with a lit and a shadow tone and outlined once.
- Four regions (front, left, right, back) each have a length. Lengths, longest first: **Long, Shoulder, Bob, Short, Shorter, Crop, Trimmed, Shaved**. Region lengths sit at the compass points and blend smoothly round the head, so mixed cuts read as one haircut. Short cuts finish lower at the nape than at the temples; short front lengths are fringes above the brows; long front hair is swept behind the cheeks so eyes, brows and cheeks are never covered (tested for every combination, 4,096 cuts).
- Lengths are also fractional positions (0 longest to 7 shaved), so hair can be part-way between two lengths during a cut.
- **Trimmed** is a clipper cut (grade 1, 3 mm): the whole head covered in a thin close cap with only a faint outline, shorter than a crop. **Shaved** has no hair at all, so the head shows her skin colour (including the water tint); between trimmed and shaved the hair thins out gradually. A shaved head has no lather, drips or sparkle, and nothing to colour or style.
- **Colour** modes: one colour; left and right (screen sides, correct in every view); ombre (roots to tips in flat bands along each lock, blending round the hue circle). Every colour change fades in over one second.
- **Curl** (Straight, Waves, Curls, Tight curls) swings each lock side to side, fills the hair out and lifts it slightly. **Sleek** (code name `flat`) presses the hair thin against the head and removes most of the curl. Changes ease in over 0.6 seconds; curl plays a burst of stars and a boing, product a puff of mist and a hiss.
- Every outline passes through `withoutRepeats`, which removes repeated points (see section 7).

### Backdrop
- Two procedural scenes built from reusable prop drawers (plant, pot, bottle, tool): the **sink** (Wash) with shelf of large labelled bottles, wall dial, wall tap and shower head; and the **mirror** (Colour, Cut, Style) with a tool shelf and plants. Changing stage slides the new backdrop in from the right going forward through the tabs and from the left going back (0.45 s, skipped with reduced motion). Isla stays put.

### Washing stage
- Panel: Temperature slider (Cold, Warm, Hot); Water tap slider (Off, Gentle, Medium, Strong) matching the wall tap; product row (Mint, Citrus, Tropical, Conditioner); a full-width **Squirt** button; a hint line. In the picture, tap a bottle to choose it, drag the wall dial up or down for temperature, drag the wall tap for pressure (its lowest setting is off; where the targets overlap the nearer wins).
- **The tap is the on/off control**: water runs whenever pressure is above off, until turned off; the tap starts off, and leaving the stage turns it off. The shower head follows a swiping finger only while the water runs. Her eyes close while the water runs or hair is rubbed.
- **Squirt** pops a blob of the product on her crown that sinks into the hair over a second, with a wet squirt sound. **Shampoo** lathers only while the player swipes back and forth across the hair (rubbing), bubble by bubble in a colour of its own per shampoo (mint green with leaves, citrus yellow with droplets, tropical pink with petals), with a foamy sound that follows how hard it is rubbed; one squirt is worth about two thirds of a lather.
- **Conditioner**: each swipe lightens the hair a step and uses an eighth of the squirt, so one squirt lasts eight swipes; after eight the hair is 88 per cent of the way to white (still tinted by its own colour, so split and ombre stay readable) and silkier. Each swipe squeaks. The lightness stays until water rinses it off.
- **Water** soaks the hair (faster at higher pressure) and rinses lather and conditioner at a speed from 1 times at the gentlest to 3 times at full pressure.
- **Shine**: conditioned hair that has then been rinsed clean sparkles. Shine is kept through every stage (the sparkles also show in Colour, Cut and Style) and lost the moment water is next applied. It needs the hair to have been shampooed clean first.
- **Leaving the sink** clears all washing status (wet, drips, lather, conditioner lightness, silkiness, cleanliness back to its start) and any product waiting to be rubbed in, so she is always dry on return. Shine alone is kept.
- **Temperature on her face**: above warm she turns pink (more as it gets hotter) and the hottest water slants her brows and turns her smile into a frown; cold water turns her blue, and at the coldest setting the mouth opens to a grimace of clenched white teeth. The colour comes up in about a second and fades back over three, carrying on if she changes stage.
- Sound: running water following the pressure, foam, squirt and squeak.

### Colouring stage
- Colour chooser with 11 quick-pick swatches (natural shades then vibrant), a mixer (hue, vividness, lightness) and the device's own colour picker; mode buttons for one colour, left and right, ombre. Switching to a two-colour mode while both colours match fills the second with a contrasting one so the change shows at once; going back remembers it.

### Cutting stage
- Panel: region row (All, Front, Left, Right, Back; tapping her head or hair also picks a region, and the choice survives stage changes), eight length buttons in two rows of four each showing a little head, eight progress pips and a **Snip** button (counts as one swipe, for anyone who cannot swipe).
- Choosing a length only queues it. Swiping back and forth across the hair (or click and drag) moves it an eighth of the way each time, smoothly; a swipe is a pass of about a finger's width in one direction, turning back starts the next, and small wiggles do not count. The cut finishes on the eighth swipe. Choosing another length part-way carries on from where the hair has got to.
- A swipe where any part gets shorter shows the scissors, a snip and falling clippings in the hair's tip colour; a swipe where every changing part grows shows a **magic wand** with a fountain of stars and a sparkly sound instead. Never both.

### Styling stage
- Curl row (four levels, each button a little head) and Product row (None, Sleek). Styling survives cutting and colouring.

### Photo, polish and release
- **Camera button**: a 1080 x 1350 (4:5) PNG of the current view on the current backdrop, head and shoulders, no buttons or effects such as scissors, named for the view and time. Plays a flash and shutter sound; on iPhone and iPad opens the share sheet instead.
- **Start over** (recycle icon, two taps) resets hair, colour, cut, style and washing at once, keeping stage, view and sound setting.
- Reduced motion: no idle animation, flash or easing. Mute is remembered between visits.
- **Offline and installable**: a generated service worker keeps every file of the build, so it plays with no network; web manifest and icons for the home screen. A strict content security policy allows own files only; a request audit shows no outside requests.
- **Screens**: tested emulating iPhone SE, iPhone 13, Pixel 7, Galaxy S9+, iPad, a 320 x 480 screen and desktop (no page scrolling, nothing off screen). Without WebGL it falls back to canvas. The cut panel overflows by about 13 px only on a 360 x 640 screen.
- Hosting files: `README.md`, `public/_headers` (Cloudflare Pages and Netlify), `.github/workflows/pages.yml`, and `docs/style-guide.md` (palette, outline weights, shadow rules).

## 5. Data model (version 1)

```ts
type Stage = 'wash' | 'colour' | 'cut' | 'style';
type View = 'front' | 'left' | 'back' | 'right';
type Length = 'back' | 'shoulders' | 'bob' | 'short1' | 'short2' | 'short3' | 'trimmed' | 'shaved';
type Region = 'front' | 'left' | 'right' | 'back';

interface SalonState {
  character: CharacterDef;
  stage: Stage; view: View;
  cutTarget: 'all' | Region;
  cut: { from: Positions; to: Positions; swipes: number } | null;   // a length queued and being cut
  hair: {
    wetness, cleanliness, conditioned, foam, cream: number;         // washing status, 0..1
    shine: boolean;                                                 // kept until water is next applied
    colour: { mode: 'single' | 'split' | 'ombre'; a: string; b: string };
    length: Record<Region, Length>;
    curl: 0 | 1 | 2 | 3;
    product: 'none' | 'flat';                                       // shown as "Sleek"
  };
  wash: { temperature: number; pressure: number; product: Product; squirts: number };
  audio: { muted: boolean };
  epoch: number;                                                    // bumps on Start over so the scene resets at once
}
```

## 6. Version 1 process notes

- Left and right are always the player's (section top).
- The source was once lost in a workspace reset and rebuilt from a build; the owner keeps the workspace zip delivered with each change, and files are never deleted without the owner's permission.
- Each change is delivered as a complete workspace zip (without `node_modules` and `dist`), with this plan updated in the Project; a deploy build (`dist` zip) is provided on request.

## 7. Lessons and checks that matter

- **Broken geometry only shows on phones.** Pixi builds a broken (NaN) vertex from two identical neighbouring points (for example `moveTo` then `arc`, or a lock whose tip and root coincide). Desktop chips skip it; phone chips draw it as a line to the picture's top-left corner. Rule: draw arcs as point lists, never repeat a point, pass outlines through `withoutRepeats`, and keep the test that builds the triangles Pixi would send and checks every vertex is finite (`src/render/geomscan.test.ts`). Any new drawing in version 2.0 (faces, jaws, backgrounds) must be added to that scan.
- Check by measuring, not by eye: contact sheets across lengths and views, pixel counts, frame-stepped animation timing, unit tests for pure rules. Screenshots are slow, so timed animations are checked with in-page sampling or by stepping the timeline.
- Sounds cannot be heard in the build environment; the owner listens.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Procedural hair looking crude or inconsistent across views | Check every length, view and style with contact sheets; tests for coverage of eyes and brows |
| Region seams looking jagged | Blend lengths across azimuth; test all pairings |
| Performance with many strands and particles on phones | Strand budget, redraw only on change, pooled particles |
| iOS audio and download quirks | Unlock audio on first tap; share-sheet fallback; real iPhone still to try |
| Touch gestures clashing (swiping, dragging dials, scrolling) | `touch-action: none`, pointer capture, drag threshold so a drag is not a tap |
| Broken vertices on phone graphics chips | Section 7 rule and scan test |

## 9. Version 2.0 plan (not started)

Two features: **characters** and a **photo booth**. Delivered in stages; the owner approves each stage before the next starts, as in version 1, and the complete workspace zip is sent after each.

### 9.1 Confirmed decisions

| Topic | Decision |
|---|---|
| Navigation | **Six stage buttons in two rows of three**: Character, Wash, Colour, Cut, Style, Photo booth. The stage selector and the lower controls panel are connected so **only one is on screen at once**: a clear pull-down handle on the stage selector and a pull-up handle on the controls panel move between them. The camera button goes, because the Photo booth replaces it |
| Cast ages | Mixed ages (children, teens, adults), all drawn with the same head-and-shoulders proportions; age shows only through the listed features. The Adam's apple belongs to older male characters |
| Switching | Each character keeps their own hair work (cut, dye, style, shine, washing) for as long as the game is open. Start over resets only the current character |
| Gown | The black hairdresser's gown stays in every photo booth background |
| Start | The game opens on Isla, exactly as she is today |

### 9.2 Feature 1: characters

**Every character has these features** (all adjustable in the Character stage, and all randomised by Randomise):

| Feature | Values |
|---|---|
| Nose size | A smooth range from small to large (a slider); drawn as the small curved mark front-on and as the profile bump from the sides |
| Eye colour | Blue, green, hazel, brown |
| Adam's apple | Present or not; a small bump on the throat, visible in profile and as a faint mark front-on |
| Eyebrows | Thickness (thin to thick), arch amount (flat to high arch), height on the face (high, mid, low) and spacing (closer or further apart). Brows keep the rule of being a 50 per cent darker shade of the natural hair colour |
| Skin colour | Nine tones: very pale, pale, pink, rosy, slight tan, fully tanned, light brown, mid-brown, dark brown. Isla is "pale" and keeps her exact current colour; the other eight tones are proposed on screen for approval in stage 2.1. The temperature tint (pink, blue) works on every tone |
| Face shape | A softer version of oval, round, square or triangular (the shape is moderate, never extreme). The skull stays as it is so the hair shell fits every face; the shape changes the cheeks, jaw and chin. Triangular is wide at the jaw and narrower above |
| Hair colour | The character's natural colour (what the brows follow), chosen from the same options as the colour chooser: the quick-pick swatches or any mixed colour. Randomise picks from the swatches. The Colour stage's dye is separate and starts as the natural colour |

**The cast**: Isla (existing) and eight new named characters of various ages, genders and backgrounds. The proposed cast, for the owner to change:

| Name | Age | Looks (skin, hair, eyes, face) | Starting cut |
|---|---|---|---|
| Isla | 6 | Pale, sunny blonde, blue, oval (as today) | Fringe at the front, shoulder length elsewhere |
| Amara | 9 | Dark brown, black, brown, round | Shoulder length, tight curls |
| Kenji | 8 | Pale, black, brown, round | Short, straight |
| Mateo | 14 | Light brown, brown, brown, square, Adam's apple | Short, waves |
| Priya | 16 | Mid-brown, black, brown, oval | Long, straight |
| Leo | 27 | Fully tanned, brown, green, triangular, Adam's apple | Short, curls |
| Noor | 35 | Light brown, dark brown, hazel, triangular | Shoulder length, waves |
| Tom | 42 | Rosy, ginger, green, square, Adam's apple | Crop |
| Grace | 68 | Pink, grey, blue, round | Bob, straight |

Each has their own starting cut, curl and natural colour and returns to it on Start over. A few natural swatches (grey, dark brown, chestnut) are added to the colour chooser so the cast and Randomise have natural variety.

**Controls (Character stage panel)**: a row of the nine cast portraits to choose from; Randomise; Reset character (back to the preset); and the feature controls grouped as Face (shape, skin, nose), Eyes and brows (eye colour, brow thickness, arch, height, spacing) and Hair (natural colour), with the Adam's apple toggle. Sliders for the smooth ranges, buttons for the choices, swatches for colour; every control at least 44 px with an accessible name. Editing or randomising changes the current character in place (their name stays); the changes last while the game is open and Reset character undoes them. Nothing is saved between visits (as in version 1, only mute is remembered).

**Stages**

- **2.1 Character model and drawing (built).** Test page: open the game with `?debug` and call `salonDebug.setCharacterLook({ face, nose, adamsApple, skin, eyes, hair, brows: { height, thickness, arch, spacing } })`. Skin tones are in `src/features.ts` and are proposed there for the owner's approval; the dye is still Isla's yellow until stage 2.2 gives each character their own. A golden test (`isla.golden.test.ts`) proves Isla draws the same triangles as version 1, and `features.test.ts` covers the rules, the hair clearing every brow setting and finite vertices for 1,000+ drawings. Extend `CharacterDef` with the new features and add a `CharacterFeatures` helper for the skin palette, eye colours and face shapes. Redraw nose, eyes, brows, jaw and neck from the parameters in all four views. Isla must look exactly as she does today. Add the new drawing to the broken-vertex scan. Check hair never covers eyes or brows for high, mid and low brows. *Done when:* a test page shows any feature combination in all four views and Isla is unchanged.
- **2.2 Cast, switching and the stage bar (built).** Cast data is in `src/cast.ts` (Isla plus Amara, Kenji, Mateo, Priya, Leo, Noor, Tom, Grace, with their own starting cut, curl and colour); `switchCharacter` keeps each person's hair work in `saved`; Start over resets the current person only. The colour chooser gained six natural swatches (17 in all, three rows of six with the mixer). The game opens on the Character stage with the selector showing. Photo booth is a stage whose panel holds a **Take photo** button for now (the round camera button is gone); its backgrounds come in 2.4. Landscape phones keep the controls in a column beside the picture. On a 320 x 480 screen some panels scroll. Original description: The nine characters with starting looks, per-character saved hair state, switching with the character's own work kept, Start over for the current character only, and the new navigation: six stage buttons in two rows, connected top and bottom panels with pull handles, a Character stage that opens with the cast chooser. *Done when:* any character can be chosen, worked on, left, and returned to, on every phone size, with all four existing stages unchanged.
- **2.3 Feature controls and Randomise (built).** The Character panel has five tabs: People (the nine portraits), Face (shape, nose size, Adam's apple), Colours (nine skin tones, four eye colours), Brows (thickness, arch, spacing, height) and Hair (the 17 natural colours plus the device colour picker), with **Randomise** and **Reset <name>** always showing. Randomise changes every listed feature and the natural hair colour, never the name, hair seed or hair work. Changing the natural colour moves the hair with it while it is still undyed (a deliberate dye is left alone); brows always follow the natural colour. Reset character returns the look to the preset. Edits last while the game is open and stay with the character when someone else has a turn. `?debug` also exposes `randomiseLook`, `resetLook` and `switchCharacter`. Original description: The Character panel's controls and Randomise and Reset. *Done when:* every feature can be adjusted and randomised, and a sweep of random characters shows no overlapping hair, broken geometry or unreadable faces in any view.
- **2.4 Photo booth.** See 9.3.
- **2.5 Release.** Cross-device checks, offline, accessibility audit, performance, update `intent.md`, README and the style guide, and an `dist` build for the owner to deploy.

### 9.3 Feature 2: the photo booth

The camera button becomes the **Photo booth** stage, a sixth stage button. In it the player chooses one of five backgrounds and takes the photo from there.

- **Backgrounds**, all procedural in the same cel-shaded style, with the character in front of them in the current view: **Salon** (the mirror scene), **Beach** (sea, sand, sky, a parasol or palm), **City** (skyline and street), **Forest** (trees, light through leaves) and **Clouds** (sky and clouds). Changing background slides in like a stage change.
- **Controls**: five background buttons (each a small picture), a **Take photo** button, the existing rotate button for the view, and the sound and Start over buttons as now.
- **The photo** keeps the current format (1080 x 1350, 4:5 PNG, no interface, named for the character, view, background and time, share sheet on iPhone). The black gown stays. The character is shown exactly as worked on (their cut, dye, style and shine); effects such as scissors are not in the photo.
- **Stage 2.4 done when:** each of the five backgrounds looks right with every character at all four views, the photo matches what is on screen, the old camera button is gone, and it works offline.

### 9.4 Risks specific to version 2.0

| Risk | Mitigation |
|---|---|
| Face shapes and brow heights clashing with the hair shell and fringes | Keep the skull fixed; change only jaw and cheeks; the fringe limit follows the character's brow height; test every cut with high, mid and low brows |
| Nine skin tones, many hair colours and the temperature tints losing contrast (outlines, blush, teeth) | Check every tone against every tint and every backdrop on contact sheets |
| Navigation with two sliding panels hiding the picture on short phones | Build and test the panel layout first in stage 2.2 on the smallest screens (320 x 480 up) |
| More drawing means more chances of broken vertices on phones | Add every new drawing to the geometry scan; the owner confirms on a real phone |
| Five new backgrounds adding weight | Procedural only, no assets; keep the bundle under about 500 KB |

### 9.5 Assumptions to confirm (change any of them)

- **Layout of the connected panels.** Choosing a stage slides the stage selector away and the stage's controls up in its place; the character is re-centred in the space left; the handles toggle between the two. (Confirmed: choosing a stage closes the selector and opens that stage's controls. Assumed: the game opens with the selector showing so a new player sees the stages.)
- **Face shapes.** "Triangular" means wide jaw and narrower brow. "Softer" means about 60 per cent of a full shape.
- **Randomise.** It randomises the listed features and the natural hair colour but not the cut, curl or washing, and keeps the name.
- **Cast.** The proposed table above (names, ages, looks); no non-binary character is proposed unless you want one. Silver or grey hair and a dark brown need new swatches, which are added.
- **Skin tones.** Nine fixed tones, with colours proposed in stage 2.1 for approval.

### 9.6 Open questions

None outstanding. Confirmed by the owner: the photo booth's Salon background is the existing mirror scene, and choosing a stage closes the stage selector and opens that stage's controls (the handles still toggle between the two).

### 9.7 Quick fixes before stage 2.4 (planned, not started)

Each is built when the owner says "Begin", and a zip is sent after each, as before.

| # | Fix | How it will work | Done when |
|---|---|---|---|
| Q1 (built) | Shampoo rinse time | Rinsing a full lather (and a full coat of conditioner) takes **10 seconds at the lowest water setting above off and 3 seconds at full pressure**, speeding up evenly in between. Today a full lather rinses in 5 seconds at the lowest setting and 1.7 seconds at full pressure. Rinse rates become 0.1 a second at the lowest setting, with the speed multiple running from 1 to 3.33 | A unit test times a full rinse at the lowest and the highest setting and finds 10 s and 3 s |
| Q2 (checked) | Shiver moves only the character | The cold shiver is applied to the character and the effects that sit on her hair (lather, drips, blob, shine sparkles), not to the wall dial, tap, shower head, water stream or bottle ring, which currently shake with her because they share a drawing layer. The effects layer is split in two. **Finding:** the build already had the split (fixtures on their own layer), and a frame-difference check in cold water showed only she and the sparkles on her hair move; the dial, tap, shower, water and shelf do not. The shiver is now one tested function, `shiverOffset` (cold only, at most 1.3 px). If it still looks wrong on a phone, say what moves | In the cold, a pixel comparison between frames shows the fixtures unmoved and the character moving |
| Q3 (built) | Hot and cold colour only the skin | The pink and blue tint is applied only to the skin (face, ears, neck). The cheek blush no longer changes strength with temperature, and nothing else (eyes, teeth, brows, hair, gown) is touched. *Assumed:* the grimace, frown, brow slant and the shiver stay, since they are not colour | A test confirms the tint touches nothing but skin fills, and a picture check at the hottest and coldest settings |
| Q4 | Trimmed hair as a soft single area | Trimmed (grade 1) is drawn as **one area of the hair colour that fades in from the skin colour at its edges** (hairline, temples, nape and ears), with no outline, so it reads as short hair growing from the skin. The fade into Shaved stays gradual. This needs an experiment: stacked, slightly smaller shapes of rising opacity, judged on contact sheets across all views, colours and skin tones, before it is settled | Contact sheets of trimmed hair on every skin tone and a dark and a light hair colour look natural from all four views |
| Q5 | Bigger noses and thicker brows | The **largest nose is 75 per cent bigger** than today's largest (scale 1.35 becomes 2.36, standing out further in profile), and the **thickest brow is 75 per cent thicker** (5.5 px becomes 9.6 px). The middle setting stays as it is so Isla does not change, so the slider's upper half stretches more; the smaller end is unchanged. Cast members with larger noses and thicker brows (Mateo, Leo, Tom, Noor) become a little bigger and may be retuned. The hair's brow clearance rule follows the thicker brows | Tests for the new ranges and Isla unchanged; picture checks at the extremes in all four views |
| Q6 | Brow spacing moves only the inner end | The outer end of each brow stays where it is. Only the inner end moves: at the minimum the two brows **touch at the centre line**, at the middle they are where they are today (so Isla is unchanged) and at the maximum the inner end is well apart. The brow shortens as the inner end moves outwards, keeping its arch shape | Tests for the end positions; a picture at minimum and maximum shows touching brows and wide-apart brows with the outer ends level |
| Q7 | Rosy cheeks on or off | A new character feature, **rosy cheeks: on or off**, beside Adam's apple on the Face tab. The blush colour is worked out from the base skin (a warmer, deeper shade of that skin, so it shows on pale and on dark skin alike) instead of one pink for everyone. All nine cast members start with them on, as everyone has now, Randomise picks it at random and Reset restores it. *Note:* Isla's blush colour becomes the worked-out one, a tiny change I will keep as close to today's pink as I can, and the Isla golden test is updated | Tests for the colour rule on every skin tone; contact sheet of cheeks on and off for all nine tones |

**Assumptions to confirm:** (a) the "75 per cent" in Q5 means the maximum size, not every size; (b) in Q3 the face expressions stay; (c) in Q7 the cheeks stay at a fixed strength whatever the water temperature.
