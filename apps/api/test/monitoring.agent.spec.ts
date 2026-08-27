process.env.AI_DEFAULT_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../src/database/database.module';
import { AgentsCoreModule } from '../src/agents/core/agents-core.module';
import { AiGatewayModule } from '../src/ai-gateway/ai-gateway.module';
import { DevOpsModule } from '../src/devops/devops.module';
import { RedisModule } from '../src/redis/redis.module';
import { MonitoringAgent } from '../src/agents/sdlc/monitoring.agent';
import { DevOpsRepository } from '../src/database/repositories/devops.repository';

describe('Monitoring Agent Unit Tests', () => {
  let moduleRef: TestingModule;
  let monitoringAgent: MonitoringAgent;
  let devOpsRepo: DevOpsRepository;
  const projectId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              aiGateway: {
                defaultProvider: 'mock',
                fallbackProviders: [],
                maxRetries: 1,
                retryDelayMs: 10,
              },
              supabase: { url: 'http://localhost:54321', serviceRoleKey: 'test_key' },
            }),
          ],
        }),
        RedisModule,
        DatabaseModule,
        AiGatewayModule,
        AgentsCoreModule,
        DevOpsModule,
      ],
      providers: [MonitoringAgent],
    }).compile();

    monitoringAgent = moduleRef.get<MonitoringAgent>(MonitoringAgent);
    devOpsRepo = moduleRef.get<DevOpsRepository>(DevOpsRepository);
  });

  it('should report nominal state when telemetry metrics are healthy', async () => {
    const result = await monitoringAgent.auditTelemetry({
      agentId: 'monitoring_agent_009',
      actorUserId: 'user-001',
      input: {
        projectId,
        environment: 'prod',
        telemetry: {
          timestamp: new Date().toISOString(),
          cpuUsagePercent: 20.0,
          memoryUsagePercent: 35.0,
          errorRatePercent: 0.01,
          latencyP95Ms: 40.0,
          requestCount: 10000,
          activeInstances: 2,
        },
      },
    });

    expect(result.output.anomalyDetected).toBe(false);
    expect(result.output.incidentCreated).toBeUndefined();
  });

  it('should raise incident record and spawn task on error rate spike anomaly', async () => {
    const result = await monitoringAgent.auditTelemetry({
      agentId: 'monitoring_agent_009',
      actorUserId: 'user-001',
      input: {
        projectId,
        environment: 'prod',
        telemetry: {
          timestamp: new Date().toISOString(),
          cpuUsagePercent: 40.0,
          memoryUsagePercent: 60.0,
          errorRatePercent: 3.4,
          latencyP95Ms: 90.0,
          requestCount: 15000,
          activeInstances: 2,
        },
      },
    });

    expect(result.output.anomalyDetected).toBe(true);
    expect(result.output.incidentCreated).toBeDefined();
    expect(result.output.incidentCreated?.severity).toBe('high');
    expect(result.output.incidentCreated?.title).toContain('RULE_ERROR_RATE_SPIKE');
    expect(result.output.taskCreatedId).toBeDefined();

    const incidents = await devOpsRepo.listIncidents(projectId);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].status).toBe('open');
  });
});
