import { ACCOUNT_TYPE_LABELS, AccountType } from '@home-ledger/shared';
import { parseCsvRows } from './transactionCsv';

export interface ParsedAccountRow {
  rowKey: string;
  rowNumber: number;
  name: string;
  type: AccountType;
  balance: string;
  includeInNetWorth: boolean;
  institution: string;
  coverageAmount: string;
  renewalDateDisplay: string;
  renewalDateIso: string | null;
  note: string;
  error: string | null;
}

const TYPE_ALIAS_MAP: Record<string, AccountType> = {
  现金: AccountType.CASH,
  储蓄卡: AccountType.BANK_CARD,
  银行卡: AccountType.BANK_CARD,
  借记卡: AccountType.BANK_CARD,
  支付宝: AccountType.ALIPAY,
  微信: AccountType.WECHAT,
  微信零钱: AccountType.WECHAT,
  信用卡: AccountType.CREDIT_CARD,
  理财: AccountType.INVESTMENT,
  投资: AccountType.INVESTMENT,
  '理财/投资': AccountType.INVESTMENT,
  医保: AccountType.MEDICAL_INSURANCE,
  医保账户: AccountType.MEDICAL_INSURANCE,
  医疗保险账户: AccountType.MEDICAL_INSURANCE,
  社保: AccountType.SOCIAL_SECURITY,
  公积金: AccountType.SOCIAL_SECURITY,
  '社保/公积金': AccountType.SOCIAL_SECURITY,
  保险: AccountType.INSURANCE,
  商业保险: AccountType.INSURANCE,
  保单: AccountType.INSURANCE,
  财险: AccountType.INSURANCE,
  借贷: AccountType.DEBT,
  负债: AccountType.DEBT,
  '借贷/负债': AccountType.DEBT,
  其他: AccountType.OTHER,
  其他账户: AccountType.OTHER,
};

export function validateAccountRow(row: ParsedAccountRow): string | null {
  if (!row.name.trim()) return '缺少账户名称';
  if (row.name.trim().length > 40) return '账户名称不能超过 40 字';
  if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(row.balance)) return '余额格式无效';
  if (row.coverageAmount && !/^\d{1,12}(\.\d{1,2})?$/.test(row.coverageAmount)) {
    return '保额格式无效';
  }
  if (row.renewalDateDisplay && !row.renewalDateIso) {
    return '续保日期格式无效（应为 YYYY-MM-DD）';
  }
  return null;
}

export function parseAccountCsv(text: string): ParsedAccountRow[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    throw new Error('CSV 文件为空或缺少账户数据行');
  }

  const headers = rows[0]!.map((h) => h.replace(/\s+/g, ''));
  const findIdx = (...candidates: string[]) =>
    headers.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  const nameIdx = findIdx('账户名称', '名称');
  const typeIdx = findIdx('账户类型', '类型');
  const balanceIdx = findIdx('当前余额', '余额');
  if (nameIdx < 0 || typeIdx < 0 || balanceIdx < 0) {
    throw new Error('未能识别账户 CSV 表头（需包含「账户名称」「账户类型」「当前余额」列）');
  }

  const netWorthIdx = findIdx('计入净资产');
  const instIdx = findIdx('承保/所属机构', '所属机构', '承保机构', '机构');
  const covIdx = findIdx('保额');
  const renewalIdx = findIdx('续保到期日', '到期日', '续保日期');
  const noteIdx = findIdx('备注');

  const result: ParsedAccountRow[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const raw = rows[i]!;
    if (!raw.some((c) => c !== '')) continue;

    const getCell = (idx: number) => (idx >= 0 ? (raw[idx] ?? '').trim() : '');
    const name = getCell(nameIdx);
    const rawType = getCell(typeIdx);
    const type = parseAccountType(rawType) ?? AccountType.OTHER;
    const balance = normalizeSignedMoney(getCell(balanceIdx) || '0.00');
    const netWorthRaw = getCell(netWorthIdx);
    const includeInNetWorth = parseBooleanFlag(
      netWorthRaw,
      type !== AccountType.INSURANCE,
    );
    const institution = getCell(instIdx);
    const coverageRaw = getCell(covIdx);
    const coverageAmount = coverageRaw ? normalizeUnsignedMoney(coverageRaw) : '';
    const renewalRaw = getCell(renewalIdx);
    const renewal = parseDateInput(renewalRaw);
    const note = getCell(noteIdx);

    const item: ParsedAccountRow = {
      rowKey: `acc-${i}`,
      rowNumber: i + 1,
      name,
      type,
      balance,
      includeInNetWorth,
      institution,
      coverageAmount,
      renewalDateDisplay: renewal?.display ?? renewalRaw,
      renewalDateIso: renewal?.iso ?? null,
      note,
      error: null,
    };
    item.error = validateAccountRow(item);
    result.push(item);
  }

  if (!result.length) {
    throw new Error('未解析到可导入的账户数据');
  }

  return result;
}

export function downloadAccountImportTemplate(): void {
  const lines = [
    '账户名称,账户类型,当前余额,计入净资产,承保/所属机构,保额,续保到期日,备注',
    '招商银行储蓄卡,储蓄卡,50000.00,是,招商银行,,,家庭主力工资卡',
    '个人医保账户,医保账户,6840.50,是,市医保局,,,定点医院购药可刷卡',
    '住房公积金账户,社保/公积金,84200.00,是,市公积金中心,,,每月双边缴存',
    '家庭百万医疗险,商业保险,0.00,否,中国平安,4000000.00,2027-06-15,消费型一年期保障（不计净资产）',
    '家庭车险（商业+交强）,商业保险,0.00,否,中国人保,2000000.00,2027-03-20,京A家庭用车保单',
    '增额终身寿险,商业保险,42000.00,是,友邦保险,500000.00,2027-01-10,储蓄型保单（余额填当前现金价值）',
    '招商银行信用卡,信用卡,-3200.00,是,招商银行,,,日常消费信用卡',
  ];

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'home-ledger-accounts-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseAccountType(raw: string): AccountType | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper in ACCOUNT_TYPE_LABELS) {
    return upper as AccountType;
  }
  return TYPE_ALIAS_MAP[trimmed] ?? null;
}

function parseBooleanFlag(raw: string, fallback: boolean): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return fallback;
  if (['是', 'true', '1', 'yes', 'y'].includes(v)) return true;
  if (['否', 'false', '0', 'no', 'n'].includes(v)) return false;
  return fallback;
}

function normalizeSignedMoney(raw: string): string {
  const cleaned = raw.replace(/[¥￥,\s+]/g, '');
  if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(cleaned)) return cleaned;
  const neg = cleaned.startsWith('-');
  const abs = neg ? cleaned.slice(1) : cleaned;
  const [intPart, decPart = ''] = abs.split('.');
  return `${neg ? '-' : ''}${intPart}.${decPart.padEnd(2, '0')}`;
}

function normalizeUnsignedMoney(raw: string): string {
  const cleaned = raw.replace(/[¥￥,\s+]/g, '');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(cleaned)) return cleaned;
  const [intPart, decPart = ''] = cleaned.split('.');
  return `${intPart}.${decPart.padEnd(2, '0')}`;
}

function parseDateInput(raw: string): { display: string; iso: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\//g, '-');
  const d = new Date(normalized.includes('T') ? normalized : `${normalized.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const display = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { display, iso: d.toISOString() };
}
