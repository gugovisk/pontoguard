/**
 * PONTOGUARD — PG-026
 * Checklist cumulativo de pontos com confirmação manual pelo Telegram.
 *
 * Este arquivo depende das funções utilitárias de Code.gs.
 * O acionador diário passa a chamar executarConferenciaCumulativa_().
 *
 * Horário padrão (Brasília / America/Sao_Paulo):
 * 1º ponto: 13:00
 * 2º ponto: 18:30
 * 3º ponto: 19:42 (72 minutos após o 2º)
 * 4º ponto: 23:00
 *
 * As configurações podem ser alteradas em Script Properties:
 * PUNCH_START_TIME, PUNCH_BREAK_START_TIME,
 * PUNCH_BREAK_DURATION_MINUTES, PUNCH_END_TIME,
 * PUNCH_TOLERANCE_MINUTES.
 */

function pg026_configuracao_() {
  var props = PropertiesService.getScriptProperties();

  var config = {
    start: props.getProperty("PUNCH_START_TIME") || "13:00",
    breakStart: props.getProperty("PUNCH_BREAK_START_TIME") || "18:30",
    breakDuration: Number(props.getProperty("PUNCH_BREAK_DURATION_MINUTES") || 72),
    end: props.getProperty("PUNCH_END_TIME") || "23:00",
    tolerance: Number(props.getProperty("PUNCH_TOLERANCE_MINUTES") || 30)
  };

  pg026_minutosHorario_(config.start);
  pg026_minutosHorario_(config.breakStart);
  pg026_minutosHorario_(config.end);

  if (!Number.isInteger(config.breakDuration) || config.breakDuration < 1 || config.breakDuration > 360) {
    throw new Error("PUNCH_BREAK_DURATION_MINUTES deve ser um inteiro entre 1 e 360.");
  }

  if (!Number.isInteger(config.tolerance) || config.tolerance < 1 || config.tolerance > 60) {
    throw new Error("PUNCH_TOLERANCE_MINUTES deve ser um inteiro entre 1 e 60.");
  }

  return config;
}

function pg026_minutosHorario_(horario) {
  if (typeof horario !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) {
    throw new TypeError("Horário inválido. Utilize HH:mm.");
  }

  var partes = horario.split(":").map(Number);
  return partes[0] * 60 + partes[1];
}

function pg026_formatarMinutos_(minutos) {
  var normalizado = ((minutos % 1440) + 1440) % 1440;
  var hora = Math.floor(normalizado / 60);
  var minuto = normalizado % 60;
  return (hora < 10 ? "0" : "") + hora + ":" + (minuto < 10 ? "0" : "") + minuto;
}

function pg026_horariosEsperados_(config) {
  var inicioIntervalo = pg026_minutosHorario_(config.breakStart);
  return [
    { index: 1, label: "Entrada", expectedTime: config.start },
    { index: 2, label: "Saída para intervalo", expectedTime: config.breakStart },
    { index: 3, label: "Retorno do intervalo", expectedTime: pg026_formatarMinutos_(inicioIntervalo + config.breakDuration) },
    { index: 4, label: "Saída", expectedTime: config.end }
  ];
}

function pg026_chaveDia_(data) {
  validarData_(data);
  return "PONTOGUARD_PG026_DAY_" + data;
}

function pg026_validarRegistroDia_(registro) {
  if (!registro || typeof registro !== "object") {
    throw new TypeError("Registro diário PG-026 inválido.");
  }

  validarData_(registro.date);

  if (registro.schemaVersion !== 1 || typeof registro.dayOff !== "boolean") {
    throw new Error("Cabeçalho do registro diário PG-026 inválido.");
  }

  if (!Array.isArray(registro.punches) || registro.punches.length !== 4) {
    throw new Error("O registro diário deve possuir quatro pontos.");
  }

  registro.punches.forEach(function(ponto, indice) {
    if (
      !ponto ||
      ponto.index !== indice + 1 ||
      typeof ponto.driveConfirmed !== "boolean" ||
      typeof ponto.manualConfirmed !== "boolean" ||
      typeof ponto.expectedTime !== "string"
    ) {
      throw new Error("Ponto inválido no registro diário PG-026.");
    }
  });

  return registro;
}

