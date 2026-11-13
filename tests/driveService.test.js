import test from "node:test";
import assert from "node:assert/strict";

import { summarizeReceipts } from "../src/driveService.js";

test("deve contar quatro comprovantes no mesmo dia", () => {
  const filenames = [
    "Comprovante_Ponto_Mobile_1770416909454.jpg",
    "Comprovante_Ponto_Mobile_1770420509454.jpg",
    "Comprovante_Ponto_Mobile_1770431309454.jpg",
    "Comprovante_Ponto_Mobile_1770434909454.jpg"
  ];

  const result = summarizeReceipts(filenames);

  assert.equal(result.byDate["2026-02-06"], 4);
  assert.equal(result.totalReceipts, 4);
  assert.equal(result.ignoredFiles, 0);
});

test("deve separar comprovantes de datas diferentes", () => {
  const filenames = [
    "Comprovante_Ponto_Mobile_1770416909454.jpg",
    "Comprovante_Ponto_Mobile_1770503309454.jpg"
  ];

  const result = summarizeReceipts(filenames);

  assert.equal(result.byDate["2026-02-06"], 1);
  assert.equal(result.byDate["2026-02-07"], 1);
});

test("deve ignorar arquivos com nomes inválidos", () => {
  const filenames = [
    "Comprovante_Ponto_Mobile_1770416909454.jpg",
    "imagem_qualquer.jpg",
    "documento.pdf"
  ];

  const result = summarizeReceipts(filenames);

  assert.equal(result.totalReceipts, 1);
  assert.equal(result.ignoredFiles, 2);
});

test("deve retornar resultado vazio para lista vazia", () => {
  const result = summarizeReceipts([]);

  assert.deepEqual(result, {
    byDate: {},
    totalReceipts: 0,
    ignoredFiles: 0
  });
});

test("deve rejeitar entradas que não sejam listas", () => {
  assert.throws(
    () => summarizeReceipts(null),
    TypeError
  );
});