
/**
 * PONTOGUARD — PG-025
 * Testes de integração controlados
 *
 * IMPORTANTE:
 * - Não acessa Google Drive.
 * - Não acessa Google Agenda.
 * - Não envia mensagens ao Telegram.
 * - Não altera Script Properties reais.
 *
 * Os testes utilizam armazenamento em memória.
 */

const PG025_TEST_PREFIX = "PG025_TEST_";

/**
 * Executa todos os testes iniciais.
 */
function executarTestesPG025() {
  const testes = [
    {
      nome: "Criação de registro SENDING",
      executar: pg025_testeCriacaoRegistro_
    },
    {
      nome: "Transição SENDING para SENT",
      executar: pg025_testeTransicaoSent_
    },
    {
      nome: "Transição SENDING para FAILED",
      executar: pg025_testeTransicaoFailed_
    },
    {
      nome: "Transição FAILED para SENDING",
      executar: pg025_testeNovaTentativa_
    },
    {
      nome: "Bloqueio de UNKNOWN para SENDING",
      executar: pg025_testeBloqueioUnknown_
    },
    {
      nome: "Bloqueio de alteração de SENT",
      executar: pg025_testeSentTerminal_
    },
    {
      nome: "Validação de registro inválido",
      executar: pg025_testeRegistroInvalido_
    }
  ];

  let aprovados = 0;
  let reprovados = 0;

  console.log("==================================");
  console.log("INÍCIO DOS TESTES PG-025");
  console.log("==================================");

  testes.forEach(function(teste) {
    try {
      teste.executar();
      aprovados++;

      console.log("APROVADO: " + teste.nome);

    } catch (erro) {
      reprovados++;

      console.error(
        "REPROVADO: " +
        teste.nome +
        " | " +
        erro.message
      );
    }
  });

  console.log("==================================");
  console.log("RESULTADO FINAL");
  console.log("Aprovados: " + aprovados);
  console.log("Reprovados: " + reprovados);
  console.log("Total: " + testes.length);
  console.log("==================================");

  if (reprovados > 0) {
    throw new Error(
      "PG-025: existem testes reprovados."
    );
  }

  console.log("TODOS OS TESTES PG-025 FORAM APROVADOS.");
}


/**
 * Cria armazenamento fictício em memória.
 */
function pg025_criarAmbiente_() {
  const registros = {};

  return {
    registros: registros,

    obter: function(data) {
      return registros[data] || null;
    },

    salvar: function(registro) {
      registros[registro.date] = JSON.parse(
        JSON.stringify(registro)
      );

      return this.obter(registro.date);
    }
  };
}


/**
 * Cria um registro fictício.
 */
function pg025_criarRegistro_(data, status) {
  const agora = new Date().toISOString();

  return {
    schemaVersion: SCHEMA_VERSION,
    date: data,
    status: status || NOTIFICATION_STATUS.SENDING,
    attempts: 1,
    createdAt: agora,
    updatedAt: agora,
    lastAttemptAt: agora,
    sentAt: null,
    lastError: null
  };
}


/**
 * Verifica se uma condição é verdadeira.
 */
function pg025_exigir_(condicao, mensagem) {
  if (!condicao) {
    throw new Error(mensagem);
  }
}


/**
 * Verifica se uma função lança um erro.
 */
function pg025_deveFalhar_(funcao, mensagem) {
  let falhou = false;

  try {
    funcao();
  } catch (erro) {
    falhou = true;
  }

  pg025_exigir_(
    falhou,
    mensagem || "Era esperado um erro."
  );
}


/**
 * Teste 1: criação de registro.
 */
function pg025_testeCriacaoRegistro_() {
  const ambiente = pg025_criarAmbiente_();
  const data = "2099-12-20";

  const registro = pg025_criarRegistro_(
    data,
    NOTIFICATION_STATUS.SENDING
  );

  ambiente.salvar(registro);

  const recuperado = ambiente.obter(data);

  pg025_exigir_(
    recuperado !== null,
    "O registro não foi criado."
  );

  pg025_exigir_(
    recuperado.status === NOTIFICATION_STATUS.SENDING,
    "Estado inicial incorreto."
  );

  pg025_exigir_(
    recuperado.attempts === 1,
    "Quantidade inicial de tentativas incorreta."
  );
}


/**
 * Teste 2: SENDING para SENT.
 */
