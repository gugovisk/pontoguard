
/*
 * PONTOGUARD
 * Integração Google Apps Script
 *
 * Funcionalidades:
 * - Leitura de comprovantes no Google Drive.
 * - Identificação de folgas no Google Calendar.
 * - Contagem de comprovantes únicos.
 * - Envio de lembretes pelo Telegram.
 * - Persistência de notificações por data.
 * - Controle dos estados SENDING, SENT, FAILED e UNKNOWN.
 * - Bloqueio de execuções simultâneas com LockService.
 *
 * Credenciais e identificadores devem permanecer nas
 * Script Properties, nunca diretamente neste arquivo.
 */

const TIME_ZONE = "America/Sao_Paulo";
const LIMITE_COMPROVANTES = 4;
const SCHEMA_VERSION = 1;

const NOTIFICATION_STATUS = Object.freeze({
  SENDING: "SENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN"
});

// ============================================================
// 1. CONFIGURAÇÕES E SERVIÇOS
// ============================================================

function obterPropriedades_() {
  return PropertiesService.getScriptProperties();
}

function obterFolderId_() {
  const folderId = obterPropriedades_().getProperty("FOLDER_ID");

  if (!folderId) {
    throw new Error(
      "A propriedade FOLDER_ID não está configurada."
    );
  }

  return folderId;
}

function obterCredenciaisTelegram_() {
  const propriedades = obterPropriedades_();

  const token = propriedades.getProperty("TELEGRAM_BOT_TOKEN");
  const chatId = propriedades.getProperty("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    throw new Error(
      "Token ou chat_id do Telegram não configurado."
    );
  }

  return {
    token: token,
    chatId: chatId
  };
}

// ============================================================
// 2. VALIDAÇÃO E MANIPULAÇÃO DE DATAS
// ============================================================

function validarData_(data) {
  if (
    typeof data !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data)
  ) {
    throw new TypeError(
      "A data deve utilizar o formato YYYY-MM-DD."
    );
  }

  const partes = data.split("-").map(Number);

  const dataUTC = new Date(
    Date.UTC(partes[0], partes[1] - 1, partes[2])
  );

  if (
    dataUTC.getUTCFullYear() !== partes[0] ||
    dataUTC.getUTCMonth() !== partes[1] - 1 ||
    dataUTC.getUTCDate() !== partes[2]
  ) {
    throw new TypeError("Data inválida.");
  }
}

function criarDataLocal_(dataTexto) {
  validarData_(dataTexto);

  const partes = dataTexto.split("-").map(Number);

  return new Date(
    partes[0],
    partes[1] - 1,
    partes[2],
    12
  );
}

function obterDataAtualLocal_() {
  return Utilities.formatDate(
    new Date(),
    TIME_ZONE,
    "yyyy-MM-dd"
  );
}

// ============================================================
// 3. ARMAZENAMENTO PERSISTENTE DE NOTIFICAÇÕES
// ============================================================

function obterChaveNotificacao_(data) {
  validarData_(data);

  return "PONTOGUARD_NOTIFICATION_" + data;
}

function validarRegistroNotificacao_(registro) {
  if (!registro || typeof registro !== "object") {
    throw new TypeError("Registro de notificação inválido.");
  }

  validarData_(registro.date);

  if (registro.schemaVersion !== SCHEMA_VERSION) {
    throw new Error("Versão do registro de notificação inválida.");
  }

  const estadosPermitidos = Object.values(NOTIFICATION_STATUS);

  if (!estadosPermitidos.includes(registro.status)) {
    throw new Error("Estado de notificação inválido.");
  }

  if (
    !Number.isInteger(registro.attempts) ||
    registro.attempts < 1
  ) {
    throw new Error("Número de tentativas inválido.");
  }

  if (
    typeof registro.createdAt !== "string" ||
    typeof registro.updatedAt !== "string" ||
    typeof registro.lastAttemptAt !== "string"
  ) {
    throw new Error("Datas do registro inválidas.");
  }

  if (
    registro.sentAt !== null &&
    typeof registro.sentAt !== "string"
  ) {
    throw new Error("sentAt inválido.");
  }

  if (
    registro.lastError !== null &&
    typeof registro.lastError !== "string"
  ) {
    throw new Error("lastError inválido.");
  }

  return registro;
}

