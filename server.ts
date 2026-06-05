import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", mode: "scenario-runner", time: new Date().toISOString() });
});

app.get("/api/models", async (_req, res) => {
  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!ollamaResponse.ok) throw new Error(`Ollama HTTP ${ollamaResponse.status}`);
    const data = await ollamaResponse.json();
    const models = Array.isArray(data.models)
      ? data.models.map((model: any) => model.name).filter((name: unknown): name is string => typeof name === "string")
      : [];
    res.json({ models: models.length ? models : [OLLAMA_MODEL], defaultModel: OLLAMA_MODEL });
  } catch (error: any) {
    res.json({ models: [OLLAMA_MODEL], defaultModel: OLLAMA_MODEL, error: error.message || "Mallilistaa ei saatu ladattua" });
  }
});

app.post("/api/generate-scenario", async (req, res) => {
  const { prompt, playerNames, totalScenes, model } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt puuttuu" });
  }
  const selectedModel = typeof model === "string" && model.trim() ? model.trim() : OLLAMA_MODEL;

  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        stream: false,
        format: "json",
        prompt: buildScenarioPrompt(prompt, playerNames, totalScenes),
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama HTTP ${ollamaResponse.status}`);
    }

    const data = await ollamaResponse.json();
    const scenario = JSON.parse(data.response || "{}");
    res.json({ scenario, source: `ollama:${selectedModel}` });
  } catch (error: any) {
    res.status(503).json({
      error: error.message || "Generointi ei onnistunut",
      fallback: true,
    });
  }
});

function buildScenarioPrompt(prompt: string, playerNames?: string[], totalScenes?: number) {
  const players = Array.isArray(playerNames) && playerNames.length ? playerNames : ["Pelaaja 1", "Pelaaja 2"];
  const scenes = Number(totalScenes || 5);
  return `Luo JSON-skenaario esikäsikirjoitettuun, railroadattuun larp-demoalustaan.

Idea: ${prompt}
Pelaajat: ${players.join(", ")}
Kohtauksia: ${scenes}

Palauta vain validi JSON. Ei markdownia. Skeema:
{
  "schemaVersion": "elopeli.scenario.v0",
  "id": "slug",
  "title": "otsikko",
  "description": "yhden virkkeen kuvaus",
  "runtimeMode": "offline-scripted",
  "generatorContext": {
    "sourcePrompt": "alkuperäinen idea",
    "designGoal": "mitä tämä testaa",
    "safetyFallback": true
  },
  "config": {
    "theme": "teema",
    "initialIdea": "alkuasetelma",
    "totalScenes": ${scenes},
    "players": [
      { "id": "p1", "name": "${players[0]}", "role": "rooli", "secret": "sisäinen motiivi" }
    ]
  },
  "scenes": [
    {
      "sceneNumber": 1,
      "sceneTitle": "kohtauksen nimi",
      "dramaticArcPhase": "kaaren vaihe",
      "narrativeIntroduction": "lyhyt tilannekuva",
      "playerTasks": [
        {
          "characterName": "${players[0]}",
          "socialActionCategory": "Tavoitteleva",
          "concreteActionCategory": "Dialogi",
          "targetCharacter": "toinen pelaaja tai Kaikki",
          "promptBlock": {
            "prefix": "miten aloitat toiminnan",
            "lines": ["lyhyt repliikki tai toimintaohje"],
            "physicalAction": "näkyvä teko",
            "emotionalPosture": "tunne/asenne",
            "postfix": "lopettava ele tai rytmi"
          },
          "instructionPrompt": "sama ihmisen luettavana lyhyenä tekstinä",
          "gamePurpose": "miksi tämä tehtävä on kohtauksessa"
        }
      ]
    }
  ],
  "epilogueText": "lyhyt loppukuva"
}`;
}

if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== "true" },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Rautatie scenario runner demo listening on http://0.0.0.0:${PORT}`);
});