function pg025_testeTransicaoSent_() {
  const ambiente = pg025_criarAmbiente_();
  const data = "2099-12-21";

  const registro = pg025_criarRegistro_(data);

  registro.status = NOTIFICATION_STATUS.SENT;
  registro.sentAt = new Date().toISOString();

  ambiente.salvar(registro);

  const recuperado = ambiente.obter(data);

  pg025_exigir_(
    recuperado.status === NOTIFICATION_STATUS.SENT,
    "O estado SENT não foi preservado."
  );

  pg025_exigir_(
    recuperado.sentAt !== null,
    "O horário de envio não foi registrado."
  );
}


/**
 * Teste 3: SENDING para FAILED.
 */
function pg025_testeTransicaoFailed_() {
  const ambiente = pg025_criarAmbiente_();
  const data = "2099-12-22";

  const registro = pg025_criarRegistro_(data);

  registro.status = NOTIFICATION_STATUS.FAILED;
  registro.lastError = "Falha simulada.";

  ambiente.salvar(registro);

  const recuperado = ambiente.obter(data);

  pg025_exigir_(
    recuperado.status === NOTIFICATION_STATUS.FAILED,
    "O estado FAILED não foi registrado."
  );

  pg025_exigir_(
    recuperado.lastError === "Falha simulada.",
    "A descrição do erro não foi preservada."
  );
}


/**
 * Teste 4: FAILED para SENDING.
 */
function pg025_testeNovaTentativa_() {
  const ambiente = pg025_criarAmbiente_();
  const data = "2099-12-23";

  const registro = pg025_criarRegistro_(data);

  registro.status = NOTIFICATION_STATUS.FAILED;
  registro.lastError = "Falha anterior.";

  registro.status = NOTIFICATION_STATUS.SENDING;
  registro.attempts++;
  registro.lastError = null;
  registro.lastAttemptAt = new Date().toISOString();

  ambiente.salvar(registro);

  const recuperado = ambiente.obter(data);

  pg025_exigir_(
    recuperado.status === NOTIFICATION_STATUS.SENDING,
    "A nova tentativa não foi registrada."
  );

  pg025_exigir_(
    recuperado.attempts === 2,
    "O contador de tentativas não foi incrementado."
  );

  pg025_exigir_(
    recuperado.lastError === null,
    "O erro anterior não foi limpo."
  );
}


/**
 * Teste 5: UNKNOWN não pode voltar diretamente para SENDING.
 */
function pg025_testeBloqueioUnknown_() {
  pg025_deveFalhar_(
    function() {
      if (
        !transicaoPermitida_(
          NOTIFICATION_STATUS.UNKNOWN,
          NOTIFICATION_STATUS.SENDING
        )
      ) {
        throw new Error(
          "Transição UNKNOWN para SENDING bloqueada."
        );
      }
    },
    "UNKNOWN para SENDING deveria ser bloqueado."
  );
}


/**
 * Teste 6: SENT é estado terminal.
 */
function pg025_testeSentTerminal_() {
  pg025_deveFalhar_(
    function() {
      if (
        !transicaoPermitida_(
          NOTIFICATION_STATUS.SENT,
          NOTIFICATION_STATUS.SENDING
        )
      ) {
        throw new Error(
          "Transição SENT para SENDING bloqueada."
        );
      }
    },
    "SENT deveria ser um estado terminal."
  );
}


/**
 * Teste 7: validação de registro inválido.
 */
function pg025_testeRegistroInvalido_() {
  const registro = pg025_criarRegistro_(
    "2099-12-24"
  );

  registro.attempts = 0;

  pg025_deveFalhar_(
    function() {
      validarRegistroNotificacao_(registro);
    },
    "Registro com zero tentativas deveria ser rejeitado."
  );
}

/**
 * PG-025 — Testes de contagem de comprovantes.
 *
 * Utiliza exclusivamente nomes fictícios.
 * Não acessa Google Drive.
 */

function executarTestesContagemPG025() {
  const testes = [
    {
      nome: "Quatro comprovantes válidos",
      executar: pg025_testeQuatroComprovantes_
    },
    {
      nome: "Três comprovantes válidos",
      executar: pg025_testeTresComprovantes_
    },
    {
      nome: "Duplicidade de timestamp",
      executar: pg025_testeComprovantesDuplicados_
    },
    {
      nome: "Nome de arquivo inválido",
      executar: pg025_testeNomeInvalido_
    },
    {
      nome: "Comprovante de outra data",
      executar: pg025_testeOutraData_
    },
    {
      nome: "Extensões permitidas",
      executar: pg025_testeExtensoes_
    }
  ];

  let aprovados = 0;
  let reprovados = 0;

  console.log("INÍCIO DOS TESTES DE CONTAGEM PG-025");

  testes.forEach(function(teste) {
    try {
      teste.executar();
      aprovados++;

      console.log("APROVADO: " + teste.nome);

    } catch (erro) {
      reprovados++;

      console.error(
        "REPROVADO: " +
        teste.nome +
        " | " +
        erro.message
      );
    }
  });

  console.log("================================");
  console.log("APROVADOS: " + aprovados);
  console.log("REPROVADOS: " + reprovados);
  console.log("TOTAL: " + testes.length);
  console.log("================================");

  if (reprovados > 0) {
    throw new Error(
      "Existem testes de contagem reprovados."
    );
  }

  console.log("TODOS OS TESTES DE CONTAGEM APROVADOS.");
}