function obterRegistroNotificacao_(data) {
  const propriedades = obterPropriedades_();
  const chave = obterChaveNotificacao_(data);

  const conteudo = propriedades.getProperty(chave);

  if (conteudo === null) {
    return null;
  }

  let registro;

  try {
    registro = JSON.parse(conteudo);
  } catch (erro) {
    throw new Error(
      "O registro armazenado contém JSON inválido: " + data
    );
  }

  return validarRegistroNotificacao_(registro);
}

function salvarRegistroNotificacao_(registro) {
  validarRegistroNotificacao_(registro);

  const propriedades = obterPropriedades_();
  const chave = obterChaveNotificacao_(registro.date);

  propriedades.setProperty(
    chave,
    JSON.stringify(registro)
  );

  return registro;
}

function criarRegistroNotificacao_(data) {
  validarData_(data);

  if (obterRegistroNotificacao_(data)) {
    throw new Error(
      "Já existe um registro de notificação para " + data
    );
  }

  const agora = new Date().toISOString();

  const registro = {
    schemaVersion: SCHEMA_VERSION,
    date: data,
    status: NOTIFICATION_STATUS.SENDING,
    attempts: 1,
    createdAt: agora,
    updatedAt: agora,
    lastAttemptAt: agora,
    sentAt: null,
    lastError: null
  };

  return salvarRegistroNotificacao_(registro);
}

function transicaoPermitida_(estadoAtual, proximoEstado) {
  const transicoes = {
    SENDING: ["SENT", "FAILED", "UNKNOWN"],
    FAILED: ["SENDING"],
    UNKNOWN: ["SENT", "FAILED"],
    SENT: []
  };

  return (
    transicoes[estadoAtual] &&
    transicoes[estadoAtual].includes(proximoEstado)
  );
}

function transicionarNotificacao_(
  data,
  proximoEstado,
  opcoes
) {
  validarData_(data);

  opcoes = opcoes || {};

  const registro = obterRegistroNotificacao_(data);

  if (!registro) {
    throw new Error(
      "Registro de notificação não encontrado: " + data
    );
  }

  if (
    !transicaoPermitida_(
      registro.status,
      proximoEstado
    )
  ) {
    throw new Error(
      "Transição inválida: " +
      registro.status +
      " -> " +
      proximoEstado
    );
  }

  const agora = new Date().toISOString();

  registro.status = proximoEstado;
  registro.updatedAt = agora;

  if (proximoEstado === NOTIFICATION_STATUS.SENDING) {
    registro.attempts++;
    registro.lastAttemptAt = agora;
    registro.lastError = null;
  }

  if (proximoEstado === NOTIFICATION_STATUS.SENT) {
    registro.sentAt = agora;
    registro.lastError = null;
  }

  if (proximoEstado === NOTIFICATION_STATUS.FAILED) {
    registro.lastError =
      typeof opcoes.error === "string"
        ? opcoes.error
        : "Falha confirmada no envio.";
  }

  if (proximoEstado === NOTIFICATION_STATUS.UNKNOWN) {
    registro.lastError =
      typeof opcoes.error === "string"
        ? opcoes.error
        : "Resultado do envio desconhecido.";
  }

  return salvarRegistroNotificacao_(registro);
}

// ============================================================
// 4. RECONCILIAÇÃO MANUAL
// ============================================================

/*
 * Utilizar somente depois de verificar manualmente o Telegram.
 *
 * Se a mensagem foi recebida:
 * reconciliarNotificacao("2026-11-19", "SENT")
 *
 * Se a mensagem não foi recebida:
 * reconciliarNotificacao("2026-11-19", "FAILED")
 *
 * Essa função não envia mensagens.
 */