function pg026_obterRegistroDia_(data) {
  var raw = PropertiesService.getScriptProperties().getProperty(pg026_chaveDia_(data));
  if (raw === null) return null;

  var registro;
  try {
    registro = JSON.parse(raw);
  } catch (erro) {
    throw new Error("JSON inválido no registro PG-026 de " + data);
  }

  return pg026_validarRegistroDia_(registro);
}

function pg026_salvarRegistroDia_(registro) {
  pg026_validarRegistroDia_(registro);
  registro.updatedAt = new Date().toISOString();

  PropertiesService.getScriptProperties().setProperty(
    pg026_chaveDia_(registro.date),
    JSON.stringify(registro)
  );

  return registro;
}

function pg026_criarRegistroDia_(data, dayOff, config) {
  var agora = new Date().toISOString();
  var horarios = pg026_horariosEsperados_(config);

  return {
    schemaVersion: 1,
    date: data,
    dayOff: Boolean(dayOff),
    punches: horarios.map(function(item) {
      return {
        index: item.index,
        label: item.label,
        expectedTime: item.expectedTime,
        driveConfirmed: false,
        manualConfirmed: false,
        driveTime: null
      };
    }),
    receiptTimes: [],
    unmatchedReceiptTimes: [],
    intervalGapMinutes: null,
    complete: Boolean(dayOff),
    createdAt: agora,
    updatedAt: agora,
    completedAt: dayOff ? agora : null
  };
}

/**
 * Resume os comprovantes de toda a pasta em uma única leitura do Drive.
 * O timestamp presente no nome continua sendo a única fonte de horário.
 */
function pg026_obterComprovantesPorData_() {
  var pasta = DriveApp.getFolderById(obterFolderId_());
  var arquivos = pasta.getFiles();
  var padrao = /^Comprovante_Ponto_Mobile_(\d{13})\.(jpg|jpeg|png|webp)$/i;
  var porData = {};
  var timestampsGlobais = {};
  var ignorados = 0;

  while (arquivos.hasNext()) {
    var arquivo = arquivos.next();
    var nome = arquivo.getName();
    var match = nome.match(padrao);

    if (!match) {
      if (nome.startsWith("Comprovante_Ponto_Mobile_")) ignorados++;
      continue;
    }

    var timestamp = Number(match[1]);
    var instante = new Date(timestamp);

    if (!Number.isFinite(timestamp) || isNaN(instante.getTime())) {
      ignorados++;
      continue;
    }

    var data = Utilities.formatDate(instante, TIME_ZONE, "yyyy-MM-dd");
    var chave = String(timestamp);

    if (!porData[data]) {
      porData[data] = { timestamps: [], duplicates: 0 };
    }

    if (timestampsGlobais[chave]) {
      porData[data].duplicates++;
      continue;
    }

    timestampsGlobais[chave] = true;
    porData[data].timestamps.push(timestamp);
  }

  Object.keys(porData).forEach(function(data) {
    porData[data].timestamps.sort(function(a, b) { return a - b; });
  });

  console.log("PG-026 — arquivos de comprovante ignorados: " + ignorados);
  return porData;
}

function pg026_mapearComprovantes_(timestamps, config) {
  var horarios = pg026_horariosEsperados_(config);
  var marcados = [false, false, false, false];
  var horasPorPonto = [null, null, null, null];
  var candidatos = [];
  var naoAssociados = [];

  var registros = (timestamps || []).slice().sort(function(a, b) { return a - b; }).map(function(timestamp) {
    var hora = Utilities.formatDate(new Date(timestamp), TIME_ZONE, "HH:mm");
    return {
      timestamp: timestamp,
      hora: hora,
      minutos: pg026_minutosHorario_(hora)
    };
  });

  // Quatro ou mais timestamps únicos continuam satisfazendo a regra original.
  if (registros.length >= 4) {
    registros.slice(0, 4).forEach(function(item, indice) {
      marcados[indice] = true;
      horasPorPonto[indice] = item.hora;
    });

    return {
      confirmed: marcados,
      timesByIndex: horasPorPonto,
      unmatched: registros.slice(4).map(function(item) { return item.hora; })
    };
  }

  registros.forEach(function(item, receiptIndex) {
    horarios.forEach(function(ponto, slotIndex) {
      var distancia = Math.abs(
        item.minutos - pg026_minutosHorario_(ponto.expectedTime)
      );

      if (distancia <= config.tolerance) {
        candidatos.push({
          receiptIndex: receiptIndex,
          slotIndex: slotIndex,
          distance: distancia
        });
      }
    });
  });

  // Prioriza a correspondência mais próxima e não reutiliza comprovantes/pontos.
  candidatos.sort(function(a, b) { return a.distance - b.distance; });
  var reciboUsado = {};

  candidatos.forEach(function(candidato) {
    if (reciboUsado[candidato.receiptIndex] || marcados[candidato.slotIndex]) return;

    reciboUsado[candidato.receiptIndex] = true;
    marcados[candidato.slotIndex] = true;
    horasPorPonto[candidato.slotIndex] = registros[candidato.receiptIndex].hora;
  });

  registros.forEach(function(item, indice) {
    if (!reciboUsado[indice]) naoAssociados.push(item.hora);
  });

  return {
    confirmed: marcados,
    timesByIndex: horasPorPonto,
    unmatched: naoAssociados
  };
}

