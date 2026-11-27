import { Global, Module } from '@nestjs/common';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';
import { FamilyAccessService } from './family-access.service';

@Global()
@Module({
  controllers: [FamiliesController],
  providers: [FamiliesService, FamilyAccessService],
  exports: [FamilyAccessService],
})
export class FamiliesModule {}
