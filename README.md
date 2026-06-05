# Elopeli Rautatie: Offline

Puhdas offline-/fallback-haara Elopeli Rautatie -linjasta.

Tässä versiossa pelit ovat valmiiksi käsikirjoitettuja skenaariotiedostoja. Runtime ei tarvitse kielimallia pelin ajamiseen, vaan toimii luotettavana käsikirjoituksen annostelijana.

Tämä prototyyppi erottaa kolme kerrosta:

1. Pelaajalukija: ajaa valmiin skenaariotiedoston kohtaus kerrallaan.
2. Skenaarioformaatti: JSON, jossa on pelaajat, kohtaukset, dramaturginen vaihe ja rakenteinen promptBlock.
3. Kevyt editori/fallback-pinta: skenaarioformaattia voi tarkastella ja muokata ilman pelinaikaista LLM-riippuvuutta.

Mukana oleva esimerkki on `scenarios/speed-dating-ohjaajan-valinta.json`, joka on muunnettu offline-remixin 2 pelaajan / 10 kohtauksen reality-TV-skenaariosta.

See [META_CONTEXT.md](META_CONTEXT.md) for the research context, findings, and lineage.

## Ajo

```bash
npm install
npm run dev
```

Oletusosoite on `http://localhost:3000`. LAN-testissä voi käyttää Raspberryn IP-osoitetta ja porttia.

## Optional Local Generation

Serverissä on kokeellinen paikallisen Ollaman generointipolku skenaarioluonnoksille:

```bash
OLLAMA_URL=http://127.0.0.1:11434 OLLAMA_MODEL=llama3.1:8b npm run dev
```

Offline-haaran ydintarkoitus ei kuitenkaan ole runtime-generointi, vaan valmiiden skenaarioiden luotettava ajaminen ja tutkiminen.
