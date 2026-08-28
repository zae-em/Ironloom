import { Module, Global } from '@nestjs/common';
import { TransactionalEmailService } from './email.service';

@Global()
@Module({
  providers: [TransactionalEmailService],
  exports: [TransactionalEmailService],
})
export class EmailModule {}
