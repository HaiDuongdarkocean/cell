import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Alert, Badge, Button, Card, Checkbox, FlagIcon, Icon, IconButton,
  Progress, SectionHeader, Select, SelectableCard, Separator,
  Spinner, Text, HStack, VStack, Dialog,
} from '@/shared/ui';
import { MobileSheet } from '@/shared/ui/MobileSheet';
import { setUiLanguageOverride } from '@/shared/i18n';
import { MOCK_DECKS, MOCK_FIELDS, MOCK_LANGUAGES, MOCK_NOTETYPES, MOCK_SAMPLES, ROLE_OPTIONS } from './mockData';
import '@/shared/styles/document.css';
import './mockup.css';

document.documentElement.setAttribute('data-preset', 'dawn');
setUiLanguageOverride(new URLSearchParams(location.search).get('lang') ?? '');

type Step = 'source' | 'source-fail' | 'scope' | 'language' | 'mapping' | 'running' | 'report';
type Theme = 'light' | 'dark';
type Viewport = 'mobile' | 'desktop';

const STEPS: Step[] = ['source', 'source-fail', 'scope', 'language', 'mapping', 'running', 'report'];
const STEP_INDEX: Record<Step, number> = {
  source: 1, 'source-fail': 1, scope: 2, language: 3, mapping: 4, running: 5, report: 6,
};

function StepRail({ step }: { step: Step }): React.JSX.Element {
  const labels = ['Nguồn', 'Phạm vi', 'Ngôn ngữ', 'Trường', 'Chạy', 'Kết quả'];
  return (
    <div className="stepRail">
      <Badge>{`${STEP_INDEX[step]}/6`}</Badge>
      {labels.map((l, i) => (
        <Text key={l} variant="label" color={i + 1 <= STEP_INDEX[step] ? 'primary' : 'disabled'}>
          {l}
        </Text>
      ))}
    </div>
  );
}

function SourceStep({ fail }: { fail: boolean }): React.JSX.Element {
  return (
    <VStack gap="3">
      <div className="sourceGrid">
        <SelectableCard selected onSelect={() => {}}>
          <div className="sourceCard">
            <HStack gap="2"><Icon name="import" /><Text variant="label">Từ Anki đang mở</Text></HStack>
            <span className="hint">Nhanh — không cần export file. Cần addon AnkiConnect.</span>
          </div>
        </SelectableCard>
        <SelectableCard onSelect={() => {}}>
          <div className="sourceCard">
            <HStack gap="2"><Icon name="folderOpen" /><Text variant="label">Từ file .apkg</Text></HStack>
            <span className="hint">Chính xác tuyệt đối (giữ FSRS gốc). Không cần mở Anki.</span>
          </div>
        </SelectableCard>
      </div>
      {fail ? (
        <Alert
          variant="warning"
          icon={<Icon name="info" />}
          title="Chưa kết nối được Anki"
          description="Kiểm tra: 1) Anki đang mở? 2) Đã cài addon AnkiConnect? 3) URL đúng chưa?"
        />
      ) : (
        <HStack gap="2"><Spinner size="sm" /><Text variant="label">Đang kết nối AnkiConnect…</Text></HStack>
      )}
      {fail && (
        <div className="checklistBox">
          <div className="checklistRow"><Badge>1</Badge><Text>Mở Anki trên máy</Text></div>
          <div className="checklistRow"><Badge>2</Badge><Text>Cài addon AnkiConnect (Tools → Add-ons)</Text></div>
          <div className="checklistRow"><Badge>3</Badge><Text>http://localhost:8765</Text></div>
          <HStack gap="2"><Button variant="secondary" size="sm">Thử lại</Button></HStack>
        </div>
      )}
    </VStack>
  );
}

function ScopeStep(): React.JSX.Element {
  const [checked, setChecked] = useState<Record<string, boolean>>({ d1: true, d2: true, d3: true, 'nt-basic': true, 'nt-mining': true });
  return (
    <VStack gap="3">
      <HStack style={{ justifyContent: 'space-between' }}>
        <SectionHeader title="Decks" />
        <Button variant="ghost" size="sm">Chọn tất cả</Button>
      </HStack>
      <div className="pickList">
        {MOCK_DECKS.map((d) => (
          <label key={d.id} className="pickRow">
            <Checkbox checked={!!checked[d.id]} onChange={() => setChecked((c) => ({ ...c, [d.id]: !c[d.id] }))} />
            <span className="pickName">{d.name}</span>
            <span className="pickCounts">
              {d.counts.map((c) => (
                <Badge key={c.label} variant={c.tone === 'warn' ? 'warning' : 'default'} size="sm">{`${c.value} ${c.label}`}</Badge>
              ))}
            </span>
          </label>
        ))}
      </div>
      <SectionHeader title="Loại thẻ" />
      <div className="pickList">
        {MOCK_NOTETYPES.map((nt) => (
          <label key={nt.id} className={`pickRow${nt.cloze ? ' disabled' : ''}`}>
            <Checkbox
              checked={nt.cloze ? false : !!checked[nt.id]}
              disabled={nt.cloze}
              onChange={() => setChecked((c) => ({ ...c, [nt.id]: !c[nt.id] }))}
            />
            <span className="pickName">{nt.name}</span>
            <span className="pickCounts">
              <Badge size="sm">{`${nt.noteCount} notes`}</Badge>
              {nt.cloze && <Badge variant="warning" size="sm">không hỗ trợ</Badge>}
            </span>
          </label>
        ))}
      </div>
    </VStack>
  );
}

