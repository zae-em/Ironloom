import { Module, forwardRef } from '@nestjs/common';
import { AnomalyDetectorService } from './anomaly-detector.service';
import { ApprovalPolicyService } from './approval-policy.service';
import { DevOpsService } from './devops.service';
import { DevOpsController } from './devops.controller';
import { OrchestrationModule } from '../orchestration/orchestration.module';

@Module({
  imports: [forwardRef(() => OrchestrationModule)],
  controllers: [DevOpsController],
  providers: [AnomalyDetectorService, ApprovalPolicyService, DevOpsService],
  exports: [AnomalyDetectorService, ApprovalPolicyService, DevOpsService],
})
export class DevOpsModule {}
