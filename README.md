# ISP Landing Page 2026 — "Crimson Orbit"

A static landing page for the ISP bachelor program (Interdisciplinary Business, UEH.ISB × Fu Jen). No build step is needed.

```
index.html            all content (Vietnamese, from "ISP Landing page 2026.xlsx")
assets/css/main.css   design tokens (from ISB-DESIGN.md) + components + responsive
assets/js/main.js     motion & interactions
assets/js/roadmap-map.js  3D hex-dot globe background for "Lộ trình đào tạo" (three.js, ES module, lazy-loaded)
assets/js/hex-map-data.js generated land mask for the globe (13 KB) — do not edit
tools/build-hex-map.py    regenerates hex-map-data.js from Natural Earth data
assets/img/           optimized photos (resized/compressed from the source folders)
assets/logo/          ISB / ISP / Fu Jen SVG logos (white for dark backgrounds, *-color for light ones)
assets/img/testi/     student photos, cropped to portrait from the "Meet the ISPers" banners
```

## Stack (loaded from CDNs)
- **GSAP 3.12.5 + ScrollTrigger** (cdnjs): scroll reveals, the pinned roadmap, parallax, the scroll-velocity photo belt
- **Lenis 1.1.13** (unpkg): smooth scrolling
- **Mona Sans** (Google Fonts, variable `wdth` 75–125, Vietnamese subset): big numbers use `font-stretch: 125%`
- **three.js 0.160** (jsDelivr, ES module): the roadmap background globe. It is imported only when the section comes within about 1200px of the viewport.
- **Phosphor Icons, Bold** (unpkg `@phosphor-icons/web`), following the design system rule. **Exception:** the three large decorative icons in the wide USP cards (`.bento__deco`) use the **Light** weight, at the client's request. At 104px, the Bold stroke looked too heavy.

The page still works if the CDNs fail. Content shows without animation, because a 3-second guard in `<head>` removes the hidden state.
`prefers-reduced-motion` turns off Lenis, the scroll animations and the counters.

## Type scale
Every font size comes from the tokens in `:root` of `main.css`. Don't add raw px values.
- **Text:** `--fs-xs` 12 (uppercase labels) · `--fs-sm` 14 · `--fs-md` 16 · `--fs-lg` 20 · `--fs-xl` 24. These are ISB-DESIGN body/14–24, each with a matching `--lh-*` line height.
- **Fluid:** `--fs-lead` 16→20 · `--fs-h3` 20→26 · `--fs-h2` 28→48 · `--fs-h1` 38→80.
- **Display numbers:** `--fs-n1` (the Fu Jen 100) → `--fs-n6` 28.
- **Phones (<768px)** redefine the tokens: `lg` 18 · `xl` 20 · `h3` 18 · `h2` 24 · numbers `n1` 88 → `n6` 24. Body text stays 16px.
- **Icons:** `--ic-sm` 16 · `--ic-md` 20 · `--ic-lg` 24 · `--ic-xl` 32 · `--ic-2xl` 40.
- **Intentional exceptions:**
  - `sup` / `.bignum__unit` stay in `em`, so they scale with their number;
  - the decorative `.bento__deco` icons (104/72px) and the marquee icon;
  - the phone-only overrides for the hero title and the 300-triệu number.

