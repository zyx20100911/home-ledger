import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PaginatedData, TransactionDTO } from '@home-ledger/shared';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '@/modules/auth/types/auth-user.interface';
import {
  CreateTransactionDto,
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
