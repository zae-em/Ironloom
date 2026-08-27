import { z } from 'zod';
import { ToolExecutionResult } from '@ironloom/shared';

export interface ITool<TInput = any, TOutput = any> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<any, any, any>;
  execute(input: TInput): Promise<TOutput>;
}
