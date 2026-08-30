# Encontro de Jasmym e Lívia — versão 16

Watch Together simples para exatamente duas pessoas, com vídeo sincronizado,
chat, fotos, GIFs e foto de perfil. O tema visual usa jasmim, lírio, tons de
rosa, lilás e verde.

## Novidades da V14

- Chat aprimorado no celular: gaveta maior, segura acima do teclado, contador
  de mensagens não lidas e botões maiores.
- Sininho de notificações por aparelho e botão ✦ para chamar a atenção da outra
  pessoa com aviso visual, som curto e vibração quando o navegador permitir.
- Pesquisa de GIFs da web pelo GIPHY, com classificação `G` e envio como mídia
  externa leve; fotos e GIFs da galeria continuam funcionando como antes.
- Tela cheia para o player e Picture in Picture nativo para fontes MP4/WebM.
- Modo neutro local: altera apenas a aparência daquele aparelho, sem mudar a
  sala da outra pessoa.
- Mensagens podem ser apagadas só para um aparelho ou, quando foram enviadas
  por você, para as duas telas conectadas.
- Modo solo local: a pessoa pode assistir e trocar de vídeo sem mexer no tempo
  oficial; a outra vê apenas o indicador de modo solo.

## Correção da V14.1 — histórico do chat

- Ao sair, atualizar a página ou reconectar na mesma sala, o chat volta com as
  mensagens anteriores automaticamente.
- O backend guarda até as últimas 100 mensagens da sala, com um limite total de
  aproximadamente 6 MB para fotos e GIFs não deixarem o servidor pesado.
- “Apagar para todos” também remove a mensagem do histórico; “apagar para mim”
  continua sendo uma escolha local daquele aparelho.
- As salas e o histórico são gravados em `backend/data/rooms.json` de forma
  segura. Assim, uma reinicialização comum do processo não perde a conversa.

## Novidades da V15

- Respostas diretas no chat, com a mensagem original destacada.
- Configurações com visuais Encontro, Neutro, Escuro e Terror.
- Reconexão automática da última sala por até 7 minutos após sair.
- Botão de comentar o trecho atual: captura um quadro em MP4/WebM ou inclui o
  minuto do vídeo no YouTube.
- Chat compacto no celular para manter o vídeo visível enquanto escreve.

## Correções e novidades da V16

- Reconexão recente continua por até 7 minutos: no celular ela começa sozinha
  com botão de cancelar; no computador a pessoa escolhe se quer voltar.
- O botão **sair** remove o vínculo salvo deste aparelho e avisa a sala, sem
  prender a pessoa em uma reconexão automática.
- O fim de vídeos MP4/WebM e YouTube envia uma pausa oficial para a sala, para
  não ficar tentando repetir os últimos segundos.
- O modo Escuro foi redesenhado em azul-marinho e o Terror em preto/vinho;
  bolhas, menus e campos também ficam escuros, com avisos bobos de fantasma.
- No celular, o layout usa `dvh` como correção moderna de viewport, os
  controles têm 44px e o vídeo usa proporção 16:9 sem ser esticado.
- Em tela cheia, deslizar o vídeo para a esquerda sai da tela cheia e abre o
  chat para continuar a conversa.

## Correção de cache

- Todos os arquivos estáticos receberam URLs `?v=16`. Assim, após o deploy,
  os aparelhos baixam a configuração atual, inclusive a busca de GIFs, sem
  depender de limpar o cache manualmente.
- Esta versão não altera o backend nem o protocolo: ela preserva chat,
  histórico, sincronização e o aviso sonoro já existentes.

## O que mudou na sincronização

- O servidor é o único relógio oficial da sala.
- `PLAY` e `PAUSE` nunca recebem o tempo local do navegador.
- Somente `SEEK` (barra, +10 e −10) pode mudar a posição.
- A consulta periódica apenas lê o estado; nunca sobrescreve o servidor.
- Se o autoplay for bloqueado, “Toque para continuar” retoma somente o player
  local no tempo oficial e não manda o outro vídeo voltar.
