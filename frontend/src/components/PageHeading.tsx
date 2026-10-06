import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface Heading {
  title: string;
}

interface Ctx {
  heading: Heading | null;
  setHeading: (h: Heading | null) => void;
}

const PageHeadingContext = createContext<Ctx | null>(null);

export function PageHeadingProvider({ children }: { children: ReactNode }) {
  const [heading, setHeading] = useState<Heading | null>(null);
  const value = useMemo(() => ({ heading, setHeading }), [heading]);
  return <PageHeadingContext.Provider value={value}>{children}</PageHeadingContext.Provider>;
}

export function usePageHeading(title: string) {
  const ctx = useContext(PageHeadingContext);
  const setHeading = ctx?.setHeading;
  useEffect(() => {
    if (!setHeading) return;
    setHeading({ title });
    return () => setHeading(null);
  }, [setHeading, title]);
}

export function usePageHeadingValue() {
  return useContext(PageHeadingContext)?.heading ?? null;
}
