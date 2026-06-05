import { Download, FileJson, Library, Play, Plus, Save, Sparkles, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import sampleScenarioData from "../scenarios/speed-dating-ohjaajan-valinta.json";
import type { PlayerTask, Scenario } from "./types";
import { createDraftScenario, loadLibrary, normalizeScenario, parseInstructionPrompt, promptBlockToText, saveLibrary } from "./scenarioUtils";

type View = "play" | "library" | "generate";

const sampleScenario = normalizeScenario(sampleScenarioData as Scenario);

export default function App() {
  const [view, setView] = useState<View>("play");
  const [library, setLibrary] = useState<Scenario[]>(() => {
    const saved = loadLibrary();
    return saved.length ? saved : [sampleScenario];
  });
  const [activeId, setActiveId] = useState(sampleScenario.id);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [jsonDraft, setJsonDraft] = useState(() => JSON.stringify(sampleScenario, null, 2));
  const [generatorPrompt, setGeneratorPrompt] = useState("Realitysarjan kuvauksissa ohjaaja joutuu itse osallistujaksi, kun varattu deitti ei saavu.");
  const [generatorPlayers, setGeneratorPlayers] = useState("Sofia, Leo");
  const [generatorScenes, setGeneratorScenes] = useState(10);
  const [generatorModel, setGeneratorModel] = useState("llama3.1:8b");
  const [modelOptions, setModelOptions] = useState<string[]>(["llama3.1:8b"]);
  const [generatorStatus, setGeneratorStatus] = useState("");
  const [editSceneIndex, setEditSceneIndex] = useState(0);

  const activeScenario = useMemo(
    () => normalizeScenario(library.find((scenario) => scenario.id === activeId) || library[0] || sampleScenario),
    [activeId, library],
  );
  const currentScene = activeScenario.scenes[Math.min(sceneIndex, activeScenario.scenes.length - 1)];
  const editableScene = activeScenario.scenes[Math.min(editSceneIndex, activeScenario.scenes.length - 1)];

  useEffect(() => {
    fetch("/api/models")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        const models = Array.isArray(data.models) ? data.models : [];
        if (models.length) {
          setModelOptions(models);
          setGeneratorModel((current) => (models.includes(current) ? current : models[0]));
        }
      })
      .catch(() => {
        setGeneratorStatus((current) => current || "Ollama-mallilistaa ei saatu ladattua; käytössä oletusmalli.");
      });
  }, []);

  useEffect(() => {
    setJsonDraft(JSON.stringify(activeScenario, null, 2));
    setEditSceneIndex(0);
  }, [activeScenario.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (view !== "play") return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        setSceneIndex((current) => Math.min(activeScenario.scenes.length - 1, current + 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSceneIndex((current) => Math.max(0, current - 1));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeScenario.scenes.length, view]);

  function updateLibrary(next: Scenario[]) {
    const normalized = next.map(normalizeScenario);
    setLibrary(normalized);
    saveLibrary(normalized);
  }

  function updateActiveScenario(next: Scenario) {
    const normalized = normalizeScenario(next);
    updateLibrary([...library.filter((scenario) => scenario.id !== normalized.id), normalized]);
    setJsonDraft(JSON.stringify(normalized, null, 2));
  }

  function patchActiveScenario(patch: Partial<Scenario>) {
    updateActiveScenario({ ...activeScenario, ...patch });
  }

  function patchScene(index: number, patch: Partial<Scenario["scenes"][number]>) {
    const scenes = activeScenario.scenes.map((scene, sceneIndex) => (sceneIndex === index ? { ...scene, ...patch } : scene));
    updateActiveScenario({ ...activeScenario, scenes });
  }

  function patchTask(sceneIndex: number, taskIndex: number, patch: Partial<PlayerTask>) {
    const scenes = activeScenario.scenes.map((scene, index) => {
      if (index !== sceneIndex) return scene;
      return {
        ...scene,
        playerTasks: scene.playerTasks.map((task, nextTaskIndex) => (nextTaskIndex === taskIndex ? { ...task, ...patch } : task)),
      };
    });
    updateActiveScenario({ ...activeScenario, scenes });
  }

  function playerDescription(characterName: string) {
    const player = activeScenario.config.players.find(
      (candidate) => candidate.name.toLowerCase() === characterName.toLowerCase() || candidate.role.toLowerCase() === characterName.toLowerCase(),
    );
    if (!player) return "";
    return [player.role, player.secret].filter(Boolean).join(" - ");
  }

  function saveJsonDraft() {
    try {
      const parsed = normalizeScenario(JSON.parse(jsonDraft));
      updateLibrary([...library.filter((scenario) => scenario.id !== parsed.id), parsed]);
      setActiveId(parsed.id);
      setSceneIndex(0);
      setGeneratorStatus("Skenaario tallennettu selaimen kirjastoon.");
    } catch (error: any) {
      setGeneratorStatus(`JSON ei mennyt läpi: ${error.message}`);
    }
  }

  function exportScenario() {
    const blob = new Blob([JSON.stringify(activeScenario, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeScenario.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importScenario(file: File) {
    const text = await file.text();
    const parsed = normalizeScenario(JSON.parse(text));
    updateLibrary([...library.filter((scenario) => scenario.id !== parsed.id), parsed]);
    setActiveId(parsed.id);
    setJsonDraft(JSON.stringify(parsed, null, 2));
    setView("library");
  }

  async function generateScenario() {
    const names = generatorPlayers.split(",").map((name) => name.trim()).filter(Boolean);
    setGeneratorStatus("Kokeilen paikallista generaattoria...");
    try {
      const response = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: generatorPrompt, playerNames: names, totalScenes: generatorScenes, model: generatorModel }),
      });
      if (!response.ok) throw new Error("AI-endpoint ei vastannut käyttökelpoisesti");
      const data = await response.json();
      const generated = normalizeScenario(data.scenario);
      setJsonDraft(JSON.stringify(generated, null, 2));
      updateLibrary([...library.filter((scenario) => scenario.id !== generated.id), generated]);
      setActiveId(generated.id);
      setSceneIndex(0);
      setGeneratorStatus(`Luonnos luotu lähteestä ${data.source || "AI"}. Tarkista editorissa ennen testipeliä.`);
    } catch {
      const fallback = createDraftScenario(generatorPrompt, names, generatorScenes);
      setJsonDraft(JSON.stringify(fallback, null, 2));
      updateLibrary([...library.filter((scenario) => scenario.id !== fallback.id), fallback]);
      setActiveId(fallback.id);
      setSceneIndex(0);
      setGeneratorStatus("AI ei ollut käytössä, joten tein fallback-luonnoksen samalla skeemalla.");
    }
    setView("library");
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Rautatie demo</p>
          <h1>Skenaarioajuri</h1>
        </div>
        <nav>
          <button className={view === "play" ? "active" : ""} onClick={() => setView("play")}><Play size={18} /> Pelaa</button>
          <button className={view === "library" ? "active" : ""} onClick={() => setView("library")}><Library size={18} /> Kirjasto</button>
          <button className={view === "generate" ? "active" : ""} onClick={() => setView("generate")}><Sparkles size={18} /> Generoi</button>
        </nav>
        <label className="selectLabel">
          Skenaario
          <select value={activeScenario.id} onChange={(event) => { setActiveId(event.target.value); setSceneIndex(0); }}>
            {library.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.title}</option>)}
          </select>
        </label>
        <div className="metaStack">
          <span>{activeScenario.config.players.length} pelaajaa</span>
          <span>{activeScenario.scenes.length} kohtausta</span>
          <span>{activeScenario.runtimeMode}</span>
        </div>
      </aside>

      {view === "play" && currentScene && (
        <section className="stage">
          <div className="stageHeader">
            <div>
              <p className="eyebrow">{activeScenario.config.theme}</p>
              <h2>{activeScenario.title}</h2>
              <p>{activeScenario.description}</p>
            </div>
            <div className="sceneCounter">{sceneIndex + 1}/{activeScenario.scenes.length}</div>
          </div>

          <div className="scenePanel">
            <p className="phase">{currentScene.dramaticArcPhase}</p>
            <h3>{currentScene.sceneTitle}</h3>
            <p>{currentScene.narrativeIntroduction}</p>
          </div>

          <div className="taskGrid">
            {currentScene.playerTasks.map((task) => (
              <article className="taskCard" key={`${currentScene.sceneNumber}-${task.characterName}`}>
                <div className="taskTop">
                  <div>
                    <h4>{task.characterName}</h4>
                    {playerDescription(task.characterName) && <p className="playerRole">{playerDescription(task.characterName)}</p>}
                  </div>
                  <span>{task.concreteActionCategory}</span>
                </div>
                <p className="target">Kohde: {task.targetCharacter}</p>
                <pre className="taskPrompt">{promptBlockToText(task.promptBlock, task.instructionPrompt)}</pre>
                <p className="purpose">{task.gamePurpose}</p>
              </article>
            ))}
          </div>

          <div className="controls">
            <button onClick={() => setSceneIndex(Math.max(0, sceneIndex - 1))}>Edellinen</button>
            <button onClick={() => setSceneIndex(0)}>Alkuun</button>
            <button className="primary" onClick={() => setSceneIndex(Math.min(activeScenario.scenes.length - 1, sceneIndex + 1))}>Seuraava</button>
          </div>
        </section>
      )}

      {view === "library" && (
        <section className="workspace">
          <div className="toolbar">
            <button onClick={() => setJsonDraft(JSON.stringify(activeScenario, null, 2))}><FileJson size={18} /> Lataa aktiivinen</button>
            <button onClick={saveJsonDraft}><Save size={18} /> Tallenna JSON</button>
            <button onClick={exportScenario}><Download size={18} /> Vie tiedosto</button>
            <label className="fileButton"><Upload size={18} /> Tuo JSON<input type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && importScenario(event.target.files[0])} /></label>
          </div>
          <div className="editorGrid">
            <section className="formPanel">
              <h2>Muokkaa skenaariota</h2>
              <label>Otsikko<input value={activeScenario.title} onChange={(event) => patchActiveScenario({ title: event.target.value })} /></label>
              <label>Kuvaus<textarea value={activeScenario.description} onChange={(event) => patchActiveScenario({ description: event.target.value })} /></label>
              <label>Teema<input value={activeScenario.config.theme} onChange={(event) => patchActiveScenario({ config: { ...activeScenario.config, theme: event.target.value } })} /></label>
              <label>Alkuidea<textarea value={activeScenario.config.initialIdea} onChange={(event) => patchActiveScenario({ config: { ...activeScenario.config, initialIdea: event.target.value } })} /></label>
              <label>
                Kohtaus
                <select value={editSceneIndex} onChange={(event) => setEditSceneIndex(Number(event.target.value))}>
                  {activeScenario.scenes.map((scene, index) => (
                    <option key={scene.sceneNumber} value={index}>{scene.sceneNumber}. {scene.sceneTitle}</option>
                  ))}
                </select>
              </label>
              {editableScene && (
                <div className="sceneEditor">
                  <label>Kohtauksen nimi<input value={editableScene.sceneTitle} onChange={(event) => patchScene(editSceneIndex, { sceneTitle: event.target.value })} /></label>
                  <label>Dramaturginen vaihe<input value={editableScene.dramaticArcPhase} onChange={(event) => patchScene(editSceneIndex, { dramaticArcPhase: event.target.value })} /></label>
                  <label>Kohtauskuvaus<textarea value={editableScene.narrativeIntroduction} onChange={(event) => patchScene(editSceneIndex, { narrativeIntroduction: event.target.value })} /></label>
                  {editableScene.playerTasks.map((task, taskIndex) => (
                    <section className="taskEditor" key={`${editableScene.sceneNumber}-${task.characterName}-${taskIndex}`}>
                      <div className="taskEditorHeader">
                        <h3>{task.characterName}</h3>
                        <span>{task.concreteActionCategory}</span>
                      </div>
                      <label>Hahmo<input value={task.characterName} onChange={(event) => patchTask(editSceneIndex, taskIndex, { characterName: event.target.value })} /></label>
                      <label>Kohde<input value={task.targetCharacter} onChange={(event) => patchTask(editSceneIndex, taskIndex, { targetCharacter: event.target.value })} /></label>
                      <label>Minipeli / toiminnan laji<input value={task.concreteActionCategory} onChange={(event) => patchTask(editSceneIndex, taskIndex, { concreteActionCategory: event.target.value })} /></label>
                      <label>Pelaajan ohje<textarea value={task.instructionPrompt || promptBlockToText(task.promptBlock)} onChange={(event) => patchTask(editSceneIndex, taskIndex, { instructionPrompt: event.target.value, promptBlock: parseInstructionPrompt(event.target.value) })} /></label>
                      <label>Pelillinen tarkoitus<textarea value={task.gamePurpose} onChange={(event) => patchTask(editSceneIndex, taskIndex, { gamePurpose: event.target.value })} /></label>
                    </section>
                  ))}
                </div>
              )}
            </section>
            <section className="formPanel jsonPanel">
              <h2>JSON-varanäkymä</h2>
              <textarea className="jsonEditor" value={jsonDraft} onChange={(event) => setJsonDraft(event.target.value)} spellCheck={false} />
            </section>
          </div>
          {generatorStatus && <p className="status">{generatorStatus}</p>}
        </section>
      )}

      {view === "generate" && (
        <section className="workspace narrow">
          <h2>Natural language → skenaarioluonnos</h2>
          <p className="muted">Tämä on tarkoituksella riisuttu generaattorialusta: promptista syntyy JSON, jota voi korjata käsin ja ajaa heti pelaajalukijassa.</p>
          <label>Idea<textarea value={generatorPrompt} onChange={(event) => setGeneratorPrompt(event.target.value)} /></label>
          <label>Pelaajat<input value={generatorPlayers} onChange={(event) => setGeneratorPlayers(event.target.value)} /></label>
          <label>Kohtauksia<input type="number" min={1} max={12} value={generatorScenes} onChange={(event) => setGeneratorScenes(Number(event.target.value))} /></label>
          <label>
            Generointimalli
            <select value={generatorModel} onChange={(event) => setGeneratorModel(event.target.value)}>
              {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
          <button className="primary" onClick={generateScenario}><Plus size={18} /> Luo muokattava luonnos</button>
          {generatorStatus && <p className="status">{generatorStatus}</p>}
        </section>
      )}
    </main>
  );
}