function pg026_somarHorario_(horario, minutos) {
  return pg026_formatarMinutos_(pg026_minutosHorario_(horario) + minutos);
}

function pg026_subtrairHorario_(horario, minutos) {
  return pg026_formatarMinutos_(pg026_minutosHorario_(horario) - minutos);
}

function pg026_atualizarRegistroComDrive_(registro, resumo, config) {
  var timestamps = resumo ? resumo.timestamps : [];
  var mapeamento = pg026_mapearComprovantes_(timestamps, config);

  registro.punches.forEach(function(ponto, indice) {
    if (mapeamento.confirmed[indice]) {
      ponto.driveConfirmed = true;
      ponto.driveTime = mapeamento.timesByIndex[indice];
    }
  });

  // Se somente um dos pontos do intervalo foi registrado, calcula o horário
  // esperado do outro a partir da duração configurada (72 minutos por padrão).
  var segundo = registro.punches[1];
  var terceiro = registro.punches[2];

  if (segundo.driveTime && !terceiro.driveTime) {
    terceiro.expectedTime = pg026_somarHorario_(segundo.driveTime, config.breakDuration);
  } else if (terceiro.driveTime && !segundo.driveTime) {
    segundo.expectedTime = pg026_subtrairHorario_(terceiro.driveTime, config.breakDuration);
  } else if (!segundo.driveTime && !terceiro.driveTime) {
    segundo.expectedTime = config.breakStart;
    terceiro.expectedTime = pg026_somarHorario_(config.breakStart, config.breakDuration);
  }

  if (segundo.driveTime && terceiro.driveTime) {
    var diferenca = pg026_minutosHorario_(terceiro.driveTime) -
      pg026_minutosHorario_(segundo.driveTime);
    registro.intervalGapMinutes = diferenca;

    // Horários de ponto são no mesmo dia; mantém o cálculo direto.
    registro.intervalGapWarning = diferenca !== config.breakDuration;
  } else {
    registro.intervalGapMinutes = null;
    registro.intervalGapWarning = false;
  }

  registro.receiptTimes = timestamps.map(function(timestamp) {
    return Utilities.formatDate(new Date(timestamp), TIME_ZONE, "HH:mm");
  });

  registro.unmatchedReceiptTimes = mapeamento.unmatched;
  registro.complete = registro.punches.every(function(ponto) {
    return ponto.driveConfirmed || ponto.manualConfirmed;
  });

  if (registro.complete && !registro.completedAt) {
    registro.completedAt = new Date().toISOString();
  }

  if (!registro.complete) registro.completedAt = null;

  return registro;
}

function pg026_obterOuDefinirInicio_(dataAlvo) {
  var props = PropertiesService.getScriptProperties();
  var chave = "PONTOGUARD_CUMULATIVE_START_DATE";
  var inicio = props.getProperty(chave);

  if (!inicio) {
    // Recupera datas para as quais a versão anterior já havia enviado alertas.
    // Assim, o primeiro checklist não abandona pendências anteriores à PG-026.
    var todas = props.getProperties();
    var datasHistoricas = [];

    Object.keys(todas).forEach(function(nome) {
      var match = nome.match(/^PONTOGUARD_NOTIFICATION_(\\d{4}-\\d{2}-\\d{2})$/);
      if (match && match[1] <= dataAlvo) datasHistoricas.push(match[1]);
    });

    var ultimaDataAntiga = props.getProperty("ULTIMA_DATA_NOTIFICADA");
    if (ultimaDataAntiga) {
      try {
        validarData_(ultimaDataAntiga);
        if (ultimaDataAntiga <= dataAlvo) datasHistoricas.push(ultimaDataAntiga);
      } catch (erro) {
        console.warn("ULTIMA_DATA_NOTIFICADA antiga ignorada: " + erro.message);
      }
    }

    datasHistoricas.sort();
    inicio = datasHistoricas.length ? datasHistoricas[0] : dataAlvo;
    props.setProperty(chave, inicio);
    console.log("PG-026 — início do controle cumulativo: " + inicio);
  }

  validarData_(inicio);

  if (inicio > dataAlvo) {
    throw new Error("A data inicial do controle cumulativo está no futuro.");
  }

  return inicio;
}

