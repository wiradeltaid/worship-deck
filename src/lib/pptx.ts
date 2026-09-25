import type { ParsedRundown } from './parser';
import { buildSlidePlan, type SlidePlanMedia } from './slide-plan';
import { getSlideTransition } from './settings';
import {
  DEFAULT_SLIDE_TRANSITION,
  type SlideTransition,
} from './transitions';
import {
  generatePptxFromPlan,
  type DrawPlanItem,
  type GeneratePptxOptions,
} from './pptx-draw';

export { generatePptxFromPlan, type DrawPlanItem, type GeneratePptxOptions } from './pptx-draw';

/**
 * The configured style, or the default if the settings row cannot be read at
 * all. A database that will not answer must cost the deck its transitions, not
 * the service its slides.
 */
function configuredTransition(): SlideTransition {
  try {
    return getSlideTransition();
  } catch (error) {
    console.error(
      '[pptx] could not read the configured transition; using the default:',
      error
    );
    return DEFAULT_SLIDE_TRANSITION;
  }
}

export async function generatePptx(
  serviceDate: string,
  parsedData: ParsedRundown,
  images: string[] | SlidePlanMedia = [],
  transition?: SlideTransition,
  source?: { serviceId?: number },
  options?: GeneratePptxOptions
): Promise<Buffer> {
  const style = transition ?? configuredTransition();
  const plan = buildSlidePlan(serviceDate, parsedData, images, source);
  return generatePptxFromPlan(serviceDate, plan as DrawPlanItem[], style, undefined, options);
}
