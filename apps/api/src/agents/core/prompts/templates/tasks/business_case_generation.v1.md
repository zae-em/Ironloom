# TASK: Business Case Synthesis & Problem Definition (v1)

## Context:
- Project Name: {{projectName}}
- Raw Unstructured Idea:
"""
{{rawIdea}}
"""

## Retrieved Prior Knowledge & Reference Context (RAG):
{{ragContext}}

## Instructions:
Analyze the unstructured idea thoroughly and generate a comprehensive, structured business case.
You MUST output ONLY a valid JSON object matching the following schema exactly (no conversational prose, markdown backticks only if JSON is enclosed):

```json
{
  "problemStatement": "Clear definition of the core problem, pain points, and current limitations.",
  "goals": [
    "Measurable objective 1",
    "Measurable objective 2"
  ],
  "targetUsers": [
    "Primary persona or user segment",
    "Secondary persona"
  ],
  "successMetrics": [
    "KPI 1 (e.g. Reduce latency by 40%)",
    "KPI 2"
  ],
  "assumptions": [
    "Key assumption 1",
    "Key assumption 2"
  ],
  "risks": [
    "Technical or market risk 1",
    "Risk 2"
  ]
}
```
