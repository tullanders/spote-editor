import '@testing-library/jest-dom/vitest'

// jsdom does no layout, and — unlike `Element`, which it stubs with an empty rect
// list — it doesn't implement `Range.getClientRects`/`getBoundingClientRect` at
// all. ProseMirror calls these on a `Range` internally (e.g. `scrollToSelection`,
// triggered whenever a transaction moves the selection) to compute caret
// coordinates, which throws under jsdom with no stub. Match jsdom's own `Element`
// behavior — a zero-size rect — so real DOM interactions in tests (typing,
// clicking) don't hit an uncaught exception from a measurement jsdom was never
// going to answer meaningfully anyway.
if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function getClientRects() {
    return [] as unknown as DOMRectList
  }
}
if (typeof Range !== 'undefined' && !Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON() { return this } }
  }
}

// jsdom does not implement `document.elementFromPoint`, which ProseMirror calls
// in its mousedown handler (via `posAtCoords`) to find the element at a given point.
// Returning `null` is the honest stub: it means "no element at that point", which
// is what a real browser returns for coordinates outside the viewport.
if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = function elementFromPoint() {
    return null
  }
}
