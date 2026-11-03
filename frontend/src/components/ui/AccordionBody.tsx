import { createContext, useContext } from "react";

/**
 * True inside the body of the product editor's EditorSection, which draws the
 * card, the title and the section's error itself. (The name is from the
 * accordion that did this job before the editor moved to tabs.)
 *
 * ⚠️ Why context rather than a prop: every editor section renders its own
 * Card + CardHeader, so putting them inside an EditorSection would draw a card
 * in a card and print the title twice. The alternative was threading a `bare`
 * prop through eight section components that have nothing else in common —
 * eight signatures changed to say one thing about their surroundings. The
 * wrapper already knows; this lets it tell them.
 *
 * Its own module so Card and Alert can both read it without importing each other.
 */
const InAccordion = createContext(false);

export function AccordionBodyProvider({ children }: { children: React.ReactNode }) {
  return <InAccordion.Provider value={true}>{children}</InAccordion.Provider>;
}

/** True inside an EditorSection body — for components that drop their chrome there. */
export function useInAccordionBody(): boolean {
  return useContext(InAccordion);
}
