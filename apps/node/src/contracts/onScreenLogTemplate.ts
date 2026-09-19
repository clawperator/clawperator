/** Closed vocabulary and delimiter grammar, mirrored by Android OnScreenLogTemplate. */
export const onScreenLogTemplateNames = [
  "foreground_app.icon", "foreground_app.package_name", "foreground_app.version_code",
  "foreground_app.version_name", "device.manufacturer", "device.model",
  "system.language_code", "system.language_tag", "system.language_name",
] as const;

export function validateOnScreenLogTemplate(template: string): string | undefined {
  for (let index = 0; index < template.length;) {
    // Quadrupled delimiters are literal double delimiters, on either side.
    if (template.startsWith("{{{{", index) || template.startsWith("}}}}", index)) {
      index += 4;
    } else if (template.startsWith("{{", index)) {
      const end = template.indexOf("}}", index + 2);
      const name = end < 0 ? "" : template.slice(index + 2, end);
      if (!(onScreenLogTemplateNames as readonly string[]).includes(name)) return invalidTemplate();
      index = end + 2;
    } else if (template.startsWith("}}", index)) {
      return invalidTemplate();
    } else {
      index += 1;
    }
  }
  return undefined;
}

function invalidTemplate(): string {
  return `Invalid template placeholder; supported names: ${onScreenLogTemplateNames.join(", ")}. Escape delimiters as {{{{ and }}}}.`;
}
