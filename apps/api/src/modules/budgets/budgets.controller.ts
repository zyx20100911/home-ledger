import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BudgetDTO, BudgetSummaryDTO } from '@home-ledger/shared';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '@/modules/auth/types/auth-user.interface';
import { BudgetsService } from './budgets.service';
import { QueryBudgetsDto, UpsertBudgetDto } from './dto/budget.dto';

@ApiTags('Budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('families/:familyId/budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: '查询指定月份的家庭总预算、分类预算与执行进度' })
  summary(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryBudgetsDto,
  ): Promise<BudgetSummaryDTO> {
    return this.budgetsService.getMonthlySummary(familyId, user.id, query.year, query.month);
  }

  @Put()
  @ApiOperation({ summary: '设置或更新家庭总预算 / 分类预算' })
  upsert(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertBudgetDto,
  ): Promise<BudgetDTO> {
    return this.budgetsService.upsert(familyId, user.id, dto);
  }

  @Delete(':budgetId')
  @ApiOperation({ summary: '删除指定预算配置' })
  remove(
    @Param('familyId') familyId: string,
    @Param('budgetId') budgetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string }> {
    return this.budgetsService.remove(familyId, budgetId, user.id);
  }
}
