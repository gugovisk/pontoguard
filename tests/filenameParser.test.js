
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
