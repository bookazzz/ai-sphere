import { AnySection } from '@/types/seo-page';
import type { FC } from 'react';

import TextBlockSection from './sections/TextBlockSection';
import UseCasesSectionBlock from './sections/UseCasesSection';
import ModelComparisonBlock from './sections/ModelComparisonBlock';
import StepByStepBlock from './sections/StepByStepBlock';
import PromptExamplesBlock from './sections/PromptExamplesBlock';
import ResultExamplesBlock from './sections/ResultExamplesBlock';
import SupportedFormatsBlock from './sections/SupportedFormatsBlock';
import TroubleshootingBlock from './sections/TroubleshootingBlock';
import MethodologyBlock from './sections/MethodologyBlock';
import RatingTableBlock from './sections/RatingTableBlock';
import RecommendationsBlock from './sections/RecommendationsBlock';
import TableOfContentsBlock from './sections/TableOfContentsBlock';
import RecommendedModelsBlock from './sections/RecommendedModelsBlock';
import CTABlock from './sections/CTABlock';

/** Реестр компонентов по типу секции */
const sectionRegistry: Record<string, FC<{ section: any }>> = {
  introduction: TextBlockSection,
  capabilities: TextBlockSection,
  limitations: TextBlockSection,
  howToRun: TextBlockSection,
  textBlock: TextBlockSection,
  useCases: UseCasesSectionBlock,
  modelComparison: ModelComparisonBlock,
  stepByStep: StepByStepBlock,
  promptExamples: PromptExamplesBlock,
  resultExamples: ResultExamplesBlock,
  supportedFormats: SupportedFormatsBlock,
  troubleshooting: TroubleshootingBlock,
  methodology: MethodologyBlock,
  ratingTable: RatingTableBlock,
  recommendations: RecommendationsBlock,
  tableOfContents: TableOfContentsBlock,
  recommendedModels: RecommendedModelsBlock,
  ctaBlock: CTABlock,
};

interface Props {
  section: AnySection;
}

export default function SectionRenderer({ section }: Props) {
  const Component = sectionRegistry[section.type];
  if (!Component) {
    console.warn(`[SectionRenderer] Unknown section type: ${section.type}`);
    return null;
  }
  return <Component section={section} />;
}
