import { getLocale } from '@/shared/i18n';

const en = {
  'cleanup.title': 'Subtitle cleanup',
  'cleanup.subtitle': 'Remove annotations that are not spoken. Rules apply in order.',
  'cleanup.addRule': 'Add rule',
  'cleanup.rulesGroup': 'Cleanup rules',
  'cleanup.builtinTag': 'built-in',
  'cleanup.customDivider': 'Custom',
  'cleanup.enableRule': 'Enable $1',
  'cleanup.editDialog.title': 'Edit cleanup rule',
  'cleanup.addDialog.title': 'New cleanup rule',
  'cleanup.field.name': 'Name',
  'cleanup.field.description': 'Description',
  'cleanup.field.pattern': 'Regex pattern',
  'cleanup.field.namePlaceholder': 'e.g. Fansub credits',
  'cleanup.field.descPlaceholder': 'What this rule removes',
  'cleanup.field.patternPlaceholder': 'e.g. \\[.*\\]',
  'cleanup.deleteDialog.title': 'Delete rule?',
  'cleanup.deleteDialog.description': '"$1" cannot be undone.',
  'cleanup.leadIn.label': 'Replay lead-in',
  'cleanup.leadIn.hint':
    'Start replays and study seeks this many milliseconds before the cue start, so speech onset is not cut off.',
  'cleanup.leadIn.aria': 'Replay lead-in milliseconds',
  'cleanup.leadIn.value': '$1 ms',
} as const;

type CleanupMessageKey = keyof typeof en;

const vi: Record<CleanupMessageKey, string> = {
  'cleanup.title': 'Dọn phụ đề',
  'cleanup.subtitle': 'Bỏ các chú thích không được đọc. Các quy tắc áp dụng theo thứ tự.',
  'cleanup.addRule': 'Thêm quy tắc',
  'cleanup.rulesGroup': 'Quy tắc dọn phụ đề',
  'cleanup.builtinTag': 'mặc định',
  'cleanup.customDivider': 'Tùy chỉnh',
  'cleanup.enableRule': 'Bật $1',
  'cleanup.editDialog.title': 'Sửa quy tắc dọn phụ đề',
  'cleanup.addDialog.title': 'Quy tắc dọn phụ đề mới',
  'cleanup.field.name': 'Tên',
  'cleanup.field.description': 'Mô tả',
  'cleanup.field.pattern': 'Biểu thức regex',
  'cleanup.field.namePlaceholder': 'vd. Credit fansub',
  'cleanup.field.descPlaceholder': 'Quy tắc này xóa phần nào',
  'cleanup.field.patternPlaceholder': 'vd. \\[.*\\]',
  'cleanup.deleteDialog.title': 'Xóa quy tắc?',
  'cleanup.deleteDialog.description': 'Không thể hoàn tác "$1".',
  'cleanup.leadIn.label': 'Phát lại sớm hơn',
  'cleanup.leadIn.hint':
    'Bắt đầu phát lại và seek học tập sớm hơn điểm bắt đầu cue số mili giây này, để không bị cắt mất đầu câu.',
  'cleanup.leadIn.aria': 'Số mili giây phát lại sớm hơn',
  'cleanup.leadIn.value': '$1 ms',
};

export function cleanupT(key: CleanupMessageKey, substitutions?: readonly (string | number)[]): string {
  const message = (getLocale() === 'vi' ? vi : en)[key] ?? en[key] ?? key;
  if (!substitutions?.length) return message;
  return substitutions.reduce<string>(
    (text, value, index) => text.replaceAll(`$${index + 1}`, String(value)),
    message,
  );
}
