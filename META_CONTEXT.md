# Meta Context

This repository preserves the pure offline / fallback branch of the Elopeli Rautatie line.

## Purpose Of This Demo

The offline scenario runner separates Elopeli Rautatie into three layers: a player-facing reader, a JSON scenario format, and a lightweight editor/fallback surface. Instead of relying on live generation during play, it tests whether complete prewritten scenarios can be played scene by scene without direct LLM assistance at runtime.

## What It Proved

- Pregenerated scenario JSON makes the game easier to inspect, edit, and replay.
- Bulk generation can improve coherence because the model sees the whole dramatic arc at once.
- A scenario file can preserve characters, scenes, dramaturgical phase, and structured prompt blocks in a form that is easier to debug than freeform model output.
- Offline or fallback play is valuable because the format itself can be tested even when Ollama, cloud models, network access, or API keys are unavailable.

## Main Limitation

This version does not yet solve private multi-device play. It is still closest to a one-screen or facilitator-driven reader, where the scenario exists before play and the live system mainly advances through it.

## Main Finding

The strongest discovery was that pregeneration is not only a workaround for model latency. It is also a coherence strategy: when all character prompts and scenes are generated together, the model is less likely to invent impossible entities and more likely to keep the scenario metarealistic.

## Place In The Project Lineage

This is the practical fallback branch beside `Elopeli Rautatie` and `Elopeli Rautatie: Local`. The main Rautatie branch explores AI-generated pregenerated scenarios. The offline branch asks what remains playable when the AI is no longer directly involved during runtime.

## Current Status

Source imported into `kala91/Elopeli-rautatie-offline` on 2026-06-05. Worth preserving because it may become the most reliable workshop-friendly playable version: the AI can act as an advance dramaturg, but the actual play session can run from stable scenario files.