function LanguageStep(): React.JSX.Element {
  const [lang, setLang] = useState('ja');
  return (
    <VStack gap="3">
      <Text>Chọn ngôn ngữ mục tiêu cho bộ sưu tập import vào:</Text>
      <Select value={lang} onChange={setLang} options={MOCK_LANGUAGES} aria-label="Ngôn ngữ mục tiêu" />
      <HStack gap="2">
        <FlagIcon lang={lang} size={18} />
        <Text variant="supporting" color="secondary">
          Deck sẽ merge vào bộ sưu tập hiện có của ngôn ngữ này (hoặc tạo mới).
        </Text>
      </HStack>
    </VStack>
  );
}

function MappingStep(): React.JSX.Element {
  const [nt, setNt] = useState('nt-basic');
  const [roles, setRoles] = useState<Record<string, string>>(
    Object.fromEntries(MOCK_FIELDS['nt-basic']!.map((f) => [f.name, f.role])),
  );
  const [sampleIdx, setSampleIdx] = useState(0);
  const fields = MOCK_FIELDS[nt] ?? [];
  const samples = MOCK_SAMPLES[nt] ?? MOCK_SAMPLES['nt-basic']!;
  const sample = samples[sampleIdx % samples.length]!;
  const sentence = sample.sentence.replace(sample.target, '░'.repeat(sample.target.length));
  return (
    <VStack gap="3">
      <HStack gap="2">
        {MOCK_NOTETYPES.filter((n) => !n.cloze).map((n) => (
          <Button key={n.id} variant={n.id === nt ? 'secondary' : 'ghost'} size="sm" onClick={() => { setNt(n.id); setRoles(Object.fromEntries((MOCK_FIELDS[n.id] ?? []).map((f) => [f.name, f.role]))); setSampleIdx(0); }}>
            {n.name}
          </Button>
        ))}
      </HStack>
      <div className="mapLayout">
        <div>
          {fields.map((f) => (
            <div key={f.name} className="fieldRow">
              <span className="fieldName" title={f.name}>{f.name}</span>
              <Select
                size="sm"
                value={roles[f.name] ?? 'skip'}
                options={ROLE_OPTIONS}
                onChange={(v) => setRoles((r) => ({ ...r, [f.name]: v }))}
                aria-label={`Vai trò của ${f.name}`}
              />
            </div>
          ))}
        </div>
        <Card className="previewCard">
          <span className="previewLabel">Xem trước — mặt trước</span>
          <div className="previewFront" aria-label="Mặt trước">
            <Text>{sentence}</Text>
            {sample.audio && <Badge size="sm"><Icon name="audioWave" /> audio</Badge>}
            {sample.image && <Badge size="sm"><Icon name="image" /> ảnh</Badge>}
          </div>
          <div className="previewBack">
            <span className="previewLabel">Mặt sau</span>
            <span><b>{sample.target}</b> {sample.reading}</span>
            <span>{sample.definition}</span>
            <span className="previewLabel">{sample.sentence}</span>
          </div>
        </Card>
      </div>
      <div className="sampleNav">
        <IconButton size="sm" variant="ghost" aria-label="Thẻ trước" onClick={() => setSampleIdx((i) => Math.max(0, i - 1))}><Icon name="chevronLeft" /></IconButton>
        <Text variant="supporting">{`mẫu ${sampleIdx % samples.length + 1}/${samples.length}`}</Text>
        <IconButton size="sm" variant="ghost" aria-label="Thẻ sau" onClick={() => setSampleIdx((i) => i + 1)}><Icon name="chevronRight" /></IconButton>
        <Button variant="ghost" size="sm" onClick={() => setSampleIdx((i) => i + 1)}><Icon name="rotateCcw" /> mẫu khác</Button>
      </div>
      <Separator />
      <Text variant="supporting" color="secondary">{'Core2k: 2,134 thẻ · target=Expression · front=câu+audio'}</Text>
    </VStack>
  );
}