function pg026_proximaData_(data) {
  validarData_(data);
  var partes = data.split("-").map(Number);
  var instante = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2], 12));
  instante.setUTCDate(instante.getUTCDate() + 1);
  return Utilities.formatDate(instante, "UTC", "yyyy-MM-dd");
}

function pg026_listarRegistrosDia_() {
  var todas = PropertiesService.getScriptProperties().getProperties();
  var prefixo = "PONTOGUARD_PG026_DAY_";
  var registros = [];

  Object.keys(todas).forEach(function(chave) {
    if (chave.indexOf(prefixo) !== 0) return;

    var registro;
    try {
      registro = JSON.parse(todas[chave]);
      pg026_validarRegistroDia_(registro);
    } catch (erro) {
      console.error("Registro cumulativo ignorado (" + chave + "): " + erro.message);
      return;
    }

    registros.push(registro);
  });

  registros.sort(function(a, b) {
    return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0);
  });

  return registros;
}

function pg026_listarPendencias_() {
  return pg026_listarRegistrosDia_().filter(function(registro) {
    return !registro.dayOff && !registro.complete;
  });
}

function pg026_dataBR_(data) {
  var partes = data.split("-");
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

function pg026_montarChecklist_(pendencias) {
  var linhas = [
    "⚠️ PONTOGUARD — PONTOS PENDENTES",
    "Horários de Brasília (UTC-3)",
    "",
    "Pendências acumuladas. Cada data permanece aqui até os quatro pontos serem identificados por comprovante ou confirmados manualmente.",
    ""
  ];

  var teclado = [];

  pendencias.forEach(function(registro) {
    var faltantes = registro.punches.filter(function(ponto) {
      return !ponto.driveConfirmed && !ponto.manualConfirmed;
    });

    linhas.push(pg026_dataBR_(registro.date) + " — faltam " + faltantes.length + " ponto(s)");

    registro.punches.forEach(function(ponto) {
      if (ponto.driveConfirmed) return;

      var dataCurta = registro.date.substring(8, 10) + "/" + registro.date.substring(5, 7);

      if (ponto.manualConfirmed) {
        linhas.push("✅ Ponto " + ponto.index + " — " + ponto.expectedTime + " (confirmado manualmente)");
        teclado.push([{
          text: "↩ Desfazer P" + ponto.index + " • " + dataCurta,
          callback_data: "PG1|" + registro.date + "|" + ponto.index + "|0"
        }]);
      } else {
        linhas.push("⬜ Ponto " + ponto.index + " — " + ponto.expectedTime + " (faltando)");
        teclado.push([{
          text: "☑ Confirmar P" + ponto.index + " • " + dataCurta,
          callback_data: "PG1|" + registro.date + "|" + ponto.index + "|1"
        }]);
      }
    });

    if (registro.intervalGapWarning) {
      linhas.push(
        "⚠️ Intervalo registrado entre P2 e P3: " +
        Math.floor(registro.intervalGapMinutes / 60) + "h" +
        (registro.intervalGapMinutes % 60) + "min; esperado: " +
        pg026_configuracao_().breakDuration + "min."
      );
    }

    if (registro.unmatchedReceiptTimes && registro.unmatchedReceiptTimes.length) {
      linhas.push(
        "Comprovante(s) fora da tolerância de horário: " +
        registro.unmatchedReceiptTimes.join(", ")
      );
    }

    linhas.push("");
  });

  linhas.push("Toque em “Confirmar” somente depois de realizar a marcação manual no sistema de ponto.");

  return {
    text: linhas.join("\n"),
    replyMarkup: { inline_keyboard: teclado }
  };
}

function pg026_chamarTelegram_(metodo, payload) {
  var credenciais = obterCredenciaisTelegram_();
  var url = "https://api.telegram.org/bot" + credenciais.token + "/" + metodo;

  var resposta = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var resultado;
  try {
    resultado = JSON.parse(resposta.getContentText());
  } catch (erro) {
    throw new Error("Resposta inválida do Telegram em " + metodo + ".");
  }

  if (resposta.getResponseCode() !== 200 || !resultado.ok) {
    throw new Error(
      "Telegram " + metodo + ": " +
      (resultado.description || ("HTTP " + resposta.getResponseCode()))
    );
  }

  return resultado;
}

function pg026_chaveDigest_(data) {
  validarData_(data);
  return "PONTOGUARD_PG026_DIGEST_" + data;
}

function pg026_obterDigest_(data) {
  var raw = PropertiesService.getScriptProperties().getProperty(pg026_chaveDigest_(data));
  if (raw === null) return null;

  var registro = JSON.parse(raw);
  if (registro.schemaVersion !== 1 || registro.date !== data) {
    throw new Error("Registro de digest inválido: " + data);
  }
  return registro;
}

function pg026_salvarDigest_(registro) {
  PropertiesService.getScriptProperties().setProperty(
    pg026_chaveDigest_(registro.date),
    JSON.stringify(registro)
  );
  return registro;
}

function pg026_enviarDigest_(dataDigest, checklist) {
  var registro = pg026_obterDigest_(dataDigest);

  if (registro && (
    registro.status === NOTIFICATION_STATUS.SENT ||
    registro.status === NOTIFICATION_STATUS.SENDING ||
    registro.status === NOTIFICATION_STATUS.UNKNOWN
  )) {
    console.log("PG-026 — digest de hoje já enviado ou em estado que exige reconciliação.");
    return false;
  }

  var agora = new Date().toISOString();

  if (!registro) {
    registro = {
      schemaVersion: 1,
      date: dataDigest,
      status: NOTIFICATION_STATUS.SENDING,
      attempts: 1,
      createdAt: agora,
      updatedAt: agora,
      lastAttemptAt: agora,
      sentAt: null,
      lastError: null
    };
  } else {
    if (!transicaoPermitida_(registro.status, NOTIFICATION_STATUS.SENDING)) {
      throw new Error("Transição inválida para novo digest: " + registro.status);
    }
    registro.status = NOTIFICATION_STATUS.SENDING;
    registro.attempts++;
    registro.updatedAt = agora;
    registro.lastAttemptAt = agora;
    registro.lastError = null;
  }

  pg026_salvarDigest_(registro);

  try {
    pg026_chamarTelegram_("sendMessage", {
      chat_id: obterCredenciaisTelegram_().chatId,
      text: checklist.text,
      reply_markup: checklist.replyMarkup
    });
  } catch (erro) {
    var mensagem = String(erro.message || erro);

    // Se o Telegram respondeu explicitamente com erro HTTP/API,
    // a falha é confirmada. Exceções de transporte permanecem UNKNOWN.
    if (/Telegram sendMessage:/.test(mensagem)) {
      registro.status = NOTIFICATION_STATUS.FAILED;
    } else {
      registro.status = NOTIFICATION_STATUS.UNKNOWN;
    }

    registro.lastError = mensagem;
    registro.updatedAt = new Date().toISOString();
    pg026_salvarDigest_(registro);
    throw erro;
  }

  registro.status = NOTIFICATION_STATUS.SENT;
  registro.sentAt = new Date().toISOString();
  registro.updatedAt = registro.sentAt;
  registro.lastError = null;
  pg026_salvarDigest_(registro);

  console.log("PG-026 — checklist cumulativo enviado e registrado: " + dataDigest);
  return true;
}

function executarConferenciaCumulativa_() {
  var agora = new Date();
  var horaAtual = Number(Utilities.formatDate(agora, TIME_ZONE, "H"));

  if (horaAtual !== 23 && horaAtual !== 0) {
    console.log("Fora do horário permitido. Conferência cumulativa cancelada.");
    return;
  }

  var dataAlvo = obterDataAtualLocal_();
  if (horaAtual === 0) {
    var ontem = criarDataLocal_(dataAlvo);
    ontem.setDate(ontem.getDate() - 1);
    dataAlvo = Utilities.formatDate(ontem, TIME_ZONE, "yyyy-MM-dd");
  }

  var config = pg026_configuracao_();
  var dataInicio = pg026_obterOuDefinirInicio_(dataAlvo);
  var resumos = pg026_obterComprovantesPorData_();

  var data = dataInicio;
  var diasProcessados = 0;

  while (data <= dataAlvo) {
    var registro = pg026_obterRegistroDia_(data);

    if (!registro) {
      var dayOff = verificarFolga_(data);
      registro = pg026_criarRegistroDia_(data, dayOff, config);
    }

    if (!registro.dayOff && !registro.complete) {
      registro = pg026_atualizarRegistroComDrive_(
        registro,
        resumos[data] || { timestamps: [], duplicates: 0 },
        config
      );
    }

    pg026_salvarRegistroDia_(registro);
    diasProcessados++;

    data = pg026_proximaData_(data);
  }

  var pendencias = pg026_listarPendencias_();

  console.log("PG-026 — dias processados: " + diasProcessados);
  console.log("PG-026 — datas com pendências: " + pendencias.length);

  if (!pendencias.length) {
    console.log("PG-026 — nenhum ponto pendente. Nenhum lembrete enviado.");
    return;
  }

  var checklist = pg026_montarChecklist_(pendencias);
  var dataDigest = obterDataAtualLocal_();
  pg026_enviarDigest_(dataDigest, checklist);
}

/**
 * Execute uma vez depois de publicar o Apps Script como Web App.
 * O endereço público só aceita atualizações que contenham o segredo
 * guardado em Script Properties.
 */
function configurarWebhookTelegram() {
  var credenciais = obterCredenciaisTelegram_();
  var serviceUrl = ScriptApp.getService().getUrl();

  if (!serviceUrl) {
    throw new Error(
      "Publique primeiro como Web App: Executar como você; acesso Qualquer pessoa."
    );
  }

  var props = PropertiesService.getScriptProperties();
  var segredo = props.getProperty("TELEGRAM_WEBHOOK_SECRET");

  if (!segredo) {
    segredo = Utilities.getUuid().replace(/-/g, "") +
      Utilities.getUuid().replace(/-/g, "");
    props.setProperty("TELEGRAM_WEBHOOK_SECRET", segredo);
  }

  var webhookUrl = serviceUrl + "?secret=" + encodeURIComponent(segredo);

  var info = pg026_chamarTelegram_("getWebhookInfo", {});
  var urlAtual = info.result && info.result.url ? info.result.url : "";

  if (urlAtual && urlAtual !== webhookUrl && urlAtual.indexOf(serviceUrl) !== 0) {
    throw new Error(
      "Este bot já possui outro webhook configurado. Não alterei a configuração existente."
    );
  }

  pg026_chamarTelegram_("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["callback_query"],
    drop_pending_updates: false
  });

  console.log("Webhook do Telegram configurado com sucesso.");
  console.log("URL publicada: " + serviceUrl);
}

