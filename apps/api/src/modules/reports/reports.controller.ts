import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { OverviewReportDTO } from '@home-ledger/shared';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '@/modules/auth/types/auth-user.interface';
import { QueryBudgetsDto } from '@/modules/budgets/dto/budget.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('families/:familyId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: '获取首页财务概览（净资产、月度收支、分类占比与 6 个月趋势）' })
  overview(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryBudgetsDto,
  ): Promise<OverviewReportDTO> {
    return this.reportsService.getOverview(familyId, user.id, query.year, query.month);
  }
}
