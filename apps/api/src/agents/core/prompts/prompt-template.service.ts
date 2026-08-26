import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AgentRole } from '@ironloom/shared';

export interface PromptCompositionParams {
  role: AgentRole;
  taskType: string;
  context: Record<string, any>;
  fewShotKey?: string;
  version?: string;
}

export interface ComposedPrompt {
  systemPrompt: string;
  userPrompt: string;
  rawFewShots?: Array<{ input: string; output: string }>;
}

@Injectable()
export class PromptTemplateService {
  private readonly logger = new Logger(PromptTemplateService.name);
  private readonly templatesDir: string;

  constructor() {
    // Locate templates directory relative to source/dist
    this.templatesDir = path.resolve(__dirname, 'templates');
  }

  /**
   * Compose a full prompt structure combining base system prompt, role prompt, task template, and few-shots.
   */
  async compose(params: PromptCompositionParams): Promise<ComposedPrompt> {
    const version = params.version || 'v1';

    // 1. Load base system prompt
    const baseSystem = this.loadTemplate(`system/base.${version}.md`, '# IRONLOOM OS BASE DIRECTIVE');

    // 2. Load role specific system prompt
    const rolePrompt = this.loadTemplate(
      `roles/${params.role}.${version}.md`,
      `# ROLE: ${params.role}\nYou are the ${params.role} agent in IRONLOOM.`,
    );

    // 3. Combine system prompt sections
    const systemPrompt = `${baseSystem}\n\n---\n\n${rolePrompt}`.trim();

    // 4. Load and interpolate task template
    const rawTaskTemplate = this.loadTemplate(
      `tasks/${params.taskType}.${version}.md`,
      `# TASK: ${params.taskType}\n\nContext:\n{{taskContext}}\n\nUser Prompt: {{userPrompt}}`,
    );

    let userPrompt = this.interpolate(rawTaskTemplate, params.context);

    // 5. Load few-shots if specified
    let rawFewShots: Array<{ input: string; output: string }> | undefined;
    if (params.fewShotKey) {
      rawFewShots = this.loadJson<Array<{ input: string; output: string }>>(
        `few_shots/${params.fewShotKey}.${version}.json`,
      );

      if (rawFewShots && rawFewShots.length > 0) {
        const fewShotText = rawFewShots
          .map((fs, idx) => `### Example ${idx + 1}:\nInput: ${fs.input}\nOutput: ${fs.output}`)
          .join('\n\n');
        userPrompt = `${fewShotText}\n\n---\n\n${userPrompt}`;
      }
    }

    return {
      systemPrompt,
      userPrompt,
      rawFewShots,
    };
  }

  private loadTemplate(relativePath: string, fallbackContent: string): string {
    try {
      const fullPath = path.join(this.templatesDir, relativePath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf8');
      }
    } catch (err: any) {
      this.logger.debug(`Template file ${relativePath} not found on disk, using fallback: ${err.message}`);
    }
    return fallbackContent;
  }

  private loadJson<T>(relativePath: string): T | undefined {
    try {
      const fullPath = path.join(this.templatesDir, relativePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        return JSON.parse(content) as T;
      }
    } catch (err: any) {
      this.logger.debug(`JSON template ${relativePath} not loaded: ${err.message}`);
    }
    return undefined;
  }

  interpolate(template: string, context: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(context)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      const replacement = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '');
      result = result.replace(placeholder, replacement);
    }
    // Clean up any remaining unreplaced placeholders
    return result.replace(/{{\s*[\w.-]+\s*}}/g, '');
  }
}
