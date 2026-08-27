process.env.AI_DEFAULT_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../src/database/database.module';
import { AgentsCoreModule } from '../src/agents/core/agents-core.module';
import { AiGatewayModule } from '../src/ai-gateway/ai-gateway.module';
import { SandboxModule } from '../src/sandbox/sandbox.module';
import { DevOpsModule } from '../src/devops/devops.module';
import { RedisModule } from '../src/redis/redis.module';
import { DevOpsAgent } from '../src/agents/sdlc/devops.agent';
import { DevOpsRepository } from '../src/database/repositories/devops.repository';

describe('DevOps Agent Unit Tests', () => {
  let moduleRef: TestingModule;
  let devopsAgent: DevOpsAgent;
  let devOpsRepo: DevOpsRepository;
  const projectId = 'proj-devops-001';

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
        SandboxModule,
        DevOpsModule,
      ],
      providers: [DevOpsAgent],
    }).compile();

    devopsAgent = moduleRef.get<DevOpsAgent>(DevOpsAgent);
    devOpsRepo = moduleRef.get<DevOpsRepository>(DevOpsRepository);
  });

  it('should generate container manifests and promote build to dev environment', async () => {
    const result = await devopsAgent.promoteEnvironment({
      agentId: 'devops_agent_009',
      actorUserId: 'user-001',
      input: {
        environment: 'dev',
        version: 'v1.0.0',
        deployTarget: 'docker-container',
      },
      metadata: { projectId },
    });

    expect(result.output.status).toBe('success');
    expect(result.output.environment).toBe('dev');
    expect(result.output.version).toBe('v1.0.0');
    expect(result.output.manifests['Dockerfile']).toContain('FROM node:20-alpine');
    expect(result.output.manifests['k8s-deployment.yaml']).toContain('kind: Deployment');

    const deployments = await devOpsRepo.listDeployments(projectId);
    expect(deployments).toHaveLength(1);
    expect(deployments[0].status).toBe('success');
  });

  it('should execute staging smoke tests in isolated sandbox before promotion', async () => {
    const result = await devopsAgent.promoteEnvironment({
      agentId: 'devops_agent_009',
      actorUserId: 'user-001',
      input: {
        environment: 'staging',
        version: 'v1.1.0',
        deployTarget: 'docker-container',
      },
      metadata: { projectId },
    });

    expect(result.output.status).toBe('success');
    expect(result.output.smokeTestResult).toBeDefined();
    expect(result.output.smokeTestResult?.passed).toBe(true);
    expect(result.output.sandboxExecutionId).toBeDefined();
  });
});
