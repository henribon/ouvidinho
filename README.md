# Ouvidinho — Tom & BPM

Extensão para Chrome (e navegadores baseados em Chromium: Edge, Brave, Opera, Vivaldi) que **ouve o áudio da aba** por alguns segundos e **define o tom da música**, no espírito do Auto-Key da Antares: escuta, decide e não fica mudando.

- **Tonalidade**: nome em português (ex.: *Lá menor*), cifra (*Am*), notação **Camelot** (*8A*, para mixagem harmônica) e tonalidade relativa
- **Escala no teclado**: as notas do tom marcadas numa oitava de piano, com a tônica em destaque
- **BPM**: um valor inteiro, que também se firma e fica parado
- **Afinação de referência**, quando a gravação não está em Lá = 440 Hz (ex.: *Lá = 432 Hz*)
- **MIDI da escala** para levar o tom ao FL Studio, Ableton ou outra DAW

O tom definido também aparece no selo do ícone, então dá para ver sem abrir o popup.

## Instalação

1. Baixe o [ouvidinho.zip](https://github.com/henribon/ouvidinho/releases/latest/download/ouvidinho.zip) e extraia. Vai aparecer uma pasta chamada `ouvidinho`. (Ou clone este repositório.)
2. Abra `chrome://extensions` (no Edge: `edge://extensions`).
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e escolha a pasta `ouvidinho`.
5. Fixe o ícone do Ouvidinho na barra (ícone de quebra-cabeça → alfinete).

O mesmo passo a passo, com o botão de download, está em [bonbap.com.br/ouvidinho](https://bonbap.com.br/ouvidinho/).

Requer Chrome 116 ou mais novo.

## Uso

1. Abra uma aba com música (YouTube, SoundCloud, Bandcamp, rádio online…) e dê play.
2. Clique no ícone do Ouvidinho e em **Ouvir esta aba**.
3. O Ouvidinho escuta por 16 a 32 segundos e então **define o tom**. A duração acompanha o andamento: são 8 compassos, para pegar a sequência de acordes inteira (música lenta pede escuta mais longa). O BPM aparece em uns 9 segundos. Dali em diante os dois ficam parados.

Quando o tom muda depois de definido:

- **Ouvir de novo** apaga tudo e recomeça a escuta, para quando você quiser outra leitura.
- **Silêncio de 2 s ou mais** (pausa, ou intervalo entre faixas): o tom continua à mostra, meio apagado, enquanto uma escuta nova confere. Se for a mesma música, nada muda; se for outra, o tom novo entra no lugar.
- **Música nova emendada, sem silêncio**: se o som recente destoar do tom definido por bastante tempo, a escuta é refeita sozinha. Leva em torno de um minuto para trocar; se tiver pressa, use *Ouvir de novo*.

Dicas:

- O som da aba continua tocando normalmente durante a análise.
- Pode fechar o popup: a análise continua e o tom fica no selo do ícone. Passe o mouse sobre o ícone para ver também o BPM.
- O botão **Copiar** copia o resultado (ex.: `Am (8A) · 128 BPM`).
- Afinações fora do padrão (ex.: A = 432 Hz) são corrigidas automaticamente.

## Levar o tom para a DAW

Com o tom definido, **Baixar MIDI** gera um arquivo como `Ouvidinho - Am (8A) - 128 BPM.mid`. Ele tem uma faixa com a escala subindo uma oitava (da tônica à tônica, em semínimas), o andamento detectado e a armadura de clave.

- **FL Studio**: arraste o arquivo para um canal do Channel rack ou para dentro do Piano roll. As notas servem de guia da escala; se quiser, deixe-as como notas-fantasma de outro canal.
- **Ableton Live**: arraste o arquivo para uma faixa MIDI. Com o clipe aberto, o botão **Fold** mostra só as teclas da escala.
- Dá para arrastar direto do aviso de downloads do Chrome para a DAW. Arrastar o próprio botão **Baixar MIDI** para fora do navegador também entrega o arquivo, quando o navegador e a DAW aceitam.

O que não dá para fazer a partir de uma extensão:

- **Copiar o MIDI e colar no piano roll.** O navegador só põe texto, HTML e imagem na área de transferência, e cada DAW usa um formato próprio para colar notas.
- **Mudar o tom do projeto sozinho.** Nem o FL Studio nem o Ableton têm uma entrada para receber o tom de fora; o destaque de escala de cada um é ajustado à mão (o botão **Copiar** dá o nome do tom para isso).

## Acessibilidade

O popup foi feito para funcionar com leitor de tela, só com teclado e com baixa visão:

- **Leitor de tela** (NVDA, JAWS, Narrador, VoiceOver, ChromeVox): o popup avisa sozinho quando algo muda de verdade — "Ouvindo", "Tom definido: Lá menor, 128 BPM", "Conferindo se a música mudou", "Sem som", "Parado" — e fica calado no resto do tempo. Sustenidos e bemóis são lidos por extenso ("Fá sustenido menor"). O desenho do teclado tem a mesma informação em texto: as notas da escala e a tônica.
- **Teclado**: `Alt+Shift+O` abre o popup (dá para trocar em `chrome://extensions/shortcuts`). Tudo é feito com Tab e Enter, o foco fica sempre visível e não se perde quando os botões mudam.
- **Baixa visão**: texto maior, em tamanhos que acompanham a fonte configurada no navegador; contraste de pelo menos 7:1 em todo texto, nos temas claro e escuro; nada depende só de cor. Respeita o alto contraste do Windows e as preferências de mais contraste e de reduzir movimento.
- **Ícone**: ao focar o ícone da extensão, o leitor de tela lê o tom e o BPM, sem precisar abrir o popup.

## Limitações

- Não funciona no Firefox, que não tem a API `tabCapture`.
- Não é possível ouvir páginas internas (`chrome://`, Chrome Web Store).
- Os erros mais comuns de qualquer detector automático:
  - **BPM pela metade ou pelo dobro**, como drum & bass a 174 aparecendo como 87.
  - **Confusão entre tonalidades vizinhas**, principalmente relativa maior/menor (Dó maior × Lá menor) e quinta (Dó × Sol). Por isso a relativa aparece ao lado do tom.
  - **Música menor feita só com os acordes do relativo maior** (ex.: Mi menor com Em–C–G–D, os mesmos acordes de Sol maior): sem um acorde dominante (V ou V7) para denunciar o menor, as notas são idênticas às do tom maior e o resultado tende a sair maior. Quando a música tem o dominante — como o F♯7 de "Hotel California", em Si menor — o menor é reconhecido.
- O tom é definido com o que tocou durante a escuta. Se ela pegar só uma introdução atípica, o resultado pode sair errado e ficar: use *Ouvir de novo* num trecho mais cheio da música.
- Uma modulação no meio da música só é percebida se durar bastante (dezenas de segundos).

## Como funciona

| Arquivo | Papel |
| --- | --- |
| `manifest.json` | Manifest V3; permissões `tabCapture`, `offscreen`, `activeTab`, `storage` |
| `popup.html/css/js` | Interface; pede o *stream ID* da aba ativa com `chrome.tabCapture.getMediaStreamId` |
| `background.js` | Service worker: cria o documento offscreen, guarda o estado e atualiza o selo do ícone |
| `offscreen.html/js` | Abre o stream da aba, devolve o som para os alto-falantes e alimenta o analisador |
| `capture-worklet.js` | AudioWorklet que mistura o áudio em mono e o envia em blocos de 4096 amostras |
| `analyzer.js` | Motor de análise, sem dependências (funciona no navegador e no Node) |
| `midi.js` | Monta o arquivo `.mid` da escala (também sem dependências) |
| `docs/index.html` | Página de download e instalação, publicada em bonbap.com.br/ouvidinho pelo GitHub Pages |

**BPM**: o áudio é filtrado e subamostrado para cerca de 12 kHz. O fluxo espectral em 32 bandas logarítmicas forma uma curva de ataques, e a autocorrelação dessa curva numa janela de 10 s mostra a periodicidade. Um histograma com memória e uma leve preferência por andamentos perto de 120 BPM escolhem a "oitava" do andamento. Um ajuste por mínimos quadrados sobre os picos em T, 2T, 3T e 4T dá a precisão de décimos de BPM.

O BPM mostrado é um inteiro que só troca quando outro andamento se mantém por 8 estimativas seguidas (30, se for a metade ou o dobro).

**Tonalidade**: picos espectrais entre 50 Hz e 2,1 kHz (FFT de 8192 pontos) viram um cromagrama de 12 notas, com estimativa automática da afinação. O cromagrama é correlacionado com os perfis de Krumhansl-Kessler e de Temperley nas 24 tonalidades.

**Definição do tom**: durante a escuta o cromagrama é somado sem esquecimento. A escuta dura 8 compassos, calculados pelo BPM (lido na versão mais lenta quando há dúvida entre um andamento e o dobro), nunca menos de 16 s nem mais de 32 s; sem BPM, 24 s. Ouvir só metade da sequência de acordes é o que mais leva ao tom relativo. Passado esse tempo, o tom é definido assim que o mesmo candidato estiver na frente há 6 s, ou no máximo 12 s depois. Em seguida, um segundo cromagrama, com memória de uns 30 s, vigia o som recente: se outro tom ganhar do definido por boa margem durante 15 s (45 s se for um tom vizinho, que divide quase todas as notas), uma escuta nova é feita, e ela só substitui o tom se o resultado for claramente outro.

**Maior ou relativo menor**: os dois usam as mesmas sete notas, e a correlação sozinha puxa para o maior. O desempate olha a sensível do menor (Lá♯ em Si menor), que vem do acorde dominante e não pertence à escala: se ela aparece acima das outras notas de fora da escala (medidas como "ruído de fundo"), o menor ganha até 0,15 ponto de correlação.

## Testes

```bash
node test/test-analyzer.js
```

O comando gera 10 "músicas" sintéticas (bateria, baixo, acordes e melodia) com tom e BPM conhecidos, incluindo afinação A = 432 Hz e +35 cents, 44,1 kHz e uma sem bateria, e confere que o tom certo é definido depois da escuta e não troca mais. Também testa: música nova depois de um silêncio, pausa e volta na mesma música, música nova emendada sem silêncio, um trecho longo parado num acorde só, um trecho sem bateria, progressões menores e maiores que se confundem com o relativo (entre elas a de "Hotel California", começando a escuta em cada um dos oito acordes), a grafia das notas e o arquivo MIDI.

Para ver o popup e o pipeline de áudio fora da extensão, sirva a pasta por HTTP:

```bash
python -m http.server 8765
```

Depois abra:

- `http://localhost:8765/test/popup-preview.html`: o popup real, com as APIs `chrome.*` simuladas e uma música sintética analisada ao vivo (cenários: padrão, ouvindo outra aba, erro)
- `http://localhost:8765/test/pipeline.html`: AudioWorklet + analisador em tempo real, igual ao documento offscreen
