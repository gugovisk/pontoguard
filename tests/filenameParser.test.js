import test from "node:test";
import assert from "node:assert/strict";

import { parseFilename } from "../src/filenameParser.js";

test("deve interpretar corretamente um comprovante", () => {
  const result = parseFilename(
    "Comprovante_Ponto_Mobile_1770416909454.jpg"
  );

  assert.deepEqual(result, {
    timestamp: 1770416909454,
    date: "2026-02-06",
    time: "19:28:29"
  });
});

test("deve rejeitar arquivos com nomes inválidos", () => {
  const result = parseFilename("imagem_qualquer.jpg");

  assert.equal(result, null);
});

test("deve rejeitar valores que não sejam texto", () => {
  assert.equal(parseFilename(null), null);
});

test("deve aceitar extensão PNG", () => {
  const result = parseFilename(
    "Comprovante_Ponto_Mobile_1770416909454.png"
  );

  assert.notEqual(result, null);
});

test("deve rejeitar timestamp com quantidade incorreta de dígitos", () => {
  const result = parseFilename(
    "Comprovante_Ponto_Mobile_17704169094.jpg"
  );

  assert.equal(result, null);
});

test("deve rejeitar timestamp com caracteres não numéricos", () => {
  const result = parseFilename(
    "Comprovante_Ponto_Mobile_17704169094AB.jpg"
  );

  assert.equal(result, null);
});

test("deve identificar corretamente datas diferentes", () => {
  const first = parseFilename(
    "Comprovante_Ponto_Mobile_1770416909454.jpg"
  );

  const second = parseFilename(
    "Comprovante_Ponto_Mobile_1770503309454.jpg"
  );

  assert.equal(first.date, "2026-02-06");
  assert.equal(second.date, "2026-02-07");

  assert.notEqual(first.date, second.date);
});