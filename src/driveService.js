import { parseFilename } from "./filenameParser.js";

/**
 * Organiza comprovantes por data e elimina duplicidades.
 *
 * Recebe uma lista de nomes de arquivos, interpreta os timestamps
 * e contabiliza somente marcações únicas.
 *
 * @param {string[]} filenames Lista de nomes dos arquivos.
 *
 * @returns {{
 *   byDate: Object,
 *   totalReceipts: number,
 *   ignoredFiles: number,
 *   duplicateFiles: number
 * }}
 */
export function summarizeReceipts(filenames) {
  // Valida se a entrada é uma lista.
  if (!Array.isArray(filenames)) {
    throw new TypeError("filenames must be an array");
  }

  // Armazena a quantidade de comprovantes por data.
  const byDate = {};

  // Guarda os timestamps já encontrados.
  const seenTimestamps = new Set();

  let totalReceipts = 0;
  let ignoredFiles = 0;
  let duplicateFiles = 0;

  for (const filename of filenames) {
    // Interpreta o nome do arquivo.
    const receipt = parseFilename(filename);

    // Ignora nomes que não seguem o padrão esperado.
    if (!receipt) {
      ignoredFiles++;
      continue;
    }

    // Verifica se o timestamp já foi contabilizado.
    if (seenTimestamps.has(receipt.timestamp)) {
      duplicateFiles++;
      continue;
    }

    // Registra o timestamp como já processado.
    seenTimestamps.add(receipt.timestamp);

    // Agrupa o comprovante pela data.
    const date = receipt.date;

    byDate[date] = (byDate[date] || 0) + 1;

    // Incrementa o total de comprovantes únicos.
    totalReceipts++;
  }

  // Retorna o resumo do processamento.
  return {
    byDate,
    totalReceipts,
    ignoredFiles,
    duplicateFiles
  };
}