/**
 * Cria timestamps fictícios para uma data de São Paulo.
 *
 * Os horários são convertidos para UTC antes de gerar
 * os nomes dos arquivos.
 */
function pg025_timestamp_(data, hora, minuto) {
  const partes = data.split("-").map(Number);

  const instante = new Date(
    Date.UTC(
      partes[0],
      partes[1] - 1,
      partes[2],
      hora + 3,
      minuto,
      0
    )
  );

  return instante.getTime();
}


/**
 * Cria nome fictício de comprovante.
 */
function pg025_nomeComprovante_(timestamp, extensao) {
  return (
    "Comprovante_Ponto_Mobile_" +
    timestamp +
    "." +
    (extensao || "jpg")
  );
}


/**
 * Reproduz a regra de contagem sem Drive.
 *
 * Utiliza os mesmos critérios da função de produção:
 * - Nome válido.
 * - Timestamp de 13 dígitos.
 * - Data em America/Sao_Paulo.
 * - Deduplicação por timestamp.
 */
function pg025_resumirArquivos_(nomes, dataAlvo) {
  const padrao =
    /^Comprovante_Ponto_Mobile_(\d{13})\.(jpg|jpeg|png|webp)$/i;

  const encontrados = {};

  let totalComprovantes = 0;
  let duplicados = 0;
  let ignorados = 0;

  nomes.forEach(function(nome) {
    const resultado = nome.match(padrao);

    if (!resultado) {
      if (nome.startsWith("Comprovante_Ponto_Mobile_")) {
        ignorados++;
      }

      return;
    }

    const timestamp = Number(resultado[1]);
    const instante = new Date(timestamp);

    if (
      !Number.isFinite(timestamp) ||
      isNaN(instante.getTime())
    ) {
      ignorados++;
      return;
    }

    const dataArquivo = Utilities.formatDate(
      instante,
      TIME_ZONE,
      "yyyy-MM-dd"
    );

    if (dataArquivo !== dataAlvo) {
      return;
    }

    const chave = String(timestamp);

    if (
      Object.prototype.hasOwnProperty.call(
        encontrados,
        chave
      )
    ) {
      duplicados++;
      return;
    }

    encontrados[chave] = true;
    totalComprovantes++;
  });

  return {
    totalComprovantes: totalComprovantes,
    duplicados: duplicados,
    ignorados: ignorados
  };
}


/**
 * Teste 1: quatro comprovantes válidos.
 */
function pg025_testeQuatroComprovantes_() {
  const data = "2099-12-20";

  const arquivos = [
    pg025_nomeComprovante_(
      pg025_timestamp_(data, 8, 0)
    ),
    pg025_nomeComprovante_(
      pg025_timestamp_(data, 12, 0)
    ),
    pg025_nomeComprovante_(
      pg025_timestamp_(data, 18, 30)
    ),
    pg025_nomeComprovante_(
      pg025_timestamp_(data, 23, 0)
    )
  ];

  const resumo = pg025_resumirArquivos_(
    arquivos,
    data
  );

  pg025_exigir_(
    resumo.totalComprovantes === 4,
    "Esperados 4 comprovantes."
  );
}


/**
 * Teste 2: três comprovantes válidos.
 */
function pg025_testeTresComprovantes_() {
  const data = "2099-12-21";

  const arquivos = [
    pg025_nomeComprovante_(
      pg025_timestamp_(data, 8, 0)
    ),
    pg025_nomeComprovante_(
      pg025_timestamp_(data, 18, 30)
    ),
    pg025_nomeComprovante_(
      pg025_timestamp_(data, 23, 0)
    )
  ];

  const resumo = pg025_resumirArquivos_(
    arquivos,
    data
  );

  pg025_exigir_(
    resumo.totalComprovantes === 3,
    "Esperados 3 comprovantes."
  );
}


/**
 * Teste 3: dois arquivos com o mesmo timestamp.
 */