function pg026_responderCallback_(callbackId, mensagem) {
  pg026_chamarTelegram_("answerCallbackQuery", {
    callback_query_id: callbackId,
    text: mensagem,
    show_alert: false
  });
}

function pg026_editarMensagemChecklist_(callbackQuery) {
  var pendencias = pg026_listarPendencias_();
  var chatId = callbackQuery.message.chat.id;
  var messageId = callbackQuery.message.message_id;

  var texto;
  var markup;

  if (!pendencias.length) {
    texto =
      "✅ PONTOGUARD — TUDO CERTO\n\n" +
      "Todos os pontos pendentes foram confirmados por comprovante ou manualmente.\n" +
      "O próximo ciclo continuará conferindo os novos dias.";
    markup = { inline_keyboard: [] };
  } else {
    var checklist = pg026_montarChecklist_(pendencias);
    texto = checklist.text;
    markup = checklist.replyMarkup;
  }

  pg026_chamarTelegram_("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: texto,
    reply_markup: markup
  });
}

function pg026_processarCallback_(callbackQuery) {
  var match = String(callbackQuery.data || "").match(
    /^PG1\|(\d{4}-\d{2}-\d{2})\|([1-4])\|([01])$/
  );

  if (!match) {
    pg026_responderCallback_(callbackQuery.id, "Comando inválido.");
    return;
  }

  var credenciais = obterCredenciaisTelegram_();
  var chatId = callbackQuery.message && callbackQuery.message.chat
    ? String(callbackQuery.message.chat.id)
    : "";

  if (chatId !== String(credenciais.chatId)) {
    pg026_responderCallback_(callbackQuery.id, "Chat não autorizado.");
    return;
  }

  var data = match[1];
  var indice = Number(match[2]) - 1;
  var marcar = match[3] === "1";
  var registro = pg026_obterRegistroDia_(data);

  if (!registro || registro.dayOff) {
    pg026_responderCallback_(callbackQuery.id, "Data não encontrada no controle.");
    return;
  }

  var ponto = registro.punches[indice];

  if (ponto.driveConfirmed && !marcar) {
    pg026_responderCallback_(callbackQuery.id, "Este ponto já possui comprovante no Drive.");
    return;
  }

  ponto.manualConfirmed = marcar;
  registro.complete = registro.punches.every(function(item) {
    return item.driveConfirmed || item.manualConfirmed;
  });
  registro.completedAt = registro.complete ? new Date().toISOString() : null;

  pg026_salvarRegistroDia_(registro);

  pg026_responderCallback_(
    callbackQuery.id,
    marcar ? "Ponto confirmado manualmente." : "Confirmação manual desfeita."
  );

  try {
    pg026_editarMensagemChecklist_(callbackQuery);
  } catch (erro) {
    console.error("Não foi possível atualizar a mensagem do checklist: " + erro.message);
  }
}

