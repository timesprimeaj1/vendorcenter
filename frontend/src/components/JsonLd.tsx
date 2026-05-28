interface JsonLdProps {
  schema: Record<string, unknown> | Record<string, unknown>[];
}

export function JsonLd({ schema }: JsonLdProps) {
  // Return null if schema is empty or invalid
  if (!schema) return null;
  const schemas = Array.isArray(schema) ? schema : [schema];
  if (schemas.length === 0) return null;
  // Validate each schema has @type
  const valid = schemas.filter(s => s && s['@type']);
  if (valid.length === 0) return null;

  // Add @context if missing
  const withContext = valid.map(s => ({
    '@context': 'https://schema.org',
    ...s,
  }));

  const content = withContext.length === 1 ? withContext[0] : withContext;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(content) }}
    />
  );
}