function RunningStep(): React.JSX.Element {
  return (
    <div className="centerCol">
      <Spinner />
      <Progress value={62} style={{ width: '100%' }} />
      <Text variant="supporting">Đang ghi thẻ… 1,323 / 2,134</Text>
      <Button variant="ghost" size="sm">Hủy</Button>
    </div>
  );
}

function ReportStep(): React.JSX.Element {
  return (
    <VStack gap="3">
      <div className="reportList">
        <div className="reportRow"><HStack gap="2"><Icon name="check" /><Text>Thẻ đã import</Text></HStack><Badge size="sm">2,134</Badge></div>
        <div className="reportRow"><HStack gap="2"><Icon name="x" /><Text>Bỏ qua (tạm dừng)</Text></HStack><Badge size="sm">5</Badge></div>
        <div className="reportRow"><HStack gap="2"><Icon name="x" /><Text>Bỏ qua (cloze)</Text></HStack><Badge size="sm">128</Badge></div>
        <div className="reportRow"><HStack gap="2"><Icon name="image" /><Text>Media</Text></HStack><Badge size="sm">89 ✓ · 2 lỗi</Badge></div>
      </div>
      <Alert variant="default" icon={<Icon name="info" />} description="Lịch học giữ nguyên (ước tính từ interval — file .apkg giữ chính xác 100% FSRS state)." />
    </VStack>
  );
}

const STEP_BODY: Record<Step, () => React.JSX.Element> = {
  source: () => <SourceStep fail={false} />,
  'source-fail': () => <SourceStep fail />,
  scope: ScopeStep,
  language: LanguageStep,
  mapping: MappingStep,
  running: RunningStep,
  report: ReportStep,
};

function Wizard({ step, mobile }: { step: Step; mobile: boolean }): React.JSX.Element {
  const body = (
    <>
      <StepRail step={step} />
      {STEP_BODY[step]()}
    </>
  );
  const footer = step === 'running' ? undefined : step === 'report' ? (
    <>
      <Button variant="ghost">Đóng</Button>
      <Button variant="primary">Học ngay</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" disabled={step === 'source' || step === 'source-fail'}>Quay lại</Button>
      <Button variant="primary">{step === 'mapping' ? 'Bắt đầu import' : 'Tiếp tục'}</Button>
    </>
  );
  if (mobile) {
    return (
      <div className="mobileHost">
        <MobileSheet snap="full" header={<Text variant="label">Import từ Anki</Text>} aria-label="Import từ Anki">
          <VStack gap="3" style={{ paddingBottom: 16 }}>{body}</VStack>
          {footer && <HStack gap="2" style={{ justifyContent: 'flex-end', paddingBottom: 12 }}>{footer}</HStack>}
        </MobileSheet>
      </div>
    );
  }
  return (
    <Dialog open title="Import từ Anki" showCloseButton footer={footer} onOpenChange={() => {}}>
      {body}
    </Dialog>
  );
}

function App(): React.JSX.Element {
  const params = new URLSearchParams(location.search);
  const [step, setStep] = useState<Step>((params.get('step') as Step) || 'mapping');
  const [theme, setTheme] = useState<Theme>((params.get('theme') as Theme) || 'light');
  const [viewport, setViewport] = useState<Viewport>((params.get('viewport') as Viewport) || 'desktop');
  document.documentElement.setAttribute('data-theme', theme);
  return (
    <>
      <div className="switcherBar">
        <label>Bước
          <select value={step} onChange={(e) => setStep(e.target.value as Step)}>
            {STEPS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Theme
          <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            <option value="light">light</option><option value="dark">dark</option>
          </select>
        </label>
        <label>Viewport
          <select value={viewport} onChange={(e) => setViewport(e.target.value as Viewport)}>
            <option value="desktop">desktop</option><option value="mobile">mobile (375)</option>
          </select>
        </label>
      </div>
      <div className="stage">
        <div className="backdrop" style={viewport === 'mobile' ? { width: 375 } : undefined}>
          <div className="backdropTopbar">
            <span className="backdropTitle">Memory</span>
            <HStack gap="1">
              <IconButton variant="ghost" size="sm" aria-label="Import từ Anki" title="Import từ Anki"><Icon name="import" /></IconButton>
              <IconButton variant="ghost" size="sm" aria-label="Cài đặt"><Icon name="settings" /></IconButton>
            </HStack>
          </div>
          <div className="backdropBody">
            <div className="skel w70" /><div className="skel w40" /><div className="skel w55" />
          </div>
          <div className="wizardOverlay">
            <div className="wizardFrame">
              <Wizard step={step} mobile={viewport === 'mobile'} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
