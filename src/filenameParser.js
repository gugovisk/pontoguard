
const TIME_ZONE = "America/Sao_Paulo";

const FILE_PATTERN =
  /^Comprovante_Ponto_Mobile_(\d{13})\.(jpg|jpeg|png|webp)$/i;

  /**
   * Extrai a data e o horário de um comprovante.
    * A fonte de informação é exclusivamente o nome do arquivo.
     *
      * @param {string} filename
       * @returns {{timestamp: number, date: string, time: string} | null}
        */
        export function parseFilename(filename) {
          if (typeof filename !== "string") {
              return null;
                }

                  const match = filename.match(FILE_PATTERN);

                    if (!match) {
                        return null;
                          }

                            const timestamp = Number(match[1]);
                              const date = new Date(timestamp);

                                if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) {
                                    return null;
                                      }

                                        const formatter = new Intl.DateTimeFormat("en-CA", {
                                            timeZone: TIME_ZONE,
                                                year: "numeric",
                                                    month: "2-digit",
                                                        day: "2-digit"
                                                          });

                                                            const timeFormatter = new Intl.DateTimeFormat("en-GB", {
                                                                timeZone: TIME_ZONE,
                                                                    hour: "2-digit",
                                                                        minute: "2-digit",
                                                                            second: "2-digit",
                                                                                hourCycle: "h23"
                                                                                  });

                                                                                    return {
                                                                                        timestamp,
                                                                                            date: formatter.format(date),
                                                                                                time: timeFormatter.format(date)
                                                                                                  };
                                                                                                  }