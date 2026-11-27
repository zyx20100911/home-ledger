import {
  AccountType,
  CategoryType,
  TransactionType,
  type AccountDTO,
  type CategoryDTO,
} from '@home-ledger/shared';

export type CsvSource = 'standard' | 'wechat' | 'alipay';

export interface ParsedImportRow {
  rowKey: string;
  rowNumber: number;
  type: TransactionType;
  amount: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  occurredAt: string;
  occurredAtDisplay: string;
  note: string;
  rawAccountName: string;
  rawCategoryName: string;
  error: string | null;
}

export interface ParsedCsvResult {
  source: CsvSource;
  rows: ParsedImportRow[];
  skippedCount: number;
}

export const CSV_SOURCE_LABELS: Record<CsvSource, string> = {
  standard: 'Home Ledger 标准模板',
  wechat: '微信支付账单',
  alipay: '支付宝账单',
};

const CATEGORY_KEYWORD_GROUPS: Array<{ keywords: string[]; targets: string[] }> = [
  {
    keywords: ['餐饮', '美食', '外卖', '美团', '饿了么', '咖啡', '奶茶', '肯德基', '麦当劳', '星巴克', '餐厅', '饭'],
    targets: ['餐饮', '饮食', '美食'],
  },
  {
    keywords: ['超市', '生鲜', '买菜', '山姆', '盒马', '永辉', '淘宝', '京东', '拼多多', '日用', '百货', '购物', '服饰'],
    targets: ['购物', '日用', '百货', '买菜'],
  },
  {
    keywords: ['交通', '出行', '地铁', '公交', '打车', '滴滴', '高德', '加油', '充电', '高速', '停车', '高铁', '机票'],
    targets: ['交通', '出行'],
  },
  {
    keywords: ['物业', '水电', '燃气', '电费', '水费', '宽带', '话费', '房租', '住房', '居家', '家居'],
    targets: ['居家', '住房', '水电', '物业'],
  },
  {
    keywords: ['医院', '药店', '诊所', '体检', '医疗', '健康', '医保'],
    targets: ['医疗', '健康'],
  },
  {
    keywords: ['教育', '培训', '学费', '书', '文具', '课程', '亲子'],
    targets: ['教育', '学习', '亲子'],
  },
  {
    keywords: ['电影', '娱乐', '游戏', '旅游', '酒店', '门票', '会员', '视频', '音乐'],
    targets: ['娱乐', '休闲', '旅游'],
  },
  {
    keywords: ['工资', '薪资', '薪水', '发薪'],
    targets: ['工资', '薪资'],
  },
  {
    keywords: ['奖金', '绩效', '年终', '补贴'],
    targets: ['奖金'],
  },
  {
    keywords: ['理财', '分红', '利息', '基金', '股票', '收益', '余额宝'],
    targets: ['理财', '投资'],
  },
  {
    keywords: ['红包', '转账', '收款'],
    targets: ['红包', '其他'],
  },
];

/** 自动识别 UTF-8 / GB18030(GBK) 编码（解决支付宝导出 CSV 中文乱码） */
export function decodeCsvFileBuffer(buffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('gb18030').decode(buffer);
  }
  return text.replace(/^\uFEFF/, '');
}