function reconciliarNotificacaoComBloqueio_(data, resultado) {
  validarData_(data);

  if (
    resultado !== NOTIFICATION_STATUS.SENT &&
    resultado !== NOTIFICATION_STATUS.FAILED
  ) {
    throw new Error(
      "O resultado deve ser SENT ou FAILED."
    );
  }

  const registro = obterRegistroNotificacao_(data);

  if (!registro) {
    throw new Error("Registro não encontrado.");
  }

  if (
    registro.status !== NOTIFICATION_STATUS.UNKNOWN &&
    registro.status !== NOTIFICATION_STATUS.SENDING
  ) {
    throw new Error(
      "Somente registros SENDING ou UNKNOWN podem ser reconciliados."
    );
  }

  const opcoes = resultado === NOTIFICATION_STATUS.FAILED
    ? { error: "Falha confirmada durante reconciliação manual." }
    : {};

  const atualizado = transicionarNotificacao_(
    data,
    resultado,
    opcoes
  );

  console.log(
    "Reconciliação concluída: " +
    data +
    " -> " +
    atualizado.status
  );

  return atualizado;
}


function reconciliarNotificacao(data, resultado) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    throw new Error(
      "Não foi possível obter o bloqueio do PontoGuard. " +
      "Nenhuma reconciliação foi realizada. Tente novamente."
    );
  }

  try {
    return reconciliarNotificacaoComBloqueio_(data, resultado);
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

// ============================================================
// 5. LEITURA E RESUMO DOS COMPROVANTES
// ============================================================

function obterResumoComprovantes_(dataAlvo) {
  validarData_(dataAlvo);

  const pasta = DriveApp.getFolderById(obterFolderId_());
  const arquivos = pasta.getFiles();

  const padrao =
    /^Comprovante_Ponto_Mobile_(\d{13})\.(jpg|jpeg|png|webp)$/i;

  const timestampsEncontrados = {};

  let totalComprovantes = 0;
  let duplicados = 0;
  let ignorados = 0;

  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    const nome = arquivo.getName();

    const resultado = nome.match(padrao);

    if (!resultado) {
      if (nome.startsWith("Comprovante_Ponto_Mobile_")) {
        ignorados++;
      }

      continue;
    }

    const timestamp = Number(resultado[1]);
    const dataComprovante = new Date(timestamp);

    if (
      !Number.isFinite(timestamp) ||
      isNaN(dataComprovante.getTime())
    ) {
      ignorados++;
      continue;
    }

    const dataArquivo = Utilities.formatDate(
      dataComprovante,
      TIME_ZONE,
      "yyyy-MM-dd"
    );

    if (dataArquivo !== dataAlvo) {
      continue;
    }

    const chave = String(timestamp);

    if (
      Object.prototype.hasOwnProperty.call(
        timestampsEncontrados,
        chave
      )
    ) {
      duplicados++;
      continue;
    }

    timestampsEncontrados[chave] = true;
    totalComprovantes++;
  }

  return {
    totalComprovantes: totalComprovantes,
    duplicados: duplicados,
    ignorados: ignorados
  };
}

// ============================================================
// 6. CONSULTA DE FOLGA
// ============================================================

function verificarFolga_(dataAlvo) {
  const data = criarDataLocal_(dataAlvo);

  const calendario = CalendarApp.getDefaultCalendar();
  const eventos = calendario.getEventsForDay(data);

  return eventos.some(function(evento) {
    return evento.getTitle().trim() === "Folga";
  });
}

// ============================================================
// 7. ENVIO DE NOTIFICAÇÃO PELO TELEGRAM
// ============================================================

function enviarNotificacaoTelegram_(data, quantidade) {
  const credenciais = obterCredenciaisTelegram_();

  const mensagem =
    "⚠️ Atenção: comprovantes de ponto\n\n" +
    "Foram identificados apenas " +
    quantidade +
    " dos 4 comprovantes esperados para " +
    data +
    ".\n\n" +
    "Confira suas marcações e, se necessário, realize a marcação manual.";

  const url =
    "https://api.telegram.org/bot" +
    credenciais.token +
    "/sendMessage";

  return UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: credenciais.chatId,
      text: mensagem
    }),
    muteHttpExceptions: true
  });
}

// ============================================================
// 8. MIGRAÇÃO DO CONTROLE ANTIGO
// ============================================================

