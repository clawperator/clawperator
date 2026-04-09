export const nonWhitespaceStringJsonSchema = {
  type: "string",
  minLength: 1,
  pattern: "\\S",
} as const;

export const selectorJsonSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    id: nonWhitespaceStringJsonSchema,
    role: nonWhitespaceStringJsonSchema,
    text: nonWhitespaceStringJsonSchema,
    textContains: nonWhitespaceStringJsonSchema,
    desc: nonWhitespaceStringJsonSchema,
    descContains: nonWhitespaceStringJsonSchema,
  },
} as const;