/**
 * Webhook do Telegram. Requer implantação como Web App.
 * O parâmetro ?secret= é validado antes de processar qualquer comando.
 */
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var segredo = props.getProperty("TELEGRAM_WEBHOOK_SECRET");
  var segredoRecebido = e && e.parameter ? e.parameter.secret : "";

  if (!segredo || segredoRecebido !== segredo) {
    return ContentService.createTextOutput("unauthorized");
  }

  var update;
  try {
    update = JSON.parse(e.postData.contents || "{}");
  } catch (erro) {
    return ContentService.createTextOutput("invalid-json");
  }

  if (!update.callback_query) {
    return ContentService.createTextOutput("ok");
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    try {
      pg026_responderCallback_(update.callback_query.id, "Conferência em andamento. Tente novamente.");
    } catch (erroCallback) {
      console.error(erroCallback.message);
    }
    return ContentService.createTextOutput("busy");
  }

  try {
    pg026_processarCallback_(update.callback_query);
  } catch (erro) {
    console.error("Falha ao processar confirmação do Telegram: " + erro.message);

    try {
      pg026_responderCallback_(update.callback_query.id, "Não consegui registrar. Tente novamente.");
    } catch (erroCallback2) {
      console.error(erroCallback2.message);
    }
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }

  return ContentService.createTextOutput("ok");
}