/*
 * A implementação anterior utilizava uma propriedade única:
 * ULTIMA_DATA_NOTIFICADA.
 *
 * Se ela indicar que o alerta da data já foi enviado,
 * criamos um registro SENT para evitar um segundo envio.
 */

function migrarRegistroAntigo_(data) {
  const propriedades = obterPropriedades_();

  const ultimaDataNotificada = propriedades.getProperty(
    "ULTIMA_DATA_NOTIFICADA"
  );

  if (ultimaDataNotificada !== data) {
    return null;
  }

  const registro = criarRegistroNotificacao_(data);

  const atualizado = transicionarNotificacao_(
    data,
    NOTIFICATION_STATUS.SENT
  );

  console.log(
    "Registro antigo migrado para SENT: " + data
  );

  return atualizado;
}

// ============================================================
// 9. CONFERÊNCIA AUTOMÁTICA DO PONTO
// ============================================================

function executarConferenciaPonto_() {
  const agora = new Date();

  const horaAtual = Number(
    Utilities.formatDate(agora, TIME_ZONE, "H")
  );

  // Permite somente execuções entre 23h e 00h.
  if (horaAtual !== 23 && horaAtual !== 0) {
    console.log(
      "Fora do horário permitido. Conferência cancelada."
    );
    return;
  }

  // Identifica a data do turno encerrado.
  let dataAlvo = criarDataLocal_(
    obterDataAtualLocal_()
  );

  if (horaAtual === 0) {
    dataAlvo.setDate(dataAlvo.getDate() - 1);
  }

  const DATA_CONFERENCIA = Utilities.formatDate(
    dataAlvo,
    TIME_ZONE,
    "yyyy-MM-dd"
  );

  console.log(
    "Data da conferência: " + DATA_CONFERENCIA
  );

  // 1. Verifica folga.
  const temFolga = verificarFolga_(DATA_CONFERENCIA);

  if (temFolga) {
    console.log(
      "Dia de folga. Nenhum lembrete será enviado."
    );
    return;
  }

  // 2. Conta comprovantes.
  const resumo = obterResumoComprovantes_(
    DATA_CONFERENCIA
  );

  const totalComprovantes = resumo.totalComprovantes;

  console.log(
    "Comprovantes únicos: " + totalComprovantes
  );

  console.log(
    "Duplicados: " + resumo.duplicados
  );

  console.log(
    "Arquivos ignorados: " + resumo.ignorados
  );

  // 3. Se a quantidade estiver correta, encerra.
  if (totalComprovantes >= LIMITE_COMPROVANTES) {
    console.log(
      "Quantidade correta. Nenhum lembrete necessário."
    );
    return;
  }

  // 4. Recupera o registro persistente.
  let registro = obterRegistroNotificacao_(
    DATA_CONFERENCIA
  );

  // 5. Migra o controle antigo, se necessário.
  if (!registro) {
    registro = migrarRegistroAntigo_(
      DATA_CONFERENCIA
    );
  }

  if (registro) {
    if (registro.status === NOTIFICATION_STATUS.SENT) {
      console.log(
        "Notificação já enviada para esta data."
      );
      return;
    }

    if (registro.status === NOTIFICATION_STATUS.SENDING) {
      console.log(
        "Existe uma execução anterior em SENDING. " +
        "Não haverá reenvio automático."
      );
      return;
    }

    if (registro.status === NOTIFICATION_STATUS.UNKNOWN) {
      console.log(
        "Resultado anterior desconhecido. " +
        "É necessária reconciliação manual."
      );
      return;
    }

    if (registro.status === NOTIFICATION_STATUS.FAILED) {
      console.log(
        "Falha anterior confirmada. Nova tentativa permitida."
      );

      registro = transicionarNotificacao_(
        DATA_CONFERENCIA,
        NOTIFICATION_STATUS.SENDING
      );
    }
  } else {
    // 6. Registra a tentativa antes de enviar.
    registro = criarRegistroNotificacao_(
      DATA_CONFERENCIA
    );
  }

  // 7. Envia a mensagem.
  let resposta;

  try {
    resposta = enviarNotificacaoTelegram_(
      DATA_CONFERENCIA,
      totalComprovantes
    );
  } catch (erro) {
    // A chamada pode ter chegado ao Telegram,
    // mas o resultado não foi recebido pelo Apps Script.
    try {
      transicionarNotificacao_(
        DATA_CONFERENCIA,
        NOTIFICATION_STATUS.UNKNOWN,
        {
          error: String(erro.message || erro)
        }
      );
    } catch (erroEstado) {
      console.error(
        "Não foi possível registrar UNKNOWN: " +
        erroEstado.message
      );
    }

    throw new Error(
      "Resultado do envio desconhecido. " +
      "Verifique o Telegram antes de reconciliar. " +
      erro.message
    );
  }

  // 8. Interpreta a resposta do Telegram.
  let resultado;

  try {
    resultado = JSON.parse(
      resposta.getContentText()
    );
  } catch (erro) {
    transicionarNotificacao_(
      DATA_CONFERENCIA,
      NOTIFICATION_STATUS.UNKNOWN,
      {
        error: "Resposta do Telegram não pôde ser interpretada."
      }
    );

    throw new Error(
      "Resposta inválida do Telegram. Estado UNKNOWN."
    );
  }

  // 9. Falha explicitamente confirmada.
  if (
    resposta.getResponseCode() !== 200 ||
    !resultado.ok
  ) {
    const descricao =
      resultado.description ||
      "Erro desconhecido do Telegram.";

    transicionarNotificacao_(
      DATA_CONFERENCIA,
      NOTIFICATION_STATUS.FAILED,
      {
        error: descricao
      }
    );

    throw new Error(
      "Falha confirmada no Telegram: " + descricao
    );
  }

  // 10. Sucesso confirmado.
  const registroFinal = transicionarNotificacao_(
    DATA_CONFERENCIA,
    NOTIFICATION_STATUS.SENT
  );

  // Mantém a propriedade antiga atualizada
  // durante o período de transição.
  obterPropriedades_().setProperty(
    "ULTIMA_DATA_NOTIFICADA",
    DATA_CONFERENCIA
  );

  console.log(
    "Lembrete enviado e registrado com sucesso!"
  );

  console.log(
    "Estado: " + registroFinal.status
  );

  console.log(
    "Tentativas: " + registroFinal.attempts
  );

  console.log(
    "Comprovantes encontrados: " + totalComprovantes
  );
}


