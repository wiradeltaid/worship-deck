import ArtifactSlide from '@/components/artifacts/ArtifactSlide';
import type { SlidePlanItem } from '@/lib/slide-plan';

/**
 * Thin adapter kept for the slideshow / presenter / projector call sites: every
 * plan item carries its hydrated artifact, so all rendering lives in
 * `ArtifactSlide` and no per-`SlideKind` styling remains here.
 *
 * It deliberately takes **no `className`**. It used to forward one straight onto
 * the wrapper `ArtifactSlide` puts around projected output, which no call site
 * ever used — but it was the one path by which a caller outside the guarded set
 * could put `bg-card` on a slide the congregation sees, defeating AC-4 of Story
 * 17.1 without touching any file that story's test reads. Styling a projected
 * slide from the outside is not a thing to make convenient.
 */
export default function SlideView({
  slide,
  backgroundOverride,
}: {
  slide: SlidePlanItem;
  backgroundOverride?: string | null;
}) {
  const slideKey =
    slide.artifact.instanceId ||
    `${slide.kind}-${slide.artifact.templateId || 'slide'}`;
  return (
    <ArtifactSlide
      key={slideKey}
      instance={slide.artifact}
      backgroundOverride={backgroundOverride}
    />
  );
}
