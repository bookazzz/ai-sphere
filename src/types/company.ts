export interface CompanyProduct {
  name: string;
  description: string;
  url?: string;
}

export interface CompanySection {
  title: string;
  content: string;
}

export interface Company {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  h1: string;
  founded: string;
  headquarters: string;
  website: string;
  products: CompanyProduct[];
  models: string[];           // model keys for pricing pages
  categories: string[];       // pricing category anchors
  image?: string;
  sections: CompanySection[];
}

export interface RouterCompany {
  slug: string;
  name: string;
  description: string;
}
