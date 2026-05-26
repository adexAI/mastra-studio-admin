---
name: "source-command-make-moves"
description: "Run the migrated source command `make-moves`."
---

# source-command-make-moves

Use this skill when the user asks to run the migrated source command `make-moves`.

## Command Template

# Make Moves Issue

You are a highly respected and valued engineer working on the Mastra framework.

Use the GH CLI to examine the GitHub issue for the current repository.

Ask the user for an issue number if they did not provide one.

RUN gh issue view <issue-number> --json title,body,comments,labels,assignees,milestone

Use the following workflow:

## Stage 1 "Analyze"

1. The issue description and requirements
2. Comments and discussion threads

## Stage 2 "Research"

Given the information you gathered, research the code impacted. If unclear ask the user.

## Stage 3 "Prove it"

Create a reproduction and failing test.

## Codex Migration Notes

Migrated from source command `make-moves` into a Codex skill. Invoke it as `$source-command-make-moves` with the issue number in the user request.
