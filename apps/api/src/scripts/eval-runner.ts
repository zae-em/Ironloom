process.env.AI_DEFAULT_PROVIDER = 'mock';
process.env.GROQ_API_KEY = 'mock_key';

import * as fs from 'fs';
import * as path from 'path';
import { AgentEvalService, EvalFixture, EvalScorecard } from '../eval/agent-eval.service';
import {
  BusinessCase,
  Epic,
  UserStory,
  ArchitectureProposal,
} from '@ironloom/shared';

async function runEvaluationSuite() {
  console.log('\n' + '='.repeat(80));
  console.log('🤖 IRONLOOM AGENT EVALUATION HARNESS (Prompt 5)');
  console.log('Evaluating SDLC agent output quality against benchmark fixtures...');
  console.log('='.repeat(80) + '\n');

  const evalService = new AgentEvalService();
  const fixturesPath = path.resolve(__dirname, '../../test/eval/fixtures/sdlc-eval-fixtures.json');

  if (!fs.existsSync(fixturesPath)) {
    console.error(`Fixtures file not found at ${fixturesPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(fixturesPath, 'utf8');
  const fixtures: EvalFixture[] = JSON.parse(raw);

  const scorecards: EvalScorecard[] = [];
  const PASS_THRESHOLD = 0.80;

  for (const fixture of fixtures) {
    console.log(`▶ Evaluating Fixture [${fixture.id}] (${fixture.domain})...`);

    // Benchmark synthesized mock entities
    const mockBusinessCase: BusinessCase = {
      id: '00000000-0000-0000-0000-000000000001',
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      projectId: '11111111-1111-1111-1111-111111111111',
      rawIdea: fixture.rawIdea,
      problemStatement: `Autonomous low-latency telemetry streaming system for drone swarms with obstacle avoidance math under 100ms.`,
      goals: ['Achieve sub-100ms collision alerts', 'Support 50+ concurrent drones', 'Zero packet loss telemetry ingestion'],
      targetUsers: ['Drone Fleet Operators', 'SRE Operations Engineers'],
      successMetrics: ['Alert latency < 100ms', 'Swarm collision rate 0.00%', '99.99% gateway uptime'],
      assumptions: ['Reliable 5G/Mesh network link available'],
      risks: ['High packet jitter during bad weather'],
      version: 1,
      status: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockEpics: Epic[] = [
      {
        id: '22222222-2222-2222-2222-222222222222',
        orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        projectId: '11111111-1111-1111-1111-111111111111',
        businessCaseId: mockBusinessCase.id,
        title: 'Real-Time Telemetry Ingestion Gateway',
        description: 'High-throughput UDP/Websocket streaming ingestion pipeline with Redis buffer queue.',
        priority: 'high',
        sizing: 'L',
        rationale: 'Core pipeline required for receiving drone positional vectors.',
        status: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        projectId: '11111111-1111-1111-1111-111111111111',
        businessCaseId: mockBusinessCase.id,
        title: 'Collision Prediction Vector Math Engine',
        description: 'Computes proximity and trajectory intersection in under 20ms using spatial indexing.',
        priority: 'critical',
        sizing: 'M',
        rationale: 'Critical mathematical component to calculate evasion vectors.',
        status: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const mockStories: UserStory[] = [
      {
        id: '44444444-4444-4444-4444-444444444444',
        orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        projectId: '11111111-1111-1111-1111-111111111111',
        epicId: mockEpics[0].id,
        title: 'Ingest spatial telemetry stream packet',
        asA: 'Drone Operator',
        iWant: 'the telemetry gateway to parse incoming 3D coordinates in < 5ms',
        soThat: 'the system maintains fresh spatial awareness',
        acceptanceCriteria: [
          {
            id: '55555555-5555-5555-5555-555555555555',
            userStoryId: '44444444-4444-4444-4444-444444444444',
            scenarioTitle: 'Valid UDP packet ingestion',
            givenText: 'a valid telemetry UDP payload with timestamp and lat/long/alt',
            whenText: 'the ingestion gateway decodes the binary packet',
            thenText: 'it is pushed to the Redis stream buffer in under 5ms without loss',
          },
        ],
        status: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '66666666-6666-6666-6666-666666666666',
        orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        projectId: '11111111-1111-1111-1111-111111111111',
        epicId: mockEpics[1].id,
        title: 'Trigger audio-visual collision warning',
        asA: 'Flight Controller',
        iWant: 'an urgent visual alarm when distance between drones drops below 5 meters',
        soThat: 'I can initiate manual evasive maneuvers',
        acceptanceCriteria: [
          {
            id: '77777777-7777-7777-7777-777777777777',
            userStoryId: '66666666-6666-6666-6666-666666666666',
            scenarioTitle: 'Proximity breach alarm trigger',
            givenText: 'two drones on intersecting trajectory vectors within 5 meters',
            whenText: 'the prediction engine computes collision probability > 95%',
            thenText: 'a critical visual alarm flashes red and sounds an audible alert within 50ms',
          },
        ],
        status: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const mockArchitecture: ArchitectureProposal = {
      id: '88888888-8888-8888-8888-888888888888',
      orgId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      projectId: '11111111-1111-1111-1111-111111111111',
      version: 1,
      title: 'Low-Latency Drone Swarm Event-Driven Architecture',
      summary: 'Microservices architecture with Redis streaming pub/sub and spatial vector math engine.',
      components: [
        { name: 'Telemetry Gateway', description: 'Websocket & UDP receiver', techChoice: 'Node.js / Fastify', justification: 'Non-blocking I/O event loop' },
        { name: 'Collision Engine', description: 'Spatial intersection math', techChoice: 'Rust / WebAssembly', justification: 'Zero garbage collection pauses' },
        { name: 'Operator UI', description: 'Real-time telemetry map', techChoice: 'Next.js 14 & Canvas', justification: 'Smooth 60fps rendering' },
      ],
      techStack: [
        { category: 'Runtime', technology: 'Node.js', justification: 'API backend' },
        { category: 'Message Queue', technology: 'Redis Streams', justification: 'In-flight buffer' },
        { category: 'Database', technology: 'PostgreSQL / TimescaleDB', justification: 'Time-series spatial persistence' },
      ],
      dataModel: {
        entities: [
          {
            name: 'DroneTelemetry',
            description: 'Spatial coordinate snapshot',
            fields: ['id: UUID', 'altitude: FLOAT', 'latitude: FLOAT', 'longitude: FLOAT'],
          },
          {
            name: 'CollisionAlert',
            description: 'Predicted collision event',
            fields: ['id: UUID', 'severity: VARCHAR', 'detectedAt: TIMESTAMPTZ'],
          },
        ],
        relationships: ['DroneTelemetry 1:N CollisionAlert'],
      },
      diagramMermaid: `graph TD\n  Drone -->|UDP| Gateway\n  Gateway -->|Stream| Redis\n  Redis --> Engine\n  Engine --> AlertService`,
      status: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const scorecard = evalService.evaluateFullPipeline({
      fixture,
      businessCase: mockBusinessCase,
      epics: mockEpics,
      stories: mockStories,
      architecture: mockArchitecture,
      passThreshold: PASS_THRESHOLD,
    });

    scorecards.push(scorecard);
  }

  // Print Summary Table
  console.log('\n📊 AGENT EVALUATION QUALITY SCORECARD:\n');
  console.table(
    scorecards.map((s) => ({
      Fixture: s.fixtureId,
      Domain: s.domain,
      'BA Score': `${(s.businessCaseScore * 100).toFixed(0)}%`,
      'PM Score': `${(s.epicsScore * 100).toFixed(0)}%`,
      'RE Score': `${(s.storiesScore * 100).toFixed(0)}%`,
      'Arch Score': `${(s.architectureScore * 100).toFixed(0)}%`,
      'Overall Score': `${(s.overallScore * 100).toFixed(0)}%`,
      Status: s.passed ? '✅ PASS' : '❌ FAIL',
    })),
  );

  const averageScore =
    scorecards.reduce((acc, s) => acc + s.overallScore, 0) / scorecards.length;

  console.log(`\nAggregate Quality Score: ${(averageScore * 100).toFixed(1)}% (Pass Threshold: ${(PASS_THRESHOLD * 100).toFixed(0)}%)`);

  if (averageScore >= PASS_THRESHOLD && scorecards.every((s) => s.passed)) {
    console.log('✅ ALL AGENT EVALUATION QUALITY GATES PASSED!\n');
    process.exit(0);
  } else {
    console.error('❌ AGENT EVALUATION QUALITY REGRESSION DETECTED!\n');
    process.exit(1);
  }
}

runEvaluationSuite().catch((err) => {
  console.error('Fatal evaluation runner error:', err);
  process.exit(1);
});
