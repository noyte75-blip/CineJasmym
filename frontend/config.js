// Configuração do frontend
//
// Troque WS_URL pelo endereço do seu backend depois de fazer o deploy
// (ex: Render, Fly.io, Railway). Durante testes locais, aponte para
// ws://localhost:8080

const CONFIG = {
  WS_URL: 'wss://encontro-jasmym-e-livia-backend-uq81.onrender.com',
  // Enquanto estiver testando no seu computador, use:
  // WS_URL: 'wss://encontro-jasmym-e-livia-backend-uq81.onrender.com',

  // O servidor é o relógio oficial. O cliente apenas consulta este estado.
  // Menos de 180 ms é imperceptível. Diferenças médias são corrigidas pela
  // velocidade; seek fica reservado para desvios reais para não recarregar.
  SYNC_DEAD_BAND: 0.18,
  SYNC_RATE_THRESHOLD: 0.30,
  SYNC_HARD_THRESHOLD: 0.90,
  SYNC_CHECK_INTERVAL_MS: 500,
  STATE_POLL_INTERVAL_MS: 3000,
  TIME_SYNC_INTERVAL_MS: 10000,
};
