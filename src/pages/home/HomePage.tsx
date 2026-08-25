import { useEffect, useRef, useState, type ReactElement } from 'react';
import { MODELS } from '@/data/models';
import HeroSection from './HeroSection';
import './HomePage.css';

/** Link tone the header should use while it floats over a given section tone. */
function headerToneFor(sectionTone: string | undefined): 'light' | 'dark' {
  return sectionTone === 'dark' ? 'light' : 'dark';
}

/**
 * Home: one full-viewport section per model, snapped one notch at a time.
 *
 * The document is the scroll container — the footer lives outside this page in
 * RootLayout, so snapping is applied to the document root while the page is
 * mounted rather than to a nested scroller that would trap the footer below the
 * fold. A one-pixel snap target closes the list so the last notch of scroll
 * rests on the footer instead of springing back to the final section.
 */
export default function HomePage(): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  /* Section 0 is the light tone, so the header starts with dark links. */
  const [headerTone, setHeaderTone] = useState<'light' | 'dark'>('dark');

  /* Snap belongs to the document scroller, and only for as long as this page
     is on screen. */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('vm-home-snapping');
    return () => root.classList.remove('vm-home-snapping');
  }, []);

  /* Which section owns the viewport right now. The header reads the tone off
     this element to flip its link colour over dark sections. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-hero-index]'));
    if (sections.length === 0) return;

    const ratios = new Map<HTMLElement, number>();
    for (const section of sections) ratios.set(section, 0);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target as HTMLElement, entry.intersectionRatio);
        }

        let winner = sections[0];
        let best = -1;
        for (const section of sections) {
          const ratio = ratios.get(section) ?? 0;
          if (ratio > best) {
            best = ratio;
            winner = section;
          }
        }

        setActiveIndex(Number(winner.dataset.heroIndex ?? 0));
        setHeaderTone(headerToneFor(winner.dataset.tone));
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="vm-home"
      ref={rootRef}
      data-header="transparent"
      data-header-sentinel=""
      data-header-tone={headerTone}
      data-active-section={activeIndex}
    >
      <h1 className="sr-only">Vela Motors electric vehicles</h1>

      {MODELS.map((model, index) => (
        <HeroSection key={model.id} model={model} index={index} isFirst={index === 0} />
      ))}

      {/* Final snap target: without it a mandatory snap container refuses to
          rest anywhere past the last section, and the footer stays unreachable. */}
      <div className="vm-home__tail" aria-hidden="true" />
    </div>
  );
}
