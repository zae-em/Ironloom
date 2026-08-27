import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../src/database/database.module';
import { SandboxModule } from '../src/sandbox/sandbox.module';
import { SandboxService } from '../src/sandbox/sandbox.service';

describe('Sandbox Execution & Security Isolation Test Suite', () => {
  let module: TestingModule;
  let sandboxService: SandboxService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, SandboxModule],
    }).compile();

    sandboxService = module.get<SandboxService>(SandboxService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('1. should execute standard commands and collect output files inside sandbox', async () => {
    const result = await sandboxService.executeTask({
      files: {
        'src/math.ts': 'export function add(a: number, b: number) { return a + b; }\n',
      },
      commands: ['echo "Building math module..."'],
      resourceLimits: { memoryMb: 512, cpuQuota: 1.0, timeoutMs: 15000 },
      networkPolicy: 'none',
    });

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.oomKilled).toBe(false);
    expect(result.stdout).toContain('Building math module');
  });

  it('2. SECURITY: should enforce network egress restrictions (policy: none)', async () => {
    const result = await sandboxService.executeTask({
      commands: ['curl -s https://api.github.com/zen'],
      networkPolicy: 'none',
      resourceLimits: { timeoutMs: 5000 },
    });

    expect(result.exitCode).toBe(1);
    expect(result.networkViolations.length).toBeGreaterThan(0);
    expect(result.stderr).toContain('[Sandbox Firewall]');
  });

  it('3. SECURITY: should terminate runaway execution exceeding hard timeout limit', async () => {
    // Set a short 500ms timeout with a ping/wait command that exceeds it
    const isWindows = process.platform === 'win32';
    const sleepCmd = isWindows ? 'ping 127.0.0.1 -n 4 > nul' : 'sleep 3';

    const result = await sandboxService.executeTask({
      commands: [sleepCmd],
      resourceLimits: { timeoutMs: 500 },
    });

    expect(result.timedOut).toBe(true);
    expect(result.stderr).toContain('[Sandbox Timeout]');
  });

  it('4. SECURITY: should enforce memory limits and kill runaway memory allocation', async () => {
    const result = await sandboxService.executeTask({
      commands: ['allocate_infinite_memory_bomb'],
      resourceLimits: { memoryMb: 128 },
    });

    expect(result.oomKilled).toBe(true);
    expect(result.exitCode).toBe(137);
    expect(result.stderr).toContain('[Sandbox Cgroup]');
  });

  it('5. SECURITY: should guarantee zero ambient host secret leakage into sandbox', async () => {
    // Set dummy host environment variable
    process.env.SECRET_MASTER_KEY = 'super_secret_host_key_12345';

    const isWindows = process.platform === 'win32';
    const envCheckCmd = isWindows ? 'echo %SECRET_MASTER_KEY%' : 'echo $SECRET_MASTER_KEY';

    const result = await sandboxService.executeTask({
      commands: [envCheckCmd],
    });

    // In isolated sanitized environment, SECRET_MASTER_KEY must not resolve to the host value
    expect(result.stdout).not.toContain('super_secret_host_key_12345');
  });
});
