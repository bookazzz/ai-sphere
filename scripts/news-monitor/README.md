# AI-Sphere news pipeline

The default editorial mode is **balanced**. A reputable English source can be
enough to publish a Russian article. The generator must create a new structure,
explain terminology, add practical context and clearly label editorial analysis;
it must not produce a literal translation or synonym-based rewrite.

Publication is blocked only when the material has no usable facts or source,
contains an untraceable numeric claim, is effectively empty, has an invalid slug
or cannot be extracted even from a sufficiently detailed feed summary. A missing
second source, a brief article or a missing optional section is recorded as a
warning and does not stop balanced publication.

Runtime controls:

- `AISPHERE_NEWS_PROXY=http://user:password@host:port` routes RSS feeds, primary
  pages, secondary sources and OpenRouter through the same proxy. If omitted,
  the pipeline falls back to `AISPHERE_OPENROUTER_PROXY`.
- `NEWS_PROXY_REQUIRED=1` is the default and stops the run before any network
  request when no proxy is configured. Set it to `0` only for local diagnostics.
- `NEWS_STRICT_QA=1` makes every warning blocking for a temporary audit.
- `NEWS_MAX_AGE_HOURS=96` controls how far back feeds are considered.
- `NEWS_MIN_GENERATION_SCORE=0.42` controls general candidate quality.
- `NEWS_MIN_PRODUCT_RELEVANCE=0.05` controls relevance to AI-Sphere.
- `NEWS_MODEL_IDS` is a comma-separated OpenRouter fallback chain.

Run the local gate regression suite with `npm run test:news`.