/*
 * Ponto de entrada do acionador.
 *
 * O bloqueio impede que duas execuções do mesmo projeto
 * processem simultaneamente a conferência diária.
 */
function conferirPontoDiario() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    console.log(
      "Outra execução ainda está utilizando o PontoGuard. " +
      "Esta execução foi encerrada sem processar notificações."
    );
    return;
  }

  try {
    executarConferenciaPonto_();
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
      console.log("Bloqueio da conferência liberado.");
    }
  }
}

// ============================================================
// 10. TESTES DO ARMAZENAMENTO PERSISTENTE
// ============================================================

/*
 * Executa um teste isolado com uma data reservada.
 *
 * Cria um registro, recupera, altera o estado e verifica
 * a persistência real em Script Properties.
 *
 * O registro de teste é removido ao final.
 */

function testarArmazenamentoNotificacoes() {
  const dataTeste = "2099-12-31";

  const propriedades = obterPropriedades_();
  const chave = obterChaveNotificacao_(dataTeste);

  // Remove eventual resíduo de teste anterior.
  propriedades.deleteProperty(chave);

  try {
    console.log("Iniciando teste de armazenamento.");

    // 1. Confirma ausência inicial.
    let registro = obterRegistroNotificacao_(dataTeste);

    if (registro !== null) {
      throw new Error(
        "O registro deveria estar vazio."
      );
    }

    // 2. Cria o registro.
    registro = criarRegistroNotificacao_(dataTeste);

    if (registro.status !== NOTIFICATION_STATUS.SENDING) {
      throw new Error("Estado inicial incorreto.");
    }

    if (registro.attempts !== 1) {
      throw new Error("Quantidade inicial de tentativas incorreta.");
    }

    // 3. Recupera o registro.
    registro = obterRegistroNotificacao_(dataTeste);

    if (!registro || registro.status !== "SENDING") {
      throw new Error("Falha ao recuperar o registro.");
    }

    // 4. Transiciona para SENT.
    registro = transicionarNotificacao_(
      dataTeste,
      NOTIFICATION_STATUS.SENT
    );

    if (registro.status !== NOTIFICATION_STATUS.SENT) {
      throw new Error("Falha ao atualizar o estado.");
    }

    // 5. Confirma persistência após nova leitura.
    const registroFinal = obterRegistroNotificacao_(
      dataTeste
    );

    if (
      !registroFinal ||
      registroFinal.status !== NOTIFICATION_STATUS.SENT
    ) {
      throw new Error(
        "O estado final não foi persistido corretamente."
      );
    }

    console.log(
      "TESTE APROVADO: criação, leitura, atualização e persistência."
    );

  } finally {
    // Remove somente a chave reservada para este teste.
    propriedades.deleteProperty(chave);
    console.log("Registro de teste removido.");
  }
}

