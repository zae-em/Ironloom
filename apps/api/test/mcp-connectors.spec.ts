import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { GitHubConnector } from '../src/mcp/connectors/github.connector';
import { JiraConnector } from '../src/mcp/connectors/jira.connector';
import { FigmaConnector } from '../src/mcp/connectors/figma.connector';
import { SlackConnector } from '../src/mcp/connectors/slack.connector';

describe('MCP Connectors Test Suite', () => {
  let module: TestingModule;
  let githubConnector: GitHubConnector;
  let jiraConnector: JiraConnector;
  let figmaConnector: FigmaConnector;
  let slackConnector: SlackConnector;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [GitHubConnector, JiraConnector, FigmaConnector, SlackConnector],
    }).compile();

    githubConnector = module.get<GitHubConnector>(GitHubConnector);
    jiraConnector = module.get<JiraConnector>(JiraConnector);
    figmaConnector = module.get<FigmaConnector>(FigmaConnector);
    slackConnector = module.get<SlackConnector>(SlackConnector);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('1. GitHub Connector', () => {
    it('should report healthy in sandboxed mode', async () => {
      const status = await githubConnector.testConnection();
      expect(status.serverType).toBe('github');
      expect(status.healthy).toBe(true);
      expect(status.isSandboxed).toBe(true);
    });

    it('should expose 5 standard GitHub tools', () => {
      const tools = githubConnector.getTools();
      expect(tools.length).toBe(5);
      const names = tools.map((t) => t.name);
      expect(names).toContain('github_get_repo');
      expect(names).toContain('github_list_issues');
      expect(names).toContain('github_create_issue');
      expect(names).toContain('github_create_pull_request');
      expect(names).toContain('github_post_comment');
    });

    it('should create issue and return deterministic sandbox output', async () => {
      const createIssueTool = githubConnector
        .getTools()
        .find((t) => t.name === 'github_create_issue')!;
      const result: any = await createIssueTool.execute({
        owner: 'zae-em',
        repo: 'ironloom',
        title: 'Test Issue Architecture',
        body: 'Issue description body',
        labels: ['architecture', 'test'],
      });

      expect(result.sandboxed).toBe(true);
      expect(result.title).toBe('Test Issue Architecture');
      expect(result.issueNumber).toBeGreaterThan(0);
      expect(result.url).toContain('https://github.com/zae-em/ironloom/issues/');
    });
  });

  describe('2. Jira Connector', () => {
    it('should report healthy in sandboxed mode', async () => {
      const status = await jiraConnector.testConnection();
      expect(status.serverType).toBe('jira');
      expect(status.healthy).toBe(true);
      expect(status.isSandboxed).toBe(true);
    });

    it('should create Epic and Issue in sandboxed mode', async () => {
      const createEpic = jiraConnector.getTools().find((t) => t.name === 'jira_create_epic')!;
      const epicResult: any = await createEpic.execute({
        projectKey: 'IRON',
        name: 'AI Swarm Engine',
        summary: 'Build LangGraph state engine',
        description: 'Epic details',
      });

      expect(epicResult.sandboxed).toBe(true);
      expect(epicResult.key).toMatch(/^IRON-\d+/);
      expect(epicResult.issueType).toBe('Epic');

      const createIssue = jiraConnector.getTools().find((t) => t.name === 'jira_create_issue')!;
      const issueResult: any = await createIssue.execute({
        projectKey: 'IRON',
        summary: 'Story: MCP Integration',
        description: 'Story details',
        issueType: 'Story',
        priority: 'High',
      });

      expect(issueResult.sandboxed).toBe(true);
      expect(issueResult.key).toMatch(/^IRON-\d+/);
    });
  });

  describe('3. Figma Connector', () => {
    it('should report healthy in sandboxed mode', async () => {
      const status = await figmaConnector.testConnection();
      expect(status.serverType).toBe('figma');
      expect(status.healthy).toBe(true);
      expect(status.isSandboxed).toBe(true);
    });

    it('should retrieve mock Figma design files and component styles', async () => {
      const getFile = figmaConnector.getTools().find((t) => t.name === 'figma_get_file')!;
      const fileResult: any = await getFile.execute({ fileKey: 'abc123xyz' });

      expect(fileResult.sandboxed).toBe(true);
      expect(fileResult.document).toBeDefined();

      const getStyles = figmaConnector
        .getTools()
        .find((t) => t.name === 'figma_get_component_styles')!;
      const stylesResult: any = await getStyles.execute({ fileKey: 'abc123xyz' });

      expect(stylesResult.styles.length).toBeGreaterThan(0);
    });
  });

  describe('4. Slack Connector', () => {
    it('should report healthy in sandboxed mode', async () => {
      const status = await slackConnector.testConnection();
      expect(status.serverType).toBe('slack');
      expect(status.healthy).toBe(true);
      expect(status.isSandboxed).toBe(true);
    });

    it('should dispatch formatted approval card in sandboxed mode', async () => {
      const postCard = slackConnector
        .getTools()
        .find((t) => t.name === 'slack_post_approval_card')!;
      const cardResult: any = await postCard.execute({
        channel: '#sdlc-approvals',
        workflowRunId: '11111111-1111-1111-1111-111111111111',
        approvalRequestId: '22222222-2222-2222-2222-222222222222',
        gateNode: 'gate_architecture',
        title: 'Architecture Review Required',
        summary: 'Multi-tenant event processing system approved for build.',
        metadata: { version: 1 },
      });

      expect(cardResult.sandboxed).toBe(true);
      expect(cardResult.delivered).toBe(true);
      expect(cardResult.payloadSnapshot.blocks.length).toBeGreaterThan(1);
    });
  });
});
