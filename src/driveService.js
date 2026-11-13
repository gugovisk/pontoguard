import { parseFilename } from "./filenameParser.js";

/**
 * Organiza os comprovantes por data.
 *
 * Recebe somente nomes de arquivos.
 * Não acessa nem modifica arquivos reais.
 *
 * @param {string[]} filenames
 * @returns {{
 *   byDate: Object,
 *   totalReceipts: number,
 *   ignoredFiles: number
 * }}
 */
export function summarizeReceipts(filenames) {
  if (!Array.isArray(filenames)) {
    throw new TypeError("filenames must be an array");
  }

  const byDate = {};
  let totalReceipts = 0;
  let ignoredFiles = 0;

  for (const filename of filenames) {
    const receipt = parseFilename(filename);

    if (!receipt) {
      ignoredFiles++;
      continue;
    }

    const date = receipt.date;

    byDate[date] = (byDate[date] || 0) + 1;
    totalReceipts++;
  }

  return {
    byDate,
    totalReceipts,
    ignoredFiles
  };
}