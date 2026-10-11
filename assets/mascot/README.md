# Pixel CK

Generated with the built-in imagegen tool from the portfolio portrait and the user's Outside the IDE photos (`outside-5.jpg` and `outside-7.jpg`). Both PNG source sheets are preserved under `characters/mini-ck/`.

The page-mascot skill's builder aligns the shoulders between frames. A temporary copy of its build script uses nearest-neighbour resampling, no bottom vignette, 144-pixel tiles, and lossless WebP to preserve pixel edges. Its bleed cleanup keeps only each tile's largest connected bust, removing detached flecks from adjacent cells. The site uses the resulting 432×432 atlases with vanilla JavaScript; no React or runtime package was added.

Verification: real alpha transparency; left and right faces point toward the viewer's left and right (checked on light and dark backgrounds); 0.00 px measured movement between direction and reaction atlases; 89.6% shoulder overlap; 76.9% palette agreement; 0.0% shoulder-width change. The two served atlases total about 264 KB.

## Directions prompt

Use case: stylized-concept.
Asset type: a transparent PNG sprite atlas for a cursor-tracking pixel mini-me in a developer's personal portfolio. This is the FIRST of two matching 3x3 sprite sheets.
Reference images: the three photos show the same person; use ONLY visible likeness traits, not their photographic lighting, scene, pose or realism. Keep his tousled black hair with long side fringe, narrow rectangular black-framed glasses, clean-shaven rounded face, and a light gray hoodie.
Draw a charming big-head chibi developer in strict 16-bit PIXEL ART: chunky visibly square pixels, a small grayscale palette (black, charcoal, cool gray, pale gray, white), hard-edged pixel shading, crisp dark one-pixel outline. Absolutely no smooth curves, antialiasing, gradients, photographic texture, color blush or 3D rendering. The glasses have transparent pale lenses so his expressive eyes can be seen. Hair has a recognisable irregular tousled silhouette.
LAYOUT: exactly 3 columns by 3 rows of equally sized square cells on a genuinely transparent canvas. Square image, ideally 1536x1536. No drawn cell lines. Each figure is a PORTRAIT BUST, head, neck and upper shoulders ONLY, no hands, arms, desk, mug or props. Head is about 1.5 times the shoulder width. Figure occupies about 70% of each cell height with wide empty margins on all four sides, including below shoulders. Nothing touches or crosses cell edges.
CRITICAL: draw the front-facing hoodie, neck and shoulders ONCE and repeat the exact same pixels at the exact same position and scale in ALL NINE cells. Only the HEAD rotates. Every head has the same calm friendly expression and glasses, only the direction changes. Bodies NEVER turn in profile.
Nine head directions, left to right:
Top row: looking UP and toward the VIEWER'S LEFT; looking UP; looking UP and toward the VIEWER'S RIGHT.
Middle row: looking toward the VIEWER'S LEFT (nose points left); looking STRAIGHT at viewer; looking toward the VIEWER'S RIGHT (nose points right).
Bottom row: looking DOWN and toward the VIEWER'S LEFT; looking DOWN; looking DOWN and toward the VIEWER'S RIGHT.
No labels, letters, symbols, hearts, sparkles, zzz, logos, background, shadows, borders or watermark. Preserve actual alpha transparency. Keep consistent character proportions and reusable body geometry across the entire atlas.

## Reactions prompt

Use case: stylized-concept.
Asset type: the SECOND matching 3x3 transparent PNG sprite atlas for the same pixel mini-me portfolio mascot.
The attached direction sheet is the exact character reference. Copy its 16-bit pixel-art developer precisely: tousled black hair and side fringe, narrow rectangular black-frame glasses with pale clear lenses, rounded clean-shaven face, light gray hoodie. Same limited neutral GRAYSCALE palette, same crisp chunky square pixel grid, same dark outline and pixel shading. Do not add colours, smooth antialiasing, realism or a different drawing style.
This is an EXPRESSIONS sheet, NOT head directions. In all nine cells the head faces STRAIGHT at the viewer, centered and upright. Only eyes, eyebrows and mouth change. EXACTLY match the reference's middle-row middle-cell hoodie and shoulders in every cell: identical body pixels, dimensions, width, position, and bottom baseline. Keep the head and hair size identical too. Heads plus neck and upper shoulders ONLY; NO hands, arms, props, hearts, stars, letters or floating symbols.
LAYOUT: exactly 3 columns by 3 rows, evenly spaced square cells, genuinely transparent background, wide clean empty margins on ALL four sides. Nothing touches or crosses cell boundaries. No grid lines. Every figure at the same scale and location as in the attached sheet.
Nine expressions left to right, top to bottom:
1. Blink: eyes shut as little curved pixel lines behind glasses, calm neutral mouth.
2. Warm smile, eyes open.
3. Cheerful eyes shut, happy small smile.
4. Pleasantly surprised, eyes wide, tiny O mouth.
5. A playful wink, one eye open behind glasses and one shut.
6. A relaxed, friendly small grin.
7. Sleepy closed eyes, mouth calm, no zzz.
8. Amused raised eyebrow and crooked smile, no swirly eyes.
9. Delighted eyes shut and big happy grin.
The body must remain absolutely unchanged through every reaction. No text, labels, symbols, logos, watermark, borders, shadows or background. Preserve real alpha transparency. A square canvas matching the reference sheet dimensions.

