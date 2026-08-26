# TASK: Product Epics & Backlog Breakdown (v1)

## Context:
- Project Name: {{projectName}}
- Business Case Problem Statement: {{problemStatement}}
- Goals: {{goals}}
- Target Users: {{targetUsers}}

## Retrieved Prior Knowledge & Reference Context (RAG):
{{ragContext}}

## Instructions:
Decompose the business case into distinct, high-impact Epics and features.
Assign meaningful T-shirt sizing (XS, S, M, L, XL) and priority (critical, high, medium, low).
You MUST output ONLY a valid JSON object matching the following schema:

```json
{
  "epics": [
    {
      "title": "Epic Title",
      "description": "Clear functional description of the epic capabilities.",
      "rationale": "Why this epic is critical to achieving the business goals.",
      "priority": "critical",
      "sizing": "M"
    }
  ]
}
```