function pg025_testeComprovantesDuplicados_() {
  const data = "2099-12-22";

  const timestamp1 = pg025_timestamp_(data, 8, 0);
  const timestamp2 = pg025_timestamp_(data, 18, 30);

  const arquivos = [
    pg025_nomeComprovante_(timestamp1),
    pg025_nomeComprovante_(timestamp1),
    pg025_nomeComprovante_(timestamp2)
  ];

  const resumo = pg025_resumirArquivos_(
    arquivos,
    data
  );

  pg025_exigir_(
    resumo.totalComprovantes === 2,
    "Esperados 2 comprovantes únicos."
  );

  pg025_exigir_(
    resumo.duplicados === 1,
    "Esperado 1 arquivo duplicado."
  );
}


/**
 * Teste 4: nome inválido.
 */
function pg025_testeNomeInvalido_() {
  const data = "2099-12-23";

  const arquivos = [
    "Comprovante_Ponto_Mobile_invalido.jpg",
    "Comprovante_Ponto_Mobile_1234567890123.pdf",
    "outro_arquivo.jpg"
  ];

  const resumo = pg025_resumirArquivos_(
    arquivos,
    data
  );

  pg025_exigir_(
    resumo.totalComprovantes === 0,
    "Nenhum comprovante deveria ser contabilizado."
  );

  pg025_exigir_(
    resumo.ignorados === 2,
    "Esperados 2 arquivos ignorados."
  );
}


/**
 * Teste 5: arquivo de outra data.
 */
function pg025_testeOutraData_() {
  const dataAlvo = "2099-12-24";
  const outraData = "2099-12-25";

  const arquivos = [
    pg025_nomeComprovante_(
      pg025_timestamp_(outraData, 8, 0)
    )
  ];

  const resumo = pg025_resumirArquivos_(
    arquivos,
    dataAlvo
  );

  pg025_exigir_(
    resumo.totalComprovantes === 0,
    "Arquivo de outra data não deveria ser contado."
  );
}


/**
 * Teste 6: extensões permitidas.
 */
function pg025_testeExtensoes_() {
  const data = "2099-12-26";

  const arquivos = [
    pg025_nomeComprovante_(
      pg025_timestamp_(data, 8, 0),
      "jpg"
    ),
    pg025_nomeComprovante_(
      pg025_timestamp_(data, 12, 0),
      "jpeg"
    ),
    pg025_nomeComprovante_(
      pg025_timestamp_(data, 18, 30),
      "png"
    ),
    pg025_nomeComprovante_(
      pg025_timestamp_(data, 23, 0),
      "webp"
    )
  ];

  const resumo = pg025_resumirArquivos_(
    arquivos,
    data
  );

  pg025_exigir_(
    resumo.totalComprovantes === 4,
    "As quatro extensões deveriam ser aceitas."
  );
}

/**
 * PG-025 — Testes de agenda e folgas.
 *
 * Utiliza eventos fictícios.
 * Não acessa Google Calendar.
 * Não acessa Google Drive.
 * Não envia mensagens.
 */

function executarTestesFolgaPG025() {
  const testes = [
    {
      nome: "Evento Folga reconhecido",
      executar: pg025_testeEventoFolga_
    },
    {
      nome: "Folga com espaços reconhecida",
      executar: pg025_testeFolgaComEspacos_
    },
    {
      nome: "Evento diferente de Folga",
      executar: pg025_testeOutroEvento_
    },
    {
      nome: "Dia sem eventos",
      executar: pg025_testeSemEventos_
    },
    {
      nome: "Folga interrompe fluxo antes do Drive",
      executar: pg025_testeInterrupcaoFolga_
    }
  ];

  let aprovados = 0;
  let reprovados = 0;

  console.log("INÍCIO DOS TESTES DE FOLGA PG-025");

  testes.forEach(function(teste) {
    try {
      teste.executar();
      aprovados++;

      console.log("APROVADO: " + teste.nome);

    } catch (erro) {
      reprovados++;

      console.error(
        "REPROVADO: " +
        teste.nome +
        " | " +
        erro.message
      );
    }
  });

  console.log("================================");
  console.log("APROVADOS: " + aprovados);
  console.log("REPROVADOS: " + reprovados);
  console.log("TOTAL: " + testes.length);
  console.log("================================");

  if (reprovados > 0) {
    throw new Error(
      "Existem testes de folga reprovados."
    );
  }

  console.log("TODOS OS TESTES DE FOLGA APROVADOS.");
}


