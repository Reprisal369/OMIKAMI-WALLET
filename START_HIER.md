# OMIKAMI WALLET — zo test je hem (Windows)

Dit is de **alleen-lezen testversie** op Ethereum Sepolia (testnet). De app kan niets versturen,
niets goedkeuren en niets ondertekenen, en vraagt NOOIT om je seed phrase of private key.

## Stap 1 — Eenmalig: Node.js installeren (als je dat nog niet hebt)

1. Ga naar https://nodejs.org en installeer de LTS-versie (22 of hoger).
2. Open daarna een nieuw PowerShell-venster en controleer: `node --version`

## Stap 2 — Eenmalig: pnpm aanzetten

In PowerShell:

```powershell
corepack enable
```

(Werkt dat niet, gebruik dan: `npm install -g pnpm`)

## Stap 3 — App starten

```powershell
cd $HOME\Downloads\omikami-wallet
pnpm install
pnpm --filter @omikami/web dev
```

Open daarna http://localhost:3000 in je browser.

## Stap 4 — Testen

1. Zorg dat je een browserwallet-extensie hebt (MetaMask, Rabby of Coinbase Wallet).
2. Zet je wallet op het netwerk **Sepolia** (testnetwerk — geen echt geld).
3. Klik in de app op **Connect wallet** en keur de verbinding goed in je wallet.
4. Je ziet: je adres, het netwerk + chain ID, je Sepolia-saldo, de RPC-status en het
   OMIKAMI SHIELD-beveiligingspaneel.
5. Test ook: verbinding weigeren in je wallet (nette foutmelding), verkeerd netwerk
   kiezen (waarschuwing), en **Disconnect wallet**.

## Tip

Verplaats deze map later uit Downloads naar een vaste projectmap (gewoon knippen/plakken —
alles blijft werken, draai daarna wel opnieuw `pnpm install`).

## Belangrijk

- Voer NOOIT ergens je seed phrase in om te "verbinden". Dat is altijd oplichting.
- Dit is een vroege testversie: nog niet extern beoordeeld, alleen voor testnet.
