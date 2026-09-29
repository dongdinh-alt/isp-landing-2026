# ISP Landing Page 2026 — "Crimson Orbit"

A static landing page for the ISP bachelor program (Interdisciplinary Business, UEH.ISB × Fu Jen). No build step is needed.

```
index.html            all content (Vietnamese, from "ISP Landing page 2026.xlsx")
assets/css/main.css   design tokens (from ISB-DESIGN.md) + components + responsive
assets/js/main.js     motion & interactions
assets/img/           optimized photos (resized/compressed from the source folders)
assets/logo/          ISB / ISP / Fu Jen SVG logos (white for dark backgrounds, *-color for light ones)
assets/img/testi/     student photos, cropped to portrait from the "Meet the ISPers" banners
```

## Stack (loaded from CDNs)
- **GSAP 3.12.5 + ScrollTrigger** (cdnjs): scroll reveals, the pinned roadmap, parallax, the scroll-velocity photo belt
- **Lenis 1.1.13** (unpkg): smooth scrolling
- **Mona Sans** (Google Fonts, variable `wdth` 75–125, Vietnamese subset): big numbers use `font-stretch: 125%`
- **Phosphor Icons, Bold** (unpkg `@phosphor-icons/web`), following the design system rule. **Exception:** the three large decorative icons in the wide USP cards (`.bento__deco`) use the **Light** weight, at the client's request. At 104px, the Bold stroke looked too heavy.

The page still works if the CDNs fail. Content shows without animation, because a 3-second guard in `<head>` removes the hidden state.
`prefers-reduced-motion` turns off Lenis, the scroll animations and the counters.

## Notes
- **Outlined text**: Mona Sans is a variable font whose glyph contours overlap, so `-webkit-text-stroke` would draw the inner overlaps too. Outlined text (currently the footer marquee) therefore uses an SVG filter, `#outline-faint` in `index.html`. It dilates the merged glyph silhouette and knocks out the fill. Apply it with `filter: url(#outline-faint)` on text with a solid colour, and copy the filter with a different `flood-color` for other colours.
- **Rolling numbers**: just before a number rolls, it is typeset once as plain text. Each character's slot (advance + kerning + letter-spacing) is read with a DOM `Range`, and each rolling column gets exactly that width, with glyphs left-aligned as in running text. When the roll ends, the columns are swapped for the plain text, and the positions match to the pixel. Measuring at roll time rather than on load matters: `document.fonts.ready` can resolve before Mona Sans has even been requested.
- **Brand gradients**: `--g-accent` (#DF0100 → #340095) is used alongside the ISI gradients.
- **Pathway field**: the `pathway` checkboxes in the form stay in sync with the "Xây lộ trình" builder (maximum 2).

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
