export const nonWhitespaceStringJsonSchema = {
  type: "string",
  minLength: 1,
  pattern: "\\S",
} as const;

const predicateKeys = ["resourceId", "role", "textEquals", "textContains", "contentDescEquals", "contentDescContains"];
export const nodePredicateJsonSchema = {
  type: "object", additionalProperties: false, minProperties: 1,
  properties: Object.fromEntries(predicateKeys.map(key => [key, { type: "string", maxLength: 512 }])),
  anyOf: predicateKeys.map(key => ({ required: [key], properties: { [key]: nonWhitespaceStringJsonSchema } })),
} as const;

export const nodeMatcherJsonSchema = {
  ...nodePredicateJsonSchema,
  properties: { ...nodePredicateJsonSchema.properties, ancestor: nodePredicateJsonSchema, descendant: nodePredicateJsonSchema },
  anyOf: [...nodePredicateJsonSchema.anyOf, { required: ["ancestor"] }, { required: ["descendant"] }],
} as const;

export const selectorJsonSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    ancestor: nodePredicateJsonSchema,
    descendant: nodePredicateJsonSchema,
    id: nonWhitespaceStringJsonSchema,
    role: nonWhitespaceStringJsonSchema,
    text: nonWhitespaceStringJsonSchema,
    textContains: nonWhitespaceStringJsonSchema,
    desc: nonWhitespaceStringJsonSchema,
    descContains: nonWhitespaceStringJsonSchema,
  },
} as const;
