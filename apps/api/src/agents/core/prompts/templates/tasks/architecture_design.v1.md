# TASK: System Architecture & Data Model Design (v1)

## Context:
- Project Name: {{projectName}}
- Approved Epics & Stories:
{{requirementsSummary}}

## Retrieved Prior Knowledge & Reference Context (RAG):
{{ragContext}}

## Instructions:
Synthesize the approved requirements into a coherent, scalable system architecture proposal.
Define modular components, tech choices with trade-off justifications, a data model with entity fields and relationships, and a valid Mermaid graph specification (`graph TD` or `erDiagram`).
You MUST output ONLY a valid JSON object matching the following schema:

```json
{
  "title": "Architecture Proposal Title",
  "summary": "High-level overview of architectural paradigm and system topology.",
  "components": [
    {
      "name": "Component Name",
      "description": "Responsibility and boundaries",
      "techChoice": "Selected framework / database / engine",
      "justification": "Why this choice best fits requirements and cost constraints"
    }
  ],
  "techStack": [
    {
      "category": "Frontend / Backend / Database / Cache / AI",
      "technology": "Specific technology",
      "justification": "Rationale"
    }
  ],
  "dataModel": {
    "entities": [
      {
        "name": "EntityName",
        "fields": ["id: UUID", "name: String", "created_at: Timestamp"],
        "description": "Domain purpose"
      }
    ],
    "relationships": [
      "EntityA 1 -> N EntityB"
    ]
  },
  "diagramMermaid": "graph TD\n  Client[Web Client] --> API[API Gateway]\n  API --> DB[(PostgreSQL)]"
}
```