// ============================================================
// 11. TESTES DE LEITURA DO GOOGLE DRIVE
// ============================================================

function testarLeituraDrive() {
  const pasta = DriveApp.getFolderById(obterFolderId_());
  const arquivos = pasta.getFiles();

  const nomes = [];

  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    const nome = arquivo.getName();

    if (nome.startsWith("Comprovante_Ponto_Mobile_")) {
      nomes.push(nome);
    }
  }

  console.log("Pasta consultada: " + pasta.getName());
  console.log("Total de comprovantes: " + nomes.length);

  nomes.forEach(function(nome) {
    console.log(nome);
  });
}

function testarResumoPorDataDrive() {
  const pasta = DriveApp.getFolderById(obterFolderId_());
  const arquivos = pasta.getFiles();

  const byDate = {};
  const seenTimestamps = {};

  let totalReceipts = 0;
  let ignoredFiles = 0;
  let duplicateFiles = 0;

  const pattern =
    /^Comprovante_Ponto_Mobile_(\d{13})\.(jpg|jpeg|png|webp)$/i;

  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    const nome = arquivo.getName();

    const match = nome.match(pattern);

    if (!match) {
      ignoredFiles++;
      continue;
    }

    const timestamp = Number(match[1]);
    const date = new Date(timestamp);

    if (!Number.isFinite(timestamp) || isNaN(date.getTime())) {
      ignoredFiles++;
      continue;
    }

    const timestampKey = String(timestamp);

    if (
      Object.prototype.hasOwnProperty.call(
        seenTimestamps,
        timestampKey
      )
    ) {
      duplicateFiles++;
      continue;
    }

    seenTimestamps[timestampKey] = true;

    const dateKey = Utilities.formatDate(
      date,
      TIME_ZONE,
      "yyyy-MM-dd"
    );

    byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    totalReceipts++;
  }

  console.log("Resumo dos comprovantes:");

  console.log(JSON.stringify({
    byDate: byDate,
    totalReceipts: totalReceipts,
    ignoredFiles: ignoredFiles,
    duplicateFiles: duplicateFiles
  }, null, 2));
}

// ============================================================
// 12. TESTES DO GOOGLE CALENDAR
// ============================================================

function testarConsultaFolga() {
  const dataTeste = "2026-11-16";

  const data = criarDataLocal_(dataTeste);

  const calendario = CalendarApp.getDefaultCalendar();
  const eventos = calendario.getEventsForDay(data);

  const titulos = eventos.map(function(evento) {
    return evento.getTitle();
  });

  const temFolga = titulos.some(function(titulo) {
    return titulo.trim() === "Folga";
  });

  console.log("Data consultada: " + dataTeste);
  console.log("Eventos encontrados: " + JSON.stringify(titulos));
  console.log("É dia de folga? " + temFolga);
}

// ============================================================
// 13. TESTE INTEGRADO HISTÓRICO
// ============================================================

