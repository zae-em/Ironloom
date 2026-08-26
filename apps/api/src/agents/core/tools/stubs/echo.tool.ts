import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ITool } from '../tool.interface';

export const EchoToolInputSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  repetitions: z.number().int().positive().optional().default(1),
  prefix: z.string().optional().default('ECHO:'),
});

export type EchoToolInput = z.input<typeof EchoToolInputSchema>;

export interface EchoToolOutput {
  echo: string;
  count: number;
  timestamp: string;
}

@Injectable()
export class EchoTool implements ITool<EchoToolInput, EchoToolOutput> {
  readonly name = 'echo';
  readonly description =
    'A test tool that echoes back input parameters to verify agent tool calling execution pipelines.';
  readonly inputSchema = EchoToolInputSchema;

  async execute(input: EchoToolInput): Promise<EchoToolOutput> {
    const repetitions = input.repetitions ?? 1;
    const prefix = input.prefix ?? 'ECHO:';
    const repeated = Array(repetitions).fill(input.message).join(' | ');

    return {
      echo: `${prefix} ${repeated}`,
      count: repetitions,
      timestamp: new Date().toISOString(),
    };
  }
}
