<div align="center">

# Focuss Pomodoro

Timer Pomodoro desktop e web para sessoes de foco, pausas e acompanhamento de
produtividade.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org)
[![Deploy](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white)](https://focuss-pomodoro.onrender.com)

[Acessar aplicacao online](https://focuss-pomodoro.onrender.com) |
[Instalacao](#instalacao) |
[Build desktop](#build-desktop) |
[Ubuntu](#executando-no-ubuntu)

</div>

## Visao geral

Focuss Pomodoro e uma aplicacao de produtividade feita para rodar no navegador
e tambem como app desktop. O projeto usa React + TypeScript no frontend, Vite
para desenvolvimento/build web e Electron para empacotar executaveis para
Windows e Linux.

| Item | Descricao |
| --- | --- |
| Aplicacao online | https://focuss-pomodoro.onrender.com |
| Plataforma web | React + TypeScript + Vite |
| Plataforma desktop | Electron + Electron Builder |
| Pacote Windows | `.exe` portatil |
| Pacote Linux | `.tar.gz` com binario executavel |
| Persistencia | `localStorage` |
| Estado do repositorio | App funcional com build web e desktop |

## Aplicacao online

A versao hospedada esta disponivel em:

```text
https://focuss-pomodoro.onrender.com
```

Tambem e possivel abrir diretamente pelo link:
[focuss-pomodoro.onrender.com](https://focuss-pomodoro.onrender.com).

## Sumario

- [Visao geral](#visao-geral)
- [Aplicacao online](#aplicacao-online)
- [Recursos](#recursos)
- [Tecnologias](#tecnologias)
- [Requisitos](#requisitos)
- [Instalacao](#instalacao)
- [Como executar](#como-executar)
- [Scripts disponiveis](#scripts-disponiveis)
- [Build web](#build-web)
- [Build desktop](#build-desktop)
- [Executando no Ubuntu](#executando-no-ubuntu)
- [Estrutura do repositorio](#estrutura-do-repositorio)
- [Como a aplicacao funciona](#como-a-aplicacao-funciona)
- [Persistencia local](#persistencia-local)
- [Picture-in-Picture](#picture-in-picture)
- [Som de conclusao](#som-de-conclusao)
- [Electron](#electron)
- [Empacotamento Linux](#empacotamento-linux)
- [Qualidade de codigo](#qualidade-de-codigo)
- [Arquivos gerados](#arquivos-gerados)
- [Troubleshooting](#troubleshooting)

## Recursos

- Timer Pomodoro padrao de 25 minutos.
- Pausa curta de 5 minutos.
- Pausa longa de 15 minutos.
- Modos personalizados de foco, com nome, duracao e descricao.
- Inicio, pausa, continuacao e reset do timer.
- Barra de progresso visual da sessao atual.
- Historico local dos focos concluidos.
- Estatisticas de focos do dia, total salvo e minutos focados.
- Som de sino ao finalizar uma sessao.
- Suporte a Picture-in-Picture para acompanhar o timer fora da janela.
- Interface responsiva para desktop e telas menores.
- Build web estatico.
- Build desktop com Electron para Windows e Linux.

## Tecnologias

- React 19
- TypeScript
- Vite
- Electron
- Electron Builder
- CSS Modules
- ESLint
- Node.js

## Requisitos

Use uma versao de Node.js compativel com o Vite usado pelo projeto:

```bash
node >= 20.19.0
```

Tambem e necessario ter `npm` instalado.

Para gerar executaveis desktop, o projeto usa `electron-builder`, instalado como
dependencia de desenvolvimento.

## Instalacao

Clone o repositorio e instale as dependencias:

```bash
git clone <url-do-repositorio>
cd chronos-pomodoro
npm install
```

## Como executar

### Ambiente web de desenvolvimento

```bash
npm run dev
```

O Vite inicia um servidor local e mostra a URL no terminal. Normalmente sera:

```bash
http://localhost:5173
```

### Aplicacao desktop em modo local

```bash
npm run desktop
```

Esse comando primeiro gera o build web em `dist` e depois abre a aplicacao com
Electron.

## Scripts disponiveis

| Script | Descricao |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento do Vite. |
| `npm run build` | Roda TypeScript e gera o build web em `dist`. |
| `npm run desktop` | Gera o build web e abre a aplicacao no Electron. |
| `npm run build:exe` | Gera o executavel portatil para Windows em `release`. |
| `npm run build:linux` | Gera o pacote Linux `.tar.gz` em `release`. |
| `npm run build:release` | Gera os pacotes Windows e Linux. |
| `npm run lint` | Executa o ESLint no repositorio. |
| `npm run preview` | Serve localmente o build web gerado em `dist`. |

## Build web

Para gerar a versao web estatica:

```bash
npm run build
```

Saida esperada:

```text
dist/
```

O Vite esta configurado com `base: './'`, permitindo que o build seja carregado
tambem pelo Electron via arquivo local.

## Build desktop

### Windows

```bash
npm run build:exe
```

Artefato gerado:

```text
release/Focuss Pomodoro 0.0.0.exe
```

O alvo Windows configurado e `portable`, entao o resultado e um `.exe` portatil.

### Linux

```bash
npm run build:linux
```

Artefato gerado:

```text
release/focuss-pomodoro-0.0.0.tar.gz
```

Linux nao executa `.exe` nativamente. Para Linux, use o pacote `.tar.gz` gerado
pelo script `build:linux`.

### Windows + Linux

```bash
npm run build:release
```

Esse comando gera os dois artefatos na pasta `release`.

## Executando no Ubuntu

Copie o arquivo abaixo para o Ubuntu:

```text
release/focuss-pomodoro-0.0.0.tar.gz
```

Extraia e execute:

```bash
tar -xzf focuss-pomodoro-0.0.0.tar.gz
cd focuss-pomodoro-0.0.0
./focuss-pomodoro
```

Se o arquivo tiver perdido permissao de execucao ao ser transferido, corrija com:

```bash
chmod +x focuss-pomodoro chrome_crashpad_handler chrome-sandbox
./focuss-pomodoro
```

## Estrutura do repositorio

```text
chronos-pomodoro/
|-- electron/
|   `-- main.cjs
|-- public/
|   |-- focuss.svg
|   `-- vite.svg
|-- scripts/
|   `-- package-linux-tar.cjs
|-- src/
|   |-- assets/
|   |   `-- react.svg
|   |-- components/
|   |   |-- App.module.css
|   |   |-- App.tsx
|   |   |-- Heading.module.css
|   |   `-- Heading.tsx
|   |-- styles/
|   |   |-- global.css
|   |   `-- theme.css
|   |-- index.css
|   |-- main.tsx
|   `-- vite-env.d.ts
|-- index.html
|-- package.json
|-- package-lock.json
|-- tsconfig.app.json
|-- tsconfig.json
|-- tsconfig.node.json
`-- vite.config.ts
```

## Como a aplicacao funciona

A interface principal fica em:

```text
src/components/App.tsx
```

Esse componente controla:

- modos padrao do timer;
- modos personalizados;
- estado de execucao do timer;
- tempo restante;
- historico de sessoes;
- estatisticas;
- Picture-in-Picture;
- som de conclusao;
- leitura e gravacao no `localStorage`.

Os modos padrao sao:

| Modo | Duracao | Categoria |
| --- | ---: | --- |
| Pomodoro | 25 min | foco |
| Pausa curta | 5 min | pausa |
| Pausa longa | 15 min | pausa |

Quando uma sessao de foco chega a zero, ela e salva no historico local. Sessoes
de pausa nao entram no historico de foco.

## Persistencia local

O projeto usa `localStorage` do navegador/Electron. Nao ha backend nem banco de
dados.

Chaves usadas:

| Chave | Conteudo |
| --- | --- |
| `focuss-pomodoro:custom-modes` | Lista de modos personalizados. |
| `focuss-pomodoro:focus-sessions` | Historico de sessoes de foco concluidas. |

O historico e limitado a 200 sessoes salvas.

## Picture-in-Picture

O timer pode abrir uma janela Picture-in-Picture quando o navegador ou Electron
suportar as APIs:

- `document.pictureInPictureEnabled`
- `HTMLVideoElement.requestPictureInPicture`
- `HTMLCanvasElement.captureStream`

O projeto desenha o tempo atual em um `canvas`, transforma esse `canvas` em
stream de video e abre a stream em Picture-in-Picture.

Ao ocultar a janela enquanto o timer esta rodando, a aplicacao tenta abrir o
Picture-in-Picture automaticamente. Ao voltar para a janela, ela tenta fechar o
Picture-in-Picture.

## Som de conclusao

O som de conclusao e gerado com Web Audio API. Nao existe arquivo de audio no
repositorio.

Ao iniciar ou continuar uma sessao, a aplicacao prepara o `AudioContext`. Quando
o timer chega a zero, ela toca uma combinacao de ondas senoidais simulando um
sino.

## Electron

O processo principal do Electron fica em:

```text
electron/main.cjs
```

Responsabilidades:

- criar a janela principal;
- definir tamanho inicial e tamanho minimo;
- remover o menu padrao da aplicacao;
- carregar `dist/index.html`;
- recriar a janela ao ativar o app no macOS;
- encerrar a aplicacao quando todas as janelas forem fechadas, exceto no macOS;
- aplicar `--no-sandbox` no Linux para reduzir falhas com pacotes extraidos.

Configuracao da janela:

| Opcao | Valor |
| --- | --- |
| Largura inicial | 1120 |
| Altura inicial | 860 |
| Largura minima | 360 |
| Altura minima | 640 |
| Cor de fundo | `#050505` |
| `contextIsolation` | `true` |
| `nodeIntegration` | `false` |

## Empacotamento Linux

O Linux e gerado em duas etapas:

1. `electron-builder --linux dir --x64`
2. `node scripts/package-linux-tar.cjs`

O `electron-builder` cria a pasta:

```text
release/linux-unpacked
```

Depois, `scripts/package-linux-tar.cjs` empacota essa pasta em:

```text
release/focuss-pomodoro-0.0.0.tar.gz
```

Esse script existe porque o `.tar.gz` gerado diretamente no Windows pode perder
permissoes executaveis no Ubuntu. O script detecta arquivos ELF e grava o pacote
com permissoes Linux adequadas:

- diretorios: `755`
- binarios ELF: `755`
- demais arquivos: `644`

## Estilos

Os estilos globais ficam em:

```text
src/styles/global.css
src/styles/theme.css
```

`theme.css` centraliza variaveis de cor, espacamento, raio e sombra.

Os componentes usam CSS Modules:

```text
src/components/App.module.css
src/components/Heading.module.css
```

A interface usa tema escuro, layout responsivo e estados de foco visiveis para
navegacao por teclado.

## Qualidade de codigo

### TypeScript

O projeto usa TypeScript em modo estrito para a aplicacao:

```text
tsconfig.app.json
```

Opcoes importantes:

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `noUncheckedSideEffectImports: true`

### ESLint

Configuracao:

```text
eslint.config.js
```

Inclui:

- regras recomendadas do JavaScript;
- regras recomendadas do TypeScript;
- regras de React Hooks;
- regras de React Refresh para Vite.

Rodar verificacao:

```bash
npm run lint
```

### Prettier

Configuracao:

```text
.prettierrc.json
```

O arquivo define estilo com aspas simples, ponto e virgula, largura de 80
caracteres e indentacao de 2 espacos.

## Arquivos gerados

As pastas abaixo sao geradas durante desenvolvimento ou build e nao devem ser
versionadas:

```text
node_modules/
dist/
release/
dist-ssr/
```

Essas pastas ja estao no `.gitignore`.

## Troubleshooting

### `npm run dev` nao inicia

Verifique a versao do Node:

```bash
node -v
```

Use Node `20.19.0` ou superior compativel com o Vite.

### Ubuntu mostra `Permission denied`

Entre na pasta extraida e aplique permissao:

```bash
chmod +x focuss-pomodoro chrome_crashpad_handler chrome-sandbox
./focuss-pomodoro
```

### Ubuntu mostra erro de sandbox

O app ja adiciona `--no-sandbox` automaticamente no Linux. Se ainda houver erro,
rode manualmente:

```bash
./focuss-pomodoro --no-sandbox
```

### O historico sumiu

O historico fica no `localStorage`. Ele pode ser perdido ao limpar dados do
navegador, limpar dados do Electron ou executar em outro perfil/ambiente.

### Picture-in-Picture nao aparece

O recurso depende do suporte do navegador ou da versao do Electron. Se a API nao
estiver disponivel, o botao fica desabilitado ou a aplicacao mostra uma mensagem
de erro.

## Licenca

Este repositorio ainda nao declara uma licenca. Adicione um arquivo `LICENSE`
antes de distribuir publicamente caso queira definir permissoes de uso,
modificacao e redistribuicao.
