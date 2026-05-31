# Task Working Sources

Last reviewed: 2026-05-26

Use this file as the first reference check before changing Context Canvas behavior, AI prompts, change tracking, audit history, or requirements workflows. Prefer official product documentation, standards bodies, or primary methodology sources. Do not add influencer threads, social posts, or unsourced prompt templates unless they point to a better primary source.

## Source Rules

- Check this file before starting product, AI, prompt, or requirements tasks.
- Add a source only when it materially improves implementation or review quality.
- Prefer stable official docs over blog summaries.
- Record why the source matters so future work can decide quickly whether to read it.
- If a source becomes stale, replace it with a current official page instead of leaving both.

## AI And Prompting

- OpenAI prompt engineering best practices: https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-openai-api
  - Use for clear instructions, explicit output formats, examples, and factual low-temperature extraction guidance.
- OpenAI agents best practices: https://platform.openai.com/docs/guides/agents/best-practices
  - Use for agent workflow design, tool/context boundaries, guardrails, memory, and observability decisions.
- OpenAI Agents SDK: https://platform.openai.com/docs/guides/agents-sdk/
  - Use when implementation needs tool orchestration, handoffs, streaming, or traceable agent behavior.
- OpenAI prompt-injection guidance: https://openai.com/index/designing-agents-to-resist-prompt-injection/
  - Use when adding source ingestion, external content analysis, or agent actions based on untrusted text.
  - Use for success criteria, empirical evaluation, clear/direct prompting, examples, role prompting, and long-context structure.
- Google Cloud prompt engineering best practices: https://cloud.google.com/blog/products/application-development/five-best-practices-for-prompt-engineering
  - Use for model limitation awareness, specificity, context, examples, and prompt iteration practices.
- Google Gemini prompt design strategies: https://ai.google.dev/gemini-api/docs/models/generative-models
  - Use for Gemini-style prompt design, examples, constraints, and output formatting when Google models are in scope.
- GitHub Copilot prompt engineering: https://docs.github.com/en/copilot/concepts/prompt-engineering
  - Use for coding-agent task decomposition, relevant context selection, ambiguity reduction, and iteration habits.
- GitHub Copilot custom instructions: https://docs.github.com/en/copilot/concepts/prompting/response-customization
  - Use for repository instruction files, path-specific instructions, agent instructions, and precedence rules.

## Agile, Requirements, And Change Control

- Agile Manifesto principles: https://agilealliance.org/agile101/12-principles-behind-the-agile-manifesto/
  - Use for accepting changing requirements, frequent feedback, working software, and emergent requirements/design.
- Scrum Guide: https://scrumguides.org/scrum-guide.html
  - Use for product backlog, inspection/adaptation, transparency, and product goal alignment.
- Atlassian agile guide: https://www.atlassian.com/agile
  - Use for pragmatic agile framing, tight feedback cycles, continuous improvement, and team-specific process choices.
- Atlassian DevOps change management: https://www.atlassian.com/blog/how-we-build/best-practices-for-change-management-in-the-age-of-devops
  - Use for traceability, transparency, risk management, and modern change governance.

## Context Canvas Application Standards

- Requirement and contract changes must preserve full semantic history: who changed it, when it changed, what fields changed, and a short changelog summary.
- Layout-only changes should not create requirement versions.
- AI may flag impact, conflict, staleness, and follow-up review needs, but it must not rewrite requirement content without explicit user action.
- Affected-node analysis should prioritize graph-connected nodes and contract-to-requirement relationships first.
- Visible UI flags should be clear without hiding the original user-authored content.
- Version history should read like concise commits: specific, auditable, and grounded in saved canvas evidence.
