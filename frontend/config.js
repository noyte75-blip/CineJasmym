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
  // Menos de 220 ms é praticamente imperceptível. Diferenças médias são corrigidas pela
  // velocidade; seek fica reservado para desvios reais para não recarregar.
  SYNC_DEAD_BAND: 0.22,
  SYNC_RATE_THRESHOLD: 0.45,
  SYNC_HARD_THRESHOLD: 1.0,
  SYNC_RATE_ADJUSTMENT: 0.03,
  SYNC_CHECK_INTERVAL_MS: 650,
  PAUSED_SYNC_INTERVAL_MS: 2500,
  BACKGROUND_SYNC_INTERVAL_MS: 5000,
  PLAYING_STATE_POLL_INTERVAL_MS: 12000,
  PAUSED_STATE_POLL_INTERVAL_MS: 30000,
  BACKGROUND_STATE_POLL_INTERVAL_MS: 30000,
  TIME_SYNC_INTERVAL_MS: 30000,
};
