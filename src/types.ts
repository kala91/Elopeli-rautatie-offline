export interface Player {
  id: string;
  name: string;
  role: string;
  secret?: string;
}

export interface PromptBlock {
  prefix?: string;
  lines?: string[];
  physicalAction?: string;
  emotionalPosture?: string;
  postfix?: string;
}

export interface PlayerTask {
  characterName: string;
  socialActionCategory: string;
  concreteActionCategory: string;
  targetCharacter: string;
  instructionPrompt?: string;
  promptBlock?: PromptBlock;
  gamePurpose: string;
}

export interface Scene {
  sceneNumber: number;
  sceneTitle: string;
  narrativeIntroduction: string;
  dramaticArcPhase: string;
  playerTasks: PlayerTask[];
  humanGmNotesFeedback?: string;
}

export interface Scenario {
  schemaVersion?: string;
  id: string;
  title: string;
  description: string;
  runtimeMode?: "offline-scripted" | "ai-assisted-draft";
  generatorContext?: {
    sourcePrompt?: string;
    designGoal?: string;
    safetyFallback?: boolean;
    notes?: string[];
  };
  config: {
    theme: string;
    initialIdea: string;
    totalScenes: number;
    players: Player[];
  };
  scenes: Scene[];
  epilogueText?: string;
  judgmentText?: string;
}
