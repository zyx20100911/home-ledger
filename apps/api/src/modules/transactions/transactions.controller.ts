import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  BatchDeleteTransactionsResult,
  BatchImportTransactionsResult,
  BatchUpdateTransactionsResult,
  PaginatedData,
  TransactionDTO,
} from '@home-ledger/shared';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '@/modules/auth/types/auth-user.interface';
import {
  BatchDeleteTransactionsDto,
  BatchImportTransactionsDto,
  BatchUpdateTransactionsDto,
  CreateTransactionDto,
  ExportTransactionsDto,
  QueryTransactionsDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('families/:familyId/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: '分页筛选查询交易流水' })
  list(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryTransactionsDto,
  ): Promise<PaginatedData<TransactionDTO>> {
    return this.transactionsService.list(familyId, user.id, query);
  }

  @Get('export')
  @ApiOperation({ summary: '导出交易流水为 CSV（支持筛选条件与指定 ID）' })
  async exportCsv(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExportTransactionsDto,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, content } = await this.transactionsService.exportCsv(familyId, user.id, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(content);
  }

  @Post('batch-delete')
  @ApiOperation({ summary: '批量删除交易流水（单事务原子回滚账户余额）' })
  batchDelete(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BatchDeleteTransactionsDto,
  ): Promise<BatchDeleteTransactionsResult> {
    return this.transactionsService.batchDelete(familyId, user.id, dto);
  }

  @Post('batch-update')
  @ApiOperation({ summary: '批量修改流水分类或资金账户（单事务重算余额）' })
  batchUpdate(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BatchUpdateTransactionsDto,
  ): Promise<BatchUpdateTransactionsResult> {
    return this.transactionsService.batchUpdate(familyId, user.id, dto);
  }

  @Post('batch-import')
  @ApiOperation({ summary: '批量导入交易流水（单事务原子入库并更新账户余额）' })
  batchImport(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BatchImportTransactionsDto,
  ): Promise<BatchImportTransactionsResult> {
    return this.transactionsService.batchImport(familyId, user.id, dto);
  }

  @Post()
  @ApiOperation({ summary: '记一笔（支出/收入/转账，原子更新账户余额）' })
  create(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionDTO> {
    return this.transactionsService.create(familyId, user.id, dto);
  }

  @Patch(':transactionId')
  @ApiOperation({ summary: '编辑交易流水（自动回滚并重算账户余额）' })
  update(
    @Param('familyId') familyId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionDTO> {
    return this.transactionsService.update(familyId, transactionId, user.id, dto);
  }

  @Delete(':transactionId')
  @ApiOperation({ summary: '删除交易流水（自动回滚账户余额）' })
  remove(
    @Param('familyId') familyId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string }> {
    return this.transactionsService.remove(familyId, transactionId, user.id);
  }
}
