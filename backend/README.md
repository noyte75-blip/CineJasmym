# Backend v12

Servidor WebSocket autoritativo do “Encontro de Jasmym e Lívia”. Mantém salas
em memória para no máximo duas pessoas, sincroniza a linha do tempo e retransmite
chat, fotos, GIFs e avatar sem salvar arquivos.

## Executar

```bash
npm install
npm start
```

Variáveis opcionais:

- `PORT`: porta HTTP/WebSocket, padrão `8080`.
- `ROOM_TTL_MS`: tempo para remover salas inativas.
- `MAX_MESSAGE_BYTES`: limite de mensagem, padrão `1500000`.
- `ALLOWED_ORIGINS`: origens permitidas separadas por vírgula.

O endpoint `/health` deve responder com `"protocolVersion":12`.

## Regra principal

O servidor projeta a posição usando `position`, `playing` e `changedAt`.
Heartbeats apenas solicitam estado. `PLAY` e `PAUSE` ignoram qualquer tempo
enviado pelo cliente; somente `SEEK` pode alterar a posição.
