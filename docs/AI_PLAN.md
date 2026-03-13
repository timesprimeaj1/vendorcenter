# AI_PLAN

## Objective
Introduce vector search and AI-assisted discovery without impacting current production behavior.

## Phase 1: Event Collection and Index Preparation
- Capture structured search and browse events
- Normalize vendor/service metadata for embeddings
- Add async pipeline for embedding generation

## Phase 2: Vector Database Integration
- Add vector index for vendors/services content
- Store embeddings for:
  - vendor profile text
  - service titles/descriptions
  - category + zone metadata
- Keep lexical search as fallback

## Phase 3: Hybrid Search
- Combine keyword relevance + vector similarity + business score
- Inputs:
  - query intent
  - user location
  - vendor service radius
  - rating/reviews confidence

## Phase 4: AI Ranking and Explanations
- Add explainable ranking fields in API responses
- Provide lightweight reason labels (for example: Near you, Highly rated, Fast response)

## Phase 5: Operations and Safety
- Monitoring for latency, recall, and ranking drift
- Prompt/version controls for AI features
- Kill switches and staged rollouts

## Non-Goals (Current)
- No production migration to vector DB until baseline metrics are stable
- No changes to existing auth/env deployment flows
