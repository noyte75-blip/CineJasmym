# Backend v13

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

O endpoint `/health` deve responder com `"protocolVersion":13`.

## Regra principal

O servidor projeta a posição usando `position`, `playing` e `changedAt`.
Heartbeats apenas solicitam estado. `PLAY` e `PAUSE` ignoram qualquer tempo
enviado pelo cliente; somente `SEEK` pode alterar a posição.

Comandos possuem identificador idempotente, e cada controle gera apenas um ACK
para quem clicou e um snapshot para a outra pessoa. `SEEK` nunca altera o campo
play/pause. Mensagens de chat referenciam o participante em vez de repetir o
avatar em cada envio.
