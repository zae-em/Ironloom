import { Global, Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { RAGService } from './rag.service';

@Global()
@Module({
  providers: [EmbeddingService, RAGService],
  exports: [EmbeddingService, RAGService],
})
export class RAGModule {}