- Fechar, suspender ou colocar uma aba em segundo plano não pausa a sala.
- Ao retornar para a página, o frontend pede um snapshot novo e reconecta o
  mesmo perfil automaticamente.
- O navegador mede a latência até o Render e calcula a diferença entre seu
  relógio e o do servidor. Assim, aparelhos com horários diferentes chegam ao
  mesmo segundo do vídeo.
- O `PLAY` começa após uma espera curta de 700 ms, dando tempo para os dois
  navegadores receberem o comando e iniciarem juntos.
- Diferenças pequenas são corrigidas temporariamente pela velocidade. `seek`
  automático fica reservado para desvios maiores, evitando recarregamentos
  sucessivos no YouTube.
- O relógio local agora é monotônico: uma alteração manual no horário do
  aparelho não desloca o vídeo.
- A verificação é adaptativa: mais ativa durante reprodução, bem mais espaçada
  quando pausado ou em segundo plano.
- Depois da calibração inicial, cada cliente cai de cerca de 26 para 7 consultas
  de rede por minuto durante reprodução e para 4 quando pausado.
- Cada comando agora gera duas respostas de rede no total, em vez das quatro
  mensagens duplicadas da versão anterior.
- IDs de comando impedem que uma repetição de rede execute o mesmo controle
  duas vezes. `SEEK` preserva o play/pause oficial.

## Fotos, GIFs e perfil

- Fotos estáticas são reduzidas no próprio navegador antes do envio.
- GIFs mantêm a animação e têm limite de 350 KB no chat e 100 KB no perfil.
- Mensagens de texto não carregam mais uma cópia da foto de perfil; usam o
  participante que já está no estado da sala.
- As mídias passam pelo WebSocket somente para a outra pessoa conectada e, se
  forem parte do histórico, ficam temporariamente no arquivo da sala para
  poderem reaparecer ao voltar.
- O arquivo do histórico não entra no Git (`backend/data/` está ignorado).
- Imagens aceitas: JPG, PNG, WebP e GIF.

### GIFs pesquisáveis

Para habilitar a busca, crie uma chave para o site no GIPHY e preencha
`GIPHY_API_KEY` em `frontend/config.js`. A busca é feita diretamente pelo
navegador, com filtro `G`; sem a chave, somente o seletor de GIFs da web fica
desativado — o restante da V14 funciona normalmente.

## Estrutura

```text
backend/     servidor Node.js + ws para o Render
frontend/    site estático para a Netlify
render.yaml  configuração do backend
netlify.toml configuração do frontend
```

## Atualização da V16

Esta atualização troca frontend e backend: o backend recebeu a saída explícita
da sala, para liberar a vaga e não deixar um perfil preso à reconexão.

1. Substitua as pastas `frontend/` e `backend/` no projeto.
2. Faça o deploy do backend no Render e, depois, o deploy da Netlify.
3. Abra o site normalmente: os scripts agora terminam em `?v=16` e não usam
   a cópia antiga guardada no navegador.
4. Pesquise um GIF para confirmar a atualização.

O backend cria `data/rooms.json` sozinho. Caso o serviço de hospedagem substitua
o disco a cada nova implantação, configure um disco persistente e defina
`DATA_DIR` para esse caminho; sem isso, o histórico continua funcionando durante
a sessão, nas reconexões e em reinicializações que preservem o mesmo disco.

Se estiver usando Netlify Drop, envie **o conteúdo da pasta `frontend/`**. Se
estiver usando GitHub, o `netlify.toml` da raiz já define `publish = "frontend"`.

## Desenvolvimento local

```bash
cd backend
npm install
npm start
```

Em `frontend/config.js`, use `ws://localhost:8080` e sirva a pasta `frontend`
com um servidor estático.

## Limites da fonte de vídeo

O vídeo não passa pelo backend. YouTube usa a IFrame Player API oficial; links
MP4/WebM são abertos diretamente no navegador. Vídeos que proíbem incorporação,
exigem DRM ou bloqueiam acesso externo continuarão indisponíveis.
