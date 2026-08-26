# TASK: User Story & Acceptance Criteria Formulation (v1)

## Context:

- Project Name: {{projectName}}
- Epic Title: {{epicTitle}}
- Epic Description: {{epicDescription}}
- Epic Rationale: {{epicRationale}}

## Retrieved Prior Knowledge & Reference Context (RAG):

{{ragContext}}

## Instructions:

Generate detailed user stories for this Epic in standard "As a... I want... So that..." form.
For EACH user story, provide explicit, testable Gherkin-style acceptance criteria (Given / When / Then).
You MUST output ONLY a valid JSON object matching the following schema:

```json
{
  "stories": [
    {
      "title": "Story summary title",
      "asA": "user role / persona",
      "iWant": "capability or action",
      "soThat": "benefit or business outcome",
      "acceptanceCriteria": [
        {
          "scenarioTitle": "Happy path scenario name",
          "givenText": "Precondition state",
          "whenText": "User action or trigger event",
          "thenText": "Expected observable outcome"
        }
      ]
    }
  ]
}
```
