import type { Company, RouterCompany } from '@/types/company';
import { openai } from './openai';
import { anthropic } from './anthropic';
import { google } from './google-deepmind';
import { meta } from './meta-ai';
import { mistral } from './mistral-ai';
import { xai } from './xai';
import { deepseek } from './deepseek';

const companies: Record<string, Company> = {
  openai,
  anthropic,
  'google-deepmind': google,
  'meta-ai': meta,
  'mistral-ai': mistral,
  xai,
  deepseek,
};

export function getCompany(slug: string): Company | null {
  return companies[slug] ?? null;
}

export function getAllCompanySlugs(): string[] {
  return Object.keys(companies);
}

export function getAllCompanies(): RouterCompany[] {
  return Object.values(companies).map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
  }));
}
