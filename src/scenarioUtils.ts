import type { PromptBlock, Scenario } from "./types";

export const STORAGE_KEY = "rautatie_scenario_runner_library";

export function normalizeScenario(input: Scenario): Scenario {
  return {
    ...input,
    schemaVersion: input.schemaVersion || "elopeli.scenario.v0",
    runtimeMode: input.runtimeMode || "offline-scripted",
    config: {
      ...input.config,
      totalScenes: input.config.totalScenes || input.scenes.length,
    },
    scenes: input.scenes.map((scene, index) => ({
      ...scene,
      sceneNumber: scene.sceneNumber || index + 1,
      playerTasks: scene.playerTasks.map((task) => ({
        ...task,
        promptBlock: task.promptBlock || parseInstructionPrompt(task.instructionPrompt || ""),
      })),
    })),
  };
}

export function parseInstructionPrompt(text: string): PromptBlock {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLines = lines
    .filter((line) => line.startsWith("-"))
    .map((line) => line.replace(/^-\s*/, "").replace(/^"|"$/g, ""));
  const firstBulletIndex = lines.findIndex((line) => line.startsWith("-"));
  const lastBulletIndex = lines.map((line) => line.startsWith("-")).lastIndexOf(true);

  return {
    prefix: firstBulletIndex > 0 ? lines.slice(0, firstBulletIndex).join(" ") : lines[0] || text,
    lines: bulletLines,
    postfix: lastBulletIndex >= 0 ? lines.slice(lastBulletIndex + 1).join(" ") : "",
  };
}

export function promptBlockToText(block?: PromptBlock, fallback?: string) {
  if (!block) return fallback || "";
  return [
    block.prefix,
    ...(block.lines || []).map((line) => `- ${line}`),
    block.physicalAction ? `Toiminta: ${block.physicalAction}` : "",
    block.emotionalPosture ? `Tila: ${block.emotionalPosture}` : "",
    block.postfix,
  ]
    .filter(Boolean)
    .join("\n");
}

export function loadLibrary(): Scenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw).map(normalizeScenario) : [];
  } catch {
    return [];
  }
}

export function saveLibrary(scenarios: Scenario[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios.map(normalizeScenario), null, 2));
}

export function createDraftScenario(prompt: string, playerNames: string[], totalScenes: number): Scenario {
  const players = playerNames.filter(Boolean).slice(0, 4);
  const safePlayers = players.length ? players : ["Sofia", "Leo"];
  const scenes = Array.from({ length: totalScenes }, (_, index) => {
    const phase = index === 0 ? "Asetelma" : index === totalScenes - 1 ? "Ratkaisu" : index < totalScenes / 2 ? "Paineen kasvu" : "Käänne";
    return {
      sceneNumber: index + 1,
      sceneTitle: `${index + 1}. ${phase}`,
      dramaticArcPhase: phase,
      narrativeIntroduction: `Kohtaus ${index + 1} vie ideaa eteenpäin: ${prompt}`,
      playerTasks: safePlayers.map((name, playerIndex) => ({
        characterName: name,
        socialActionCategory: playerIndex % 2 === 0 ? "Tavoitteleva" : "Kysyvä",
        concreteActionCategory: playerIndex % 2 === 0 ? "Dialogi" : "Fyysinen ele",
        targetCharacter: safePlayers[(playerIndex + 1) % safePlayers.length] || "Kaikki",
        promptBlock: {
          prefix: `Aloita kohtaus ottamalla selkeä suhde tilanteeseen: ${phase.toLowerCase()}.`,
          lines: [`Sano yksi asia, joka paljastaa mitä hahmosi haluaa juuri nyt.`],
          physicalAction: "Tee yksi näkyvä ele, joka pakottaa toisen pelaajan reagoimaan.",
          emotionalPosture: index < totalScenes - 1 ? "Pidätä jotain olennaista." : "Anna ratkaisun näkyä kehossa.",
          postfix: "Lopeta jättämällä toiselle pelaajalle selkeä vastattava hetki.",
        },
        instructionPrompt: `Aloita kohtaus ottamalla selkeä suhde tilanteeseen: ${phase.toLowerCase()}.\n- Sano yksi asia, joka paljastaa mitä hahmosi haluaa juuri nyt.\nTee yksi näkyvä ele, joka pakottaa toisen pelaajan reagoimaan.`,
        gamePurpose: `Antaa ${name}-hahmolle toiminnallinen tehtävä kohtauksen vaiheessa ${phase}.`,
      })),
    };
  });

  return normalizeScenario({
    schemaVersion: "elopeli.scenario.v0",
    id: `draft-${Date.now()}`,
    title: prompt.split(/[.!?]/)[0].slice(0, 56) || "Uusi skenaarioluonnos",
    description: "Natural language -promptista tehty muokattava skenaarioluonnos.",
    runtimeMode: "ai-assisted-draft",
    generatorContext: {
      sourcePrompt: prompt,
      designGoal: "Nopea dramaturginen luonnos, joka pitää korjata ja tarkentaa editorissa.",
      safetyFallback: true,
      notes: ["Tämä fallback-luonnos syntyy ilman kielimallia, jos Ollama/API ei vastaa."],
    },
    config: {
      theme: "Luonnos",
      initialIdea: prompt,
      totalScenes,
      players: safePlayers.map((name, index) => ({
        id: `p${index + 1}`,
        name,
        role: index === 0 ? "Aloitteen tekijä" : "Vastavoima",
        secret: "Täsmennä editorissa.",
      })),
    },
    scenes,
    epilogueText: "Kirjoita lopullinen jälkikuva editorissa.",
  });
}