function testarConferenciaIntegrada() {
  const DATA_TESTE = "2026-11-05";

  const data = criarDataLocal_(DATA_TESTE);

  // 1. Consulta o Google Agenda.
  const calendario = CalendarApp.getDefaultCalendar();
  const eventos = calendario.getEventsForDay(data);

  const temFolga = eventos.some(function(evento) {
    return evento.getTitle().trim() === "Folga";
  });

  console.log("Data analisada: " + DATA_TESTE);
  console.log("Folga encontrada: " + temFolga);

  if (temFolga) {
    console.log(
      "RESULTADO: DIA DE FOLGA. Nenhum lembrete necessário."
    );
    return;
  }

  // 2. Consulta os comprovantes.
  const resumo = obterResumoComprovantes_(DATA_TESTE);

  console.log(
    "Comprovantes únicos: " + resumo.totalComprovantes
  );

  console.log(
    "Duplicados: " + resumo.duplicados
  );

  console.log(
    "Arquivos ignorados: " + resumo.ignorados
  );

  // 3. Simula a decisão. Não envia mensagens.
  if (resumo.totalComprovantes < LIMITE_COMPROVANTES) {
    console.log("RESULTADO: SIMULARIA UM LEMBRETE.");
  } else {
    console.log("RESULTADO: QUANTIDADE DE COMPROVANTES OK.");
  }
}

// ============================================================
// 14. TESTE DE ENVIO DO TELEGRAM
// ============================================================

function testarEnvioTelegram() {
  const credenciais = obterCredenciaisTelegram_();

  const url =
    "https://api.telegram.org/bot" +
    credenciais.token +
    "/sendMessage";

  const resposta = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: credenciais.chatId,
      text:
        "✅ PontoGuard conectado!\n\n" +
        "Este é um teste de comunicação com o Telegram."
    }),
    muteHttpExceptions: true
  });

  const resultado = JSON.parse(
    resposta.getContentText()
  );

  if (
    resposta.getResponseCode() !== 200 ||
    !resultado.ok
  ) {
    throw new Error(
      "Falha no envio: " +
      (resultado.description || "Erro desconhecido.")
    );
  }

  console.log("Mensagem enviada com sucesso!");
}


// ============================================================
// 15. TESTES DAS TRANSIÇÕES DE ESTADO
// ============================================================

/*
 * Testa os caminhos FAILED, nova tentativa, UNKNOWN e SENT.
 *
 * Não acessa Google Drive, Google Calendar ou Telegram.
 * Utiliza somente uma chave temporária nas Script Properties.
 * A chave é removida ao final, inclusive se algum teste falhar.
 */

