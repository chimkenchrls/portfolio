# Certification assets

The user supplied the DataCamp logo, STI logo, AppBuildersPH logo, AppBuildersPH certificate, and original STI Codefest certificate photograph on 2026-10-11. Original files are copied without changing their pixels.

- `datacamp-logo.png`: original user-supplied DataCamp logo.
- `sti-logo.png`: original user-supplied STI logo.
- `appbuildersph-logo-original.png`: original user-supplied AppBuildersPH logo.
- `appbuildersph-logo-black.png`: black-background edit using the built-in image_gen tool; used by the card.
- `appbuildersph-certificate.png`: original user-supplied certificate.
- `sti-codefest-original.png`: original user-supplied photograph; the viewer crops its top/bottom with CSS. No certificate text, signatures, or pixels were regenerated.

The built-in tool's STI cleanup was inspected and rejected because it redrew details. That generated variant is not used or shipped with the site.

## Exact built-in image edit prompts

### AppBuildersPH logo (accepted)

Use case: precise-object-edit. Edit target: the attached AppBuildersPH logo. Change ONLY the plain white background outside the logo silhouette to solid pure black (#000000), including the outer background around its existing soft shadow. Preserve the exact AppBuildersPH lettering, white letter fill, black interior, green borders and highlights, logo shape, proportions, placement, and all logo details. Preserve the square composition. Do not redesign, trace, restyle, add, or remove any part of the logo. Output one finished square logo image with a black background, no transparency.

### STI certificate (rejected)

Use case: precise-object-edit. Edit target: the attached real STI Codefest certificate photograph. Make a conservative photographic cleanup for display in its owner's portfolio: crop closely around the physical certificate sheet, straighten its perspective and rotation modestly, reduce the blue lighting cast slightly and improve contrast and readability gently. Remove the irrelevant ground, legs, and background through cropping only. Keep the circular Champion medal overlapping the top left if needed to retain the real photographed sheet. Keep the photograph looking like a real photographed document, with its actual paper and folds, rather than a newly typeset or recreated certificate. Absolutely preserve EVERY printed word, letter, name, number, date, issuer logo, graphical mark, signature and signature stroke exactly as photographed. In particular preserve KENNETH CHARLES A. VALDEZ and the date 11TH OF MARCH, 2026. Do not regenerate or 'correct' any text or signatures. Do not fill or invent missing or occluded sheet edges or obscured text; leave them as photographed. Only crop, geometric alignment, and gentle lighting adjustment; no replacement document design. Output a single conservatively cleaned and tightly framed photographic certificate, not a mockup.
