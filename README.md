# Focuss Pomodoro

Timer Pomodoro desktop e web.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Executaveis desktop

Windows e Linux usam executaveis diferentes:

- Windows: gera `release/Focuss Pomodoro 0.0.0.exe`.
- Linux: gera `release/focuss-pomodoro-0.0.0.tar.gz`.

No Linux, extraia o `.tar.gz` e execute o arquivo `focuss-pomodoro` que vem dentro dele. O Linux nao roda `.exe` nativamente.

```bash
npm run build:exe
npm run build:linux
```

Para gerar os dois pacotes de uma vez:

```bash
npm run build:release
```

Os arquivos finais ficam na pasta `release`.
