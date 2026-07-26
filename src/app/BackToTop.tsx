"use client";

import { useEffect, useState } from "react";

// Floating "back to top" button that fades in after scrolling down.
export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="回到顶部"
      title="回到顶部"
      className={`fixed bottom-5 right-5 z-50 grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--launcher)] text-[var(--heading)] shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400/40 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
