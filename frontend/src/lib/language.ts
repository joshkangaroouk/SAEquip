/** "Arabic" for "ar", "Brazilian Portuguese" for "pt-br"; the code itself if the browser can't name it. */
export function languageName(code: string | null): string {
  if (!code) return "English";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