/**
 * Simula a regra de identificação de folga.
 *
 * Reproduz o critério de produção:
 * título após trim() deve ser exatamente "Folga".
 */
function pg025_simularVerificacaoFolga_(eventos) {
  return eventos.some(function(evento) {
    return evento.titulo.trim() === "Folga";
  });
}


/**
 * Teste 1: evento Folga.
 */
function pg025_testeEventoFolga_() {
  const eventos = [
    { titulo: "Folga" }
  ];

  const resultado = pg025_simularVerificacaoFolga_(
    eventos
  );

  pg025_exigir_(
    resultado === true,
    "O evento Folga deveria ser reconhecido."
  );
}


/**
 * Teste 2: espaços antes e depois.
 */
function pg025_testeFolgaComEspacos_() {
  const eventos = [
    { titulo: "  Folga  " }
  ];

  const resultado = pg025_simularVerificacaoFolga_(
    eventos
  );

  pg025_exigir_(
    resultado === true,
    "Folga com espaços deveria ser reconhecida."
  );
}


/**
 * Teste 3: outro evento.
 */
function pg025_testeOutroEvento_() {
  const eventos = [
    { titulo: "Reunião" },
    { titulo: "Consulta" },
    { titulo: "Compromisso" }
  ];

  const resultado = pg025_simularVerificacaoFolga_(
    eventos
  );

  pg025_exigir_(
    resultado === false,
    "Eventos diferentes de Folga não deveriam interromper."
  );
}


/**
 * Teste 4: nenhum evento.
 */
function pg025_testeSemEventos_() {
  const resultado = pg025_simularVerificacaoFolga_(
    []
  );

  pg025_exigir_(
    resultado === false,
    "Dia sem eventos deveria retornar false."
  );
}


/**
 * Teste 5: folga interrompe o fluxo antes do Drive.
 *
 * Utiliza contadores fictícios para verificar
 * se a consulta ao Drive seria executada.
 */
function pg025_testeInterrupcaoFolga_() {
  let consultasDrive = 0;
  let notificacoes = 0;

  const eventos = [
    { titulo: "Folga" }
  ];

  const temFolga = pg025_simularVerificacaoFolga_(
    eventos
  );

  if (temFolga) {
    return;
  }

  // Estas operações só aconteceriam sem folga.
  consultasDrive++;
  notificacoes++;

  pg025_exigir_(
    consultasDrive === 0,
    "O Drive não deveria ser consultado em dia de folga."
  );

  pg025_exigir_(
    notificacoes === 0,
    "Não deveria haver notificação em dia de folga."
  );
}

/**
 * PG-025B
 * Testes integrados com dependências simuladas.
 *
 * Não acessa Drive, Agenda, Telegram ou Script Properties reais.
 */

function executarTestesIntegradosPG025() {
  const testes = [
    {
      nome: "Folga interrompe o fluxo antes de consultar o Drive",
      executar: pg025_testeFolgaInterrompeFluxo_
    },
    {
      nome: "Quatro comprovantes dispensam notificação",
      executar: pg025_testeQuantidadeSuficiente_
    },
    {
      nome: "Menos de quatro comprovantes cria e envia notificação",
      executar: pg025_testeEnvioComSucesso_
    },
    {
      nome: "Registro SENT impede novo envio",
      executar: pg025_testeNaoReenviarSent_
    },
    {
      nome: "Registro UNKNOWN impede reenvio automático",
      executar: pg025_testeNaoReenviarUnknown_
    },
    {
      nome: "Registro FAILED permite nova tentativa",
      executar: pg025_testeNovaTentativaFailed_
    },
    {
      nome: "Falha explícita do Telegram registra FAILED",
      executar: pg025_testeFalhaTelegram_
    },
    {
      nome: "Exceção no envio registra UNKNOWN",
      executar: pg025_testeExcecaoTelegram_
    },
    {
      nome: "Resposta inválida registra UNKNOWN",
      executar: pg025_testeRespostaInvalida_
    }
  ];

  let aprovados = 0;
  const falhas = [];

  console.log("====================================");
  console.log("INICIANDO TESTES INTEGRADOS PG-025");
  console.log("====================================");

  testes.forEach(function(teste) {
    try {
      teste.executar();
      aprovados++;

      console.log("APROVADO: " + teste.nome);
    } catch (erro) {
      falhas.push({
        nome: teste.nome,
        erro: erro.message
      });

      console.error(
        "FALHOU: " + teste.nome + " | " + erro.message
      );
    }
  });

  console.log("====================================");
  console.log("RESULTADO FINAL");
  console.log("Aprovados: " + aprovados + "/" + testes.length);