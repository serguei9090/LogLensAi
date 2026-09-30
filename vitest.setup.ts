import "@testing-library/jest-dom";
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  writable: true,
  configurable: true,
});
if (typeof window !== "undefined") {
  window.PointerEvent = window.PointerEvent || window.MouseEvent;
}
