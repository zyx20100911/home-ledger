import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  AccountDTO,
  AccountSummaryDTO,
  BatchImportAccountsResult,
} from '@home-ledger/shared';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '@/modules/auth/types/auth-user.interface';
import { AccountsService } from './accounts.service';
import { BatchImportAccountsDto, CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('families/:familyId/accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: '获取家庭资金账户列表与净资产汇总' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  list(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<AccountSummaryDTO> {
    return this.accountsService.list(familyId, user.id, includeArchived === 'true');
  }

  @Get('export')
  @ApiOperation({ summary: '导出资金账户清单为 CSV' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  async exportCsv(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<void> {
    const { filename, content } = await this.accountsService.exportCsv(
      familyId,
      user.id,
      includeArchived === 'true',
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(content);
  }

  @Post('batch-import')
  @ApiOperation({ summary: '批量导入或校准资金账户' })
  batchImport(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BatchImportAccountsDto,
  ): Promise<BatchImportAccountsResult> {
    return this.accountsService.batchImport(familyId, user.id, dto);
  }

  @Post()
  @ApiOperation({ summary: '新增资金账户' })
  create(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountDTO> {
    return this.accountsService.create(familyId, user.id, dto);
  }

  @Patch(':accountId')
  @ApiOperation({ summary: '编辑或归档资金账户' })
  update(
    @Param('familyId') familyId: string,
    @Param('accountId') accountId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountDTO> {
    return this.accountsService.update(familyId, accountId, user.id, dto);
  }
}