/** RFC 4180 标准 CSV 解析，支持引号包裹与双引号转义 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((v) => v !== '')) rows.push(row);

  return rows;
}

export function validateImportRow(row: ParsedImportRow): string | null {
  if (!row.occurredAt) return '时间格式无效';
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(row.amount) || Number(row.amount) <= 0) {
    return '金额必须大于 0';
  }
  if (!row.accountId) return '请选择资金账户';
  if (row.type === TransactionType.TRANSFER) {
    if (!row.toAccountId) return '请选择转入账户';
    if (row.toAccountId === row.accountId) return '转出与转入账户不能相同';
  } else if (!row.categoryId) {
    return '请选择收支分类';
  }
  return null;
}

export function parseTransactionCsv(
  text: string,
  accounts: AccountDTO[],
  categories: CategoryDTO[],
  defaultAccountId: string | null = null,
): ParsedCsvResult {
  const allRows = parseCsvRows(text);
  if (allRows.length < 2) {
    throw new Error('CSV 文件为空或缺少数据行');
  }

  const detected = detectHeader(allRows);
  if (!detected) {
    throw new Error('未能识别 CSV 表头，请使用标准模板或微信/支付宝官方导出的 CSV 账单');
  }

  const { source, headerIndex, colMap } = detected;
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const fallbackAccId = defaultAccountId ?? activeAccounts[0]?.id ?? null;

  const parsedRows: ParsedImportRow[] = [];
  let skippedCount = 0;

  for (let i = headerIndex + 1; i < allRows.length; i += 1) {
    const raw = allRows[i]!;
    if (!raw.some((c) => c !== '')) continue;

    if (source === 'standard') {
      const timeStr = getCell(raw, colMap.time);
      const typeStr = getCell(raw, colMap.type);
      const catStr = getCell(raw, colMap.category);
      const accStr = getCell(raw, colMap.account);
      const toAccStr = getCell(raw, colMap.toAccount);
      const amtStr = getCell(raw, colMap.amount);
      const noteStr = getCell(raw, colMap.note);

      const type = parseTypeLabel(typeStr);
      if (!type) {
        skippedCount += 1;
        continue;
      }

      const parsedTime = parseOccurredAt(timeStr);
      const normalizedAmt = normalizeMoney(amtStr);
      const accountId = matchAccountId(accStr, activeAccounts, fallbackAccId);
      const toAccountId =
        type === TransactionType.TRANSFER ? matchAccountId(toAccStr, activeAccounts, null) : null;
      const categoryId =
        type === TransactionType.TRANSFER
          ? null
          : matchCategoryId(type, catStr, noteStr, categories);

      const item: ParsedImportRow = {
        rowKey: `row-${i}`,
        rowNumber: i + 1,
        type,
        amount: normalizedAmt,
        accountId,
        toAccountId,
        categoryId,
        occurredAt: parsedTime?.iso ?? '',
        occurredAtDisplay: parsedTime?.display ?? timeStr,
        note: noteStr,
        rawAccountName: accStr,
        rawCategoryName: catStr,
        error: null,
      };
      item.error = validateImportRow(item);
      parsedRows.push(item);
      continue;
    }

    // 微信 / 支付宝官方账单
    const ioStr = getCell(raw, colMap.io);
    const statusStr = getCell(raw, colMap.status);
    if (
      ioStr === '不计收支' ||
      ioStr === '/' ||
      statusStr.includes('交易关闭') ||
      statusStr.includes('已关闭')
    ) {
      skippedCount += 1;
      continue;
    }

    const type =
      ioStr === '收入'
        ? TransactionType.INCOME
        : ioStr === '支出'
          ? TransactionType.EXPENSE
          : null;
    if (!type) {
      skippedCount += 1;
      continue;
    }

    const timeStr = getCell(raw, colMap.time);
    const parsedTime = parseOccurredAt(timeStr);
    const amtStr = getCell(raw, colMap.amount);
    const normalizedAmt = normalizeMoney(amtStr);
    const payMethod = getCell(raw, colMap.account);
    const rawCat = getCell(raw, colMap.category);
    const counterparty = getCell(raw, colMap.counterparty);
    const goods = getCell(raw, colMap.goods);
    const remark = getCell(raw, colMap.note);

    const noteParts = [counterparty, goods, remark]
      .map((s) => s.trim())
      .filter((s) => s && s !== '/');
    const note = [...new Set(noteParts)].join(' · ').slice(0, 300);

    const defaultSourceHint = source === 'wechat' ? '微信' : '支付宝';
    const accountId = matchAccountId(
      payMethod || defaultSourceHint,
      activeAccounts,
      matchAccountId(defaultSourceHint, activeAccounts, fallbackAccId),
    );
    const categoryId = matchCategoryId(type, rawCat, note, categories);

    const item: ParsedImportRow = {
      rowKey: `row-${i}`,
      rowNumber: i + 1,
      type,
      amount: normalizedAmt,
      accountId,
      toAccountId: null,
      categoryId,
      occurredAt: parsedTime?.iso ?? '',
      occurredAtDisplay: parsedTime?.display ?? timeStr,
      note,
      rawAccountName: payMethod || defaultSourceHint,
      rawCategoryName: rawCat,
      error: null,
    };
    item.error = validateImportRow(item);
    parsedRows.push(item);
  }

  if (!parsedRows.length) {
    throw new Error('未解析到可导入的收支记录（不计收支或已关闭交易已被自动过滤）');
  }

  return {
    source,
    rows: parsedRows,
    skippedCount,
  };
}

export function downloadImportTemplate(accounts: AccountDTO[], categories: CategoryDTO[]): void {
  const firstAcc = accounts.find((a) => !a.isArchived)?.name || '招商银行储蓄卡';
  const secondAcc = accounts.filter((a) => !a.isArchived)[1]?.name || '微信零钱通';
  const expCat = categories.find((c) => c.type === CategoryType.EXPENSE)?.name || '餐饮美食';
  const incCat = categories.find((c) => c.type === CategoryType.INCOME)?.name || '工资薪金';

  const lines = [
    '时间,类型,分类,资金账户,转入账户,金额,备注',
    `2026-11-27 12:30:00,支出,${expCat},${secondAcc},,48.50,工作日午餐`,
    `2026-11-25 09:30:00,收入,${incCat},${firstAcc},,18000.00,月度薪资`,
    `2026-11-26 18:00:00,转账,,${firstAcc},${secondAcc},1000.00,转入日常消费备用金`,
  ];

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'home-ledger-import-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function detectHeader(rows: string[][]): {
  source: CsvSource;
  headerIndex: number;
  colMap: Record<string, number>;
} | null {
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i += 1) {
    const headers = rows[i]!.map((h) => h.replace(/\s+/g, ''));
    const findIdx = (...candidates: string[]) =>
      headers.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

    const timeIdx = findIdx('交易时间', '交易创建时间', '时间');
    const ioIdx = findIdx('收/支');
    const typeIdx = findIdx('类型');
    const amtIdx = findIdx('金额(元)', '金额');

    // 微信账单
    if (timeIdx >= 0 && ioIdx >= 0 && amtIdx >= 0) {
      const isWechat =
        headers.some((h) => h.includes('金额(元)')) ||
        headers.some((h) => h === '支付方式') ||
        headers.some((h) => h === '交易类型');
      const isAlipay =
        !isWechat &&
        (headers.some((h) => h.includes('收/付款方式')) ||
          headers.some((h) => h.includes('交易分类')) ||
          headers.some((h) => h.includes('商品说明')));

      const source: CsvSource = isWechat ? 'wechat' : isAlipay ? 'alipay' : 'wechat';
      return {
        source,
        headerIndex: i,
        colMap: {
          time: timeIdx,
          io: ioIdx,
          amount: amtIdx,
          category: findIdx('交易分类', '交易类型'),
          account: findIdx('支付方式', '收/付款方式'),
          counterparty: findIdx('交易对方'),
          goods: findIdx('商品说明', '商品'),
          status: findIdx('当前状态', '交易状态'),
          note: findIdx('备注'),
        },
      };
    }

    // 标准模板
    if (timeIdx >= 0 && typeIdx >= 0 && amtIdx >= 0) {
      return {
        source: 'standard',
        headerIndex: i,
        colMap: {
          time: timeIdx,
          type: typeIdx,
          category: findIdx('分类'),
          account: findIdx('资金账户', '账户'),
          toAccount: findIdx('转入账户'),
          amount: amtIdx,
          note: findIdx('备注'),
        },
      };
    }
  }
  return null;
}

function getCell(row: string[], index: number | undefined): string {
  if (index === undefined || index < 0) return '';
  return (row[index] ?? '').trim();
}

function parseTypeLabel(raw: string): TransactionType | null {
  const v = raw.trim().toUpperCase();
  if (v === '支出' || v === TransactionType.EXPENSE) return TransactionType.EXPENSE;
  if (v === '收入' || v === TransactionType.INCOME) return TransactionType.INCOME;
  if (v === '转账' || v === TransactionType.TRANSFER) return TransactionType.TRANSFER;
  return null;
}

function normalizeMoney(raw: string): string {
  const cleaned = raw.replace(/[¥￥,\s+]/g, '').replace(/^-/, '');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(cleaned)) return cleaned;
  const [intPart, decPart = ''] = cleaned.split('.');
  return `${intPart}.${decPart.padEnd(2, '0')}`;
}

function parseOccurredAt(raw: string): { iso: string; display: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\//g, '-');
  const d = new Date(normalized.includes('T') ? normalized : normalized.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  const display = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { iso: d.toISOString(), display };
}

function matchAccountId(
  rawName: string,
  accounts: AccountDTO[],
  fallbackId: string | null,
): string | null {
  if (!accounts.length) return null;
  const clean = rawName
    .trim()
    .replace(/[（(][^）)]*[）)]/g, '')
    .trim();
  if (!clean || clean === '/') return fallbackId;

  const exact = accounts.find((a) => a.name === clean || a.name === rawName.trim());
  if (exact) return exact.id;

  const fuzzy = accounts.find((a) => a.name.includes(clean) || clean.includes(a.name));
  if (fuzzy) return fuzzy.id;

  if (clean.includes('微信') || clean.includes('零钱')) {
    const wechat = accounts.find(
      (a) => a.type === AccountType.WECHAT || a.name.includes('微信'),
    );
    if (wechat) return wechat.id;
  }
  if (clean.includes('支付宝') || clean.includes('余额宝') || clean.includes('花呗')) {
    const alipay = accounts.find(
      (a) => a.type === AccountType.ALIPAY || a.name.includes('支付宝'),
    );
    if (alipay) return alipay.id;
  }
  if (clean.includes('信用卡')) {
    const cc = accounts.find((a) => a.type === AccountType.CREDIT_CARD);
    if (cc) return cc.id;
  }
  if (clean.includes('储蓄卡') || clean.includes('银行')) {
    const bank = accounts.find((a) => a.type === AccountType.BANK_CARD);
    if (bank) return bank.id;
  }

  return fallbackId;
}

function matchCategoryId(
  type: TransactionType,
  rawCategory: string,
  note: string,
  categories: CategoryDTO[],
): string | null {
  const candidates = categories.filter((c) => c.type === (type as unknown as CategoryType));
  if (!candidates.length) return null;

  const clean = rawCategory.trim();
  if (clean && clean !== '/') {
    const exact = candidates.find((c) => c.name === clean);
    if (exact) return exact.id;
    const fuzzy = candidates.find((c) => c.name.includes(clean) || clean.includes(c.name));
    if (fuzzy) return fuzzy.id;
  }

  const textForKeyword = `${clean} ${note}`;
  for (const group of CATEGORY_KEYWORD_GROUPS) {
    if (group.keywords.some((kw) => textForKeyword.includes(kw))) {
      const matched = candidates.find((c) =>
        group.targets.some((target) => c.name.includes(target)),
      );
      if (matched) return matched.id;
    }
  }

  return null;
}
