import { Module } from '@nestjs/common';
import { AnomalyDetectorService } from './anomaly-detector.service';
import { ApprovalPolicyService } from './approval-policy.service';

@Module({
  providers: [AnomalyDetectorService, ApprovalPolicyService],
  exports: [AnomalyDetectorService, ApprovalPolicyService],
})
export class DevOpsModule {}
