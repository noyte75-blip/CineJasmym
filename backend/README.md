# Backend v16.1

Servidor WebSocket autoritativo do “Encontro de Jasmym e Lívia”. Mantém salas
para no máximo duas pessoas, sincroniza a linha do tempo e confirma chat,
fotos, GIFs, respostas e avatar para as duas telas. A V16.1 mantém o histórico
da sala em arquivo e registra quando a outra pessoa viu uma mensagem, sem
alterar a autoridade do relógio do vídeo.

## Executar

```bash
npm install
npm start
```

Variáveis opcionais:

- `PORT`: porta HTTP/WebSocket, padrão `8080`.
- `ROOM_TTL_MS`: tempo para remover salas inativas.
- `MAX_MESSAGE_BYTES`: limite de mensagem, padrão `1500000`.
- `CHAT_HISTORY_LIMIT`: mensagens mantidas por sala, padrão `100`.
- `CHAT_HISTORY_MAX_CHARS`: tamanho aproximado máximo do histórico, padrão
  `6291456`.
- `DATA_DIR`: pasta opcional do arquivo `rooms.json`; o padrão é
  `backend/data`.
- `ALLOWED_ORIGINS`: origens permitidas separadas por vírgula.

O endpoint `/health` deve responder com `"protocolVersion":15`.

## Regra principal

O servidor projeta a posição usando `position`, `playing` e `changedAt`.
Heartbeats apenas solicitam estado. `PLAY` e `PAUSE` ignoram qualquer tempo
enviado pelo cliente; somente `SEEK` pode alterar a posição.

Comandos possuem identificador idempotente, e cada controle gera apenas um ACK
para quem clicou e um snapshot para a outra pessoa. `SEEK` nunca altera o campo
play/pause. Mensagens de chat referenciam o participante em vez de repetir o
avatar em cada envio.

As últimas mensagens válidas da sala são salvas em `data/rooms.json`, usando
troca atômica de arquivo. Ao entrar ou reconectar, o backend envia esse
histórico antes de qualquer nova mensagem. Uma `CHAT_MESSAGE` confirmada chega
para quem enviou e para quem recebeu; `CHAT_READ` atualiza o visto apenas para
quem enviou. “Apagar para todos” remove a mensagem do arquivo; “apagar para
mim” fica somente no navegador.

O arquivo é removido do Git por `data/` no `.gitignore`. Para manter o histórico
quando uma hospedagem troca completamente o disco da aplicação, configure um
disco persistente e a variável `DATA_DIR`.