function testarTransicoesNotificacao() {
  const dataTeste = "2099-12-30";
  const propriedades = obterPropriedades_();
  const chave = obterChaveNotificacao_(dataTeste);

  // Remove eventual resíduo de uma execução anterior.
  propriedades.deleteProperty(chave);

  function exigir(condicao, mensagem) {
    if (!condicao) {
      throw new Error(mensagem);
    }
  }

  function exigirFalha(callback, mensagem) {
    let falhou = false;

    try {
      callback();
    } catch (erro) {
      falhou = true;
    }

    exigir(falhou, mensagem);
  }

  try {
    console.log("Iniciando testes das transições de notificação.");

    // 1. Cria o registro no estado SENDING.
    let registro = criarRegistroNotificacao_(dataTeste);

    exigir(
      registro.status === NOTIFICATION_STATUS.SENDING,
      "O estado inicial deveria ser SENDING."
    );

    exigir(
      registro.attempts === 1,
      "A primeira tentativa deveria ser registrada como 1."
    );

    // 2. Simula falha confirmada no envio.
    registro = transicionarNotificacao_(
      dataTeste,
      NOTIFICATION_STATUS.FAILED,
      { error: "Falha simulada pelo teste." }
    );

    exigir(
      registro.status === NOTIFICATION_STATUS.FAILED,
      "A transição para FAILED falhou."
    );

    exigir(
      registro.lastError === "Falha simulada pelo teste.",
      "A descrição da falha não foi armazenada."
    );

    // 3. Confirma que FAILED permite uma nova tentativa.
    registro = transicionarNotificacao_(
      dataTeste,
      NOTIFICATION_STATUS.SENDING
    );

    exigir(
      registro.status === NOTIFICATION_STATUS.SENDING,
      "FAILED deveria permitir uma nova tentativa."
    );

    exigir(
      registro.attempts === 2,
      "A nova tentativa deveria incrementar attempts para 2."
    );

    exigir(
      registro.lastError === null,
      "A nova tentativa deveria limpar o erro anterior."
    );

    // 4. Simula resultado incerto.
    registro = transicionarNotificacao_(
      dataTeste,
      NOTIFICATION_STATUS.UNKNOWN,
      { error: "Resultado incerto simulado pelo teste." }
    );

    exigir(
      registro.status === NOTIFICATION_STATUS.UNKNOWN,
      "A transição para UNKNOWN falhou."
    );

    // 5. UNKNOWN não pode voltar diretamente para SENDING.
    exigirFalha(
      function() {
        transicionarNotificacao_(
          dataTeste,
          NOTIFICATION_STATUS.SENDING
        );
      },
      "UNKNOWN não deveria permitir nova tentativa automática."
    );

    // 6. Simula reconciliação manual confirmando o envio.
    registro = transicionarNotificacao_(
      dataTeste,
      NOTIFICATION_STATUS.SENT
    );

    exigir(
      registro.status === NOTIFICATION_STATUS.SENT,
      "A reconciliação de UNKNOWN para SENT falhou."
    );

    exigir(
      typeof registro.sentAt === "string" && registro.sentAt.length > 0,
      "O horário de envio não foi registrado."
    );

    // 7. SENT é terminal e não pode voltar para SENDING.
    exigirFalha(
      function() {
        transicionarNotificacao_(
          dataTeste,
          NOTIFICATION_STATUS.SENDING
        );
      },
      "SENT não deveria permitir uma nova tentativa."
    );

    // 8. Confirma que o estado final continua salvo.
    const registroFinal = obterRegistroNotificacao_(dataTeste);

    exigir(
      registroFinal !== null &&
      registroFinal.status === NOTIFICATION_STATUS.SENT &&
      registroFinal.attempts === 2,
      "O estado final não foi persistido corretamente."
    );

    console.log(
      "TESTE APROVADO: FAILED, nova tentativa, UNKNOWN, " +
      "bloqueio de reenvio e SENT terminal."
    );

  } finally {
    // Remove somente a chave reservada para este teste.
    propriedades.deleteProperty(chave);
    console.log("Registro temporário de transições removido.");
  }
}


// ============================================================
// 16. TESTE DO LOCKSERVICE
// ============================================================

/*
 * Verifica se o Apps Script consegue adquirir e liberar
 * o bloqueio do projeto.
 *
 * Este teste não executa a conferência, não acessa o Drive,
 * não consulta o Calendar e não envia mensagens ao Telegram.
 *
 * Observação: o teste valida aquisição e liberação do lock.
 * A proteção contra concorrência no fluxo real é aplicada
 * pelos pontos de entrada conferirPontoDiario() e
 * reconciliarNotificacao().
 */

function testarLockExecucao() {
  const lock = LockService.getScriptLock();
  let bloqueioAdquirido = false;

  try {
    console.log("Iniciando teste do LockService.");

    bloqueioAdquirido = lock.tryLock(10000);

    if (!bloqueioAdquirido) {
      throw new Error(
        "Não foi possível adquirir o bloqueio em até 10 segundos."
      );
    }

    if (!lock.hasLock()) {
      throw new Error(
        "O LockService não confirmou a posse do bloqueio."
      );
    }

    console.log(
      "Bloqueio adquirido com sucesso."
    );

  } finally {
    if (bloqueioAdquirido && lock.hasLock()) {
      lock.releaseLock();
    }
  }

  if (lock.hasLock()) {
    throw new Error(
      "O bloqueio permaneceu ativo após a liberação."
    );
  }

  console.log(
    "TESTE APROVADO: aquisição e liberação do LockService."
  );
}