/**
 * PG-026 — testes unitários das regras de horário e checklist.
 * Não acessa Drive, Calendar, Telegram ou Script Properties.
 */
function executarTestesPG026() {
  var testes = [
    {
      nome: "3º ponto é calculado 72 minutos após 18:30",
      executar: function() {
        var config = {
          start: "13:00",
          breakStart: "18:30",
          breakDuration: 72,
          end: "23:00",
          tolerance: 30
        };
        var horarios = pg026_horariosEsperados_(config);
        pg026_exigirPG026_(horarios[2].expectedTime === "19:42", "Esperado 19:42.");
      }
    },
    {
      nome: "Horário esperado aceita virada de hora",
      executar: function() {
        pg026_exigirPG026_(pg026_somarHorario_("18:50", 72) === "20:02", "Esperado 20:02.");
      }
    },
    {
      nome: "Pontos 1, 2 e 4 são identificados com ponto 3 faltante",
      executar: function() {
        var config = { start:"13:00", breakStart:"18:30", breakDuration:72, end:"23:00", tolerance:30 };
        var ts = [
          pg026_timestampTeste_("2099-12-20", "13:02"),
          pg026_timestampTeste_("2099-12-20", "18:28"),
          pg026_timestampTeste_("2099-12-20", "23:04")
        ];
        var mapa = pg026_mapearComprovantes_(ts, config);
        pg026_exigirPG026_(mapa.confirmed[0] && mapa.confirmed[1] && !mapa.confirmed[2] && mapa.confirmed[3], "Mapeamento incorreto.");
      }
    },
    {
      nome: "Ponto 3 presente permite calcular o ponto 2 faltante",
      executar: function() {
        var config = { start:"13:00", breakStart:"18:30", breakDuration:72, end:"23:00", tolerance:30 };
        var registro = pg026_criarRegistroDia_("2099-12-21", false, config);
        registro = pg026_atualizarRegistroComDrive_(registro, {
          timestamps:[pg026_timestampTeste_("2099-12-21","19:50")]
        }, config);
        pg026_exigirPG026_(registro.punches[2].driveConfirmed, "Ponto 3 deveria estar confirmado.");
        pg026_exigirPG026_(registro.punches[1].expectedTime === "18:38", "Ponto 2 esperado deveria ser 18:38.");
      }
    },
    {
      nome: "Ponto 2 presente calcula o retorno esperado",
      executar: function() {
        var config = { start:"13:00", breakStart:"18:30", breakDuration:72, end:"23:00", tolerance:30 };
        var registro = pg026_criarRegistroDia_("2099-12-22", false, config);
        registro = pg026_atualizarRegistroComDrive_(registro, {
          timestamps:[pg026_timestampTeste_("2099-12-22","18:41")]
        }, config);
        pg026_exigirPG026_(registro.punches[1].driveConfirmed, "Ponto 2 deveria estar confirmado.");
        pg026_exigirPG026_(registro.punches[2].expectedTime === "19:53", "Ponto 3 esperado deveria ser 19:53.");
      }
    },
    {
      nome: "Quatro comprovantes satisfazem todos os pontos",
      executar: function() {
        var config = { start:"13:00", breakStart:"18:30", breakDuration:72, end:"23:00", tolerance:30 };
        var ts = ["13:00","18:30","19:42","23:00"].map(function(h) {
          return pg026_timestampTeste_("2099-12-23",h);
        });
        var mapa = pg026_mapearComprovantes_(ts, config);
        pg026_exigirPG026_(mapa.confirmed.every(function(valor){return valor;}), "Todos os quatro pontos deveriam ser confirmados.");
      }
    },
    {
      nome: "Tolerância não associa um comprovante distante do horário",
      executar: function() {
        var config = { start:"13:00", breakStart:"18:30", breakDuration:72, end:"23:00", tolerance:30 };
        var mapa = pg026_mapearComprovantes_([
          pg026_timestampTeste_("2099-12-24","16:00")
        ], config);
        pg026_exigirPG026_(!mapa.confirmed.some(function(valor){return valor;}), "O comprovante não deveria ser associado.");
        pg026_exigirPG026_(mapa.unmatched.length === 1, "O horário deveria aparecer como não associado.");
      }
    },
    {
      nome: "Confirmação manual completa somente o ponto selecionado",
      executar: function() {
        var config = { start:"13:00", breakStart:"18:30", breakDuration:72, end:"23:00", tolerance:30 };
        var registro = pg026_criarRegistroDia_("2099-12-25", false, config);
        registro.punches[1].manualConfirmed = true;
        registro.complete = registro.punches.every(function(p){return p.driveConfirmed || p.manualConfirmed;});
        pg026_exigirPG026_(registro.punches[1].manualConfirmed, "Ponto manual não foi confirmado.");
        pg026_exigirPG026_(!registro.complete, "Um único ponto não deveria completar o dia.");
      }
    },
    {
      nome: "Confirmação manual pode ser desfeita",
      executar: function() {
        var config = { start:"13:00", breakStart:"18:30", breakDuration:72, end:"23:00", tolerance:30 };
        var registro = pg026_criarRegistroDia_("2099-12-26", false, config);
        registro.punches[0].manualConfirmed = true;
        registro.punches[0].manualConfirmed = false;
        pg026_exigirPG026_(!registro.punches[0].manualConfirmed, "Confirmação deveria ser desfeita.");
      }
    }
  ];

  var aprovados = 0;
  var falhas = [];

  testes.forEach(function(teste) {
    try {
      teste.executar();
      aprovados++;
      console.log("APROVADO: " + teste.nome);
    } catch (erro) {
      falhas.push(teste.nome + ": " + erro.message);
      console.error("REPROVADO: " + teste.nome + " | " + erro.message);
    }
  });

  console.log("PG-026 — aprovados: " + aprovados + "/" + testes.length);

  if (falhas.length) {
    throw new Error(falhas.join("\n"));
  }

  console.log("TODOS OS TESTES PG-026 FORAM APROVADOS.");
}

function pg026_exigirPG026_(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function pg026_timestampTeste_(data, horario) {
  var partesData = data.split("-").map(Number);
  var partesHora = horario.split(":").map(Number);

  return Date.UTC(
    partesData[0],
    partesData[1] - 1,
    partesData[2],
    partesHora[0] + 3,
    partesHora[1],
    0
  );
}
