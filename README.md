# Encontro de Jasmym e Lívia — versão 13

Watch Together simples para exatamente duas pessoas, com vídeo sincronizado,
chat, fotos, GIFs e foto de perfil. O tema visual usa jasmim, lírio, tons de
rosa, lilás e verde.

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
- As mídias passam pelo WebSocket somente para a outra pessoa conectada.
- O servidor não cria arquivos e não mantém histórico de chat.
- Imagens aceitas: JPG, PNG, WebP e GIF.

## Estrutura

```text
backend/     servidor Node.js + ws para o Render
frontend/    site estático para a Netlify
render.yaml  configuração do backend
netlify.toml configuração do frontend
```

## Atualização obrigatória — não misture versões

Para a versão 13 funcionar, substitua as duas pastas completas, nesta ordem:

1. Substitua a pasta `backend/` no repositório usado pelo Render.
2. Espere o deploy terminar.
   - No painel do Render, confira a variável `MAX_MESSAGE_BYTES`. Se ela existir
     com o valor antigo `16384`, troque por `1500000` (ou apague para usar o
     novo padrão). Sem isso, fotos e GIFs serão recusados pelo backend.
3. Abra `https://SEU-BACKEND.onrender.com/health` e confirme:

   ```json
   { "protocolVersion": 13 }
   ```

4. Só depois substitua a pasta `frontend/` inteira no projeto da Netlify.
5. Abra o código-fonte do site e confirme que os scripts terminam em `?v=13`.
6. Crie uma sala nova. O reinício do Render limpa as salas em memória.

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
