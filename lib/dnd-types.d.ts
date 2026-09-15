import type { JSX as ReactJSX } from "react";
// dnd-kit 6 declarations still refer to the pre-React-19 global JSX.Element.
declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
    type IntrinsicElements = ReactJSX.IntrinsicElements;
  }
}