## Notes
- **Outlined text**: Mona Sans is a variable font whose glyph contours overlap, so `-webkit-text-stroke` would draw the inner overlaps too. Outlined text (currently the footer marquee) therefore uses an SVG filter, `#outline-faint` in `index.html`. It dilates the merged glyph silhouette and knocks out the fill. Apply it with `filter: url(#outline-faint)` on text with a solid colour, and copy the filter with a different `flood-color` for other colours.
- **Rolling numbers**: just before a number rolls, it is typeset once as plain text. Each character's slot (advance + kerning + letter-spacing) is read with a DOM `Range`, and each rolling column gets exactly that width, with glyphs left-aligned as in running text. When the roll ends, the columns are swapped for the plain text, and the positions match to the pixel. Measuring at roll time rather than on load matters: `document.fonts.ready` can resolve before Mona Sans has even been requested.
- **Brand gradients**: `--g-accent` (#DF0100 → #340095) is used alongside the ISI gradients.
- **Pathway field**: the `pathway` checkboxes in the form stay in sync with the "Xây lộ trình" builder (maximum 2).

## Roadmap background globe (`assets/js/roadmap-map.js`)
- **Look:** the upper half of a dotted globe sits behind the "Lộ trình đào tạo" content, faded out under the heading with a CSS mask.
  - **Dots:** a geodesic hexagonal lattice (an icosahedron subdivided F=180 times, so each dot has 6 neighbours); light gray for land, fainter for sea.
  - **Phase 1:** Vietnam ripples in red from TP.HCM.
  - **Scroll into phase 2:** the globe rotates in 3D to Taiwan (a slerp between two orientations, with a pitch dip, yaw swing and zoom at mid-flight), and Taiwan lights up purple with a ripple from Tân Bắc.
- **Placement:** on desktop, the highlighted country is anchored in the free band under phase 1, using a camera lens shift. The globe sits entirely in the free band under the content, and the countries sit near its top rim, where the grazing angle flattens them to fit. A CSS mask keeps the canvas fully transparent above about 73% of the pinned view (desktop), so dots can never appear behind text. The pinned content is top-aligned and its spacing grows with viewport height (`vh` clamps). It ends at about 77% of the viewport, so the canvas is shifted down 2.5vh (`.roadmap.is-pinned .roadmap__map`) and the mask line sits at about 76.5%. On phones (<768px) there is no globe: the canvas is hidden and three.js is never loaded. The globe is centred horizontally. All tuning lives in `anchor` in `roadmap-map.js`: `el` (Vietnam elevation, 74°), `elTW` (Taiwan, 71°), `look` (camera height: higher = globe lower in frame), `dist` (smaller = closer zoom, 2.4), `look` 1.31, `twZoom` (extra zoom for Taiwan), horizontal `shift` (0 = centred), `fov` and dot `size`, plus `*N` versions for phones (`elN` 64°, `elTWN` 62°, and so on). Page text gets a soft halo in the section colour so it stays crisp over the dots. On narrow screens it is centred at the bottom of the section.
- **Route checkpoints:** Năm 1 → Năm 2 → flight (the phase divider, at 1/3) → Năm 3 → Năm 4 → **Fu Jen graduation** (the `route__tick--grad` checkpoint, with the Fu Jen symbol). Tick positions come from the `data-at` attributes in the HTML. When the plane lands on the Fu Jen checkpoint, it turns to the brand gradient and the degree card (inside phase 2, on the right) appears. Layout: phase 1 takes 1/3 of the width and phase 2 (content + degree card) takes 2/3.
- **Driven by** `window.ISP_ROUTE.progress`, which the roadmap scroll timeline in `main.js` writes. The phase switch happens at about 22–42% of the timeline, when the plane crosses into phase 2.
- **Hoàng Sa & Trường Sa:** the 1:50m data doesn't include Vietnam's two archipelagos in the East Sea, so `tools/build-hex-map.py` adds them explicitly as small clusters of Vietnam-coloured dots at their real positions. They are listed in `ARCHIPELAGOS`: 2 clusters for Hoàng Sa and 6 for Trường Sa. They light up and fade together with mainland Vietnam.
- **Data:** the lattice point order is deterministic, so the browser rebuilds the positions itself. `hex-map-data.js` only stores each point's kind (sea / land / Vietnam / Taiwan), run-length encoded: about 324k points in 13 KB. To regenerate: `python3 tools/build-hex-map.py countries-50m.json` (source link in the script header).
- **Fallbacks:** without WebGL, or if three.js fails to load, the canvas is removed and the section looks as before. With `prefers-reduced-motion`, a still frame is shown. The render loop runs only while the section is on screen.
- **Debug:** `ISP_MAP_DEBUG(progress[, azDeg, elDeg, {shift, dist, size, …}])` renders a given state immediately, for tuning. `ISP_LENIS` exposes the smooth-scroll instance.

## Sections → spreadsheet rows
| # | Section | Nav group |
|---|---------|-----------|
| 1 | Hero + video modal (YouTube `D-glvRE28Wc`) | Giới thiệu |
| 2 | USP bento (icons + rolling numbers, not a text list) | Giới thiệu |
| 3 | Lộ trình đào tạo: pinned "flight path" infographic, 2 + 2 years | Chương trình học |
| 4 | Chuyên ngành: mini tabs + "chọn 2 trong 4" pathway builder (Venn) + careers | Chương trình học |
| 5 | Đại học Fu Jen: 100 năm + rankings | Chương trình học |
| 6 | Testimonials (3) | Trải nghiệm Sinh viên |
| 7 | Student life: 2 columns (UEH.ISB / FJCU) + one continuous photo belt | Trải nghiệm Sinh viên |
| 8 | Điều kiện tuyển sinh | Học bổng & Tuyển sinh |
| 9 | Talent Scholarship: hover a tier to see its criteria, plus a GPA/IELTS estimator | Học bổng & Tuyển sinh |
| 10 | Registration form | Học bổng & Tuyển sinh |

## TODO before going live
1. **Form backend**: put the CRM/endpoint URL in `data-endpoint` on `#signup-form`. When it is empty the form runs in demo mode: it validates, waits 900ms and shows the success state. Field names: `role, phone, email, name, dob, gender, school, city, level, gpa, english, pathway[] (0–2 values), consent`.
2. **Major images** are hotlinked from Unsplash (free license). For production, download them into `assets/img/` and self-host.
3. **Privacy policy / terms links** in the consent text need real URLs.
4. Add analytics and pixel tags as needed.

## Local preview
Serve the folder with any static server, e.g. `python3 -m http.server` from this directory.
