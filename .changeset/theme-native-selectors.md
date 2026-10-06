---
'@bdocs/theme-neutral': minor
---

Removes the GitHub stars counter, and converts the theme toggle, the locale selector and the version selector.

## Removed

`GithubStars` is gone, along with `getStarsRepo` and the `github` field on the navbar hook.

Nothing else used any of the three. `useNavbar` exposed `github` only for this
widget, and `getStarsRepo` had no caller once the widget went — leaving either in
place would have meant an exported API that nothing can change because nothing
calls it.

## Converted

The theme toggle, the language selector and the version selector share one
stylesheet, because they are one control: a bordered pill with a label and a
chevron that opens a menu. They were three class lists that had already drifted —
the version selector's option had lost the `transition-colors` the other two still
had, and the language selector's chevron was a different colour from the theme
menu's. One stylesheet cannot drift.

The current option is `data-selected` rather than a class per option, so a theme
can restyle "the one you are on" without knowing how many options there are.

The light/dark switch slides one indicator with `translate` rather than
cross-fading two absolutely-positioned states, and `data-value` on the track
decides which way it goes. Written per-option as `isDark && 'translate-x-full'`,
the same positioning decision lived in two places that had to agree.

## Verified

The only pixel difference on the page that hosts all three is the navbar's right
side shifting, which is the stars counter disappearing. No styling regression.

## Progress

28 of 58 files on plain CSS; 17 remain.
