import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type ComponentType,
} from 'react';
import { Input } from './Input';
import { Icon } from '@/shared/icons/Icon';
import styles from './Input.showcase.module.css';

interface SectionHeadProps {
  tag: string;
  title: string;
  desc: string;
}

function SectionHead({ tag, title, desc }: SectionHeadProps): ReactElement {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionTag}>{tag}</span>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionDesc}>{desc}</p>
    </div>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

function Field({ label, children, className }: FieldProps): ReactElement {
  const id = useId();
  const isComponent =
    isValidElement(children) && typeof children.type === 'function';
  const labelledChild = isComponent
    ? cloneElement(
        children as ReactElement<{ id?: string }, ComponentType<{ id?: string }>>,
        { id },
      )
    : children;

  return (
    <div className={[styles.field, className ?? ''].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      {labelledChild}
    </div>
  );
}

interface StateCardProps {
  title: string;
  children: ReactNode;
}

function StateCard({ title, children }: StateCardProps): ReactElement {
  return (
    <div className={styles.stateCard}>
      <span className={styles.stateTitle}>{title}</span>
      {children}
    </div>
  );
}

export function Showcase(): ReactElement {
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('matkhau');
  const [showPassword, setShowPassword] = useState(false);
  const focusRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    focusRef.current?.focus();
  }, []);

  const passwordSuffix = (
    <button
      type="button"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      onClick={() => setShowPassword((v) => !v)}
      className={styles.iconBtn}
    >
      <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
    </button>
  );

  const clearSuffix = value && (
    <button
      type="button"
      aria-label="Clear"
      onClick={() => setValue('')}
      className={styles.iconBtn}
    >
      <Icon name="x" size={18} />
    </button>
  );

  return (
    <div className={styles.page}>
      {/* === States === */}
      <section className={styles.section}>
        <SectionHead
          tag="States"
          title="Trạng thái tương tác"
          desc="Mọi trạng thái đều dùng token glass và nature accents có sẵn."
        />
        <div className={styles.row}>
          <StateCard title="Default">
            <Input
              type="search"
              placeholder="Tìm từ vựng..."
              prefix={<Icon name="search" size={18} />}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Tìm từ vựng"
            />
          </StateCard>
          <StateCard title="Hover">
            <Input value="Hover qua em đi anh" readOnly aria-label="Hover" />
          </StateCard>
          <StateCard title="Focus">
            <Input ref={focusRef} value="Đang focus nè" aria-label="Focus" />
          </StateCard>
        </div>
        <div className={styles.row}>
          <StateCard title="Filled">
            <Input
              type="url"
              value="https://themoviebox.xyz/..."
              prefix={<Icon name="link" size={18} />}
              aria-label="Filled"
            />
          </StateCard>
          <StateCard title="Error">
            <Input
              type="email"
              value="khong-phai-email"
              error
              errorMessage="Email không hợp lệ"
              prefix={<Icon name="alertCircle" size={18} />}
              aria-label="Email lỗi"
            />
          </StateCard>
          <StateCard title="Loading">
            <Input value="Đang tìm kiếm..." loading aria-label="Loading" />
          </StateCard>
        </div>
        <div className={styles.row}>
          <StateCard title="Disabled">
            <Input value="Không chỉnh được" disabled aria-label="Disabled" />
          </StateCard>
          <StateCard title="Read-only">
            <Input value="Chỉ đọc thôi" readOnly aria-label="Read-only" />
          </StateCard>
          <StateCard title="Success">
            <Input
              value="URL hợp lệ"
              success
              suffix={<Icon name="check" size={18} />}
              aria-label="Success"
            />
          </StateCard>
        </div>
      </section>

      {/* === Sizes === */}
      <section className={styles.section}>
        <SectionHead
          tag="Sizes"
          title="Kích thước"
          desc="Small cho filter bar, Medium mặc định, Large cho hero search."
        />
        <div className={styles.row}>
          <Field label="Small — 28px">
            <Input size="sm" placeholder="Filter..." />
          </Field>
          <Field label="Medium — 32px">
            <Input placeholder="Nhập nội dung..." />
          </Field>
          <Field label="Large — 40px">
            <Input
              size="lg"
              placeholder="Dán link video..."
              prefix={<Icon name="search" size={20} />}
            />
          </Field>
        </div>
      </section>

      {/* === Variants === */}
      <section className={styles.section}>
        <SectionHead
          tag="Variants"
          title="Hình dạng & phong cách"
          desc="Glass là mặc định. Filled dùng trên nền phức tạp. Outline cho form nghiêm túc. Ghost cho inline edit."
        />
        <div className={styles.row}>
          <Field label="Glass">
            <Input variant="glass" placeholder="Trong suốt, blur nền" />
          </Field>
          <Field label="Filled">
            <Input variant="filled" placeholder="Nền đục nhẹ" />
          </Field>
          <Field label="Outline">
            <Input variant="outline" placeholder="Viền rõ" />
          </Field>
          <Field label="Ghost">
            <Input variant="ghost" placeholder="Không nền" />
          </Field>
        </div>
      </section>

      {/* === Prefix & Suffix === */}
      <section className={styles.section}>
        <SectionHead
          tag="Patterns"
          title="Prefix & Suffix"
          desc="Các slot cho icon hành động: search, link, password toggle, clear, loading."
        />
        <div className={styles.row}>
          <Field label="Search">
            <Input
              type="search"
              placeholder="Tìm từ..."
              prefix={<Icon name="search" size={18} />}
            />
          </Field>
          <Field label="URL">
            <Input
              type="url"
              placeholder="Dán link video"
              prefix={<Icon name="link" size={18} />}
            />
          </Field>
          <Field label="Password">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              suffix={passwordSuffix}
              aria-label="Password"
            />
          </Field>
          <Field label="Clearable">
            <Input
              placeholder="Giá trị cần xóa"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              suffix={clearSuffix}
            />
          </Field>
        </div>
      </section>

      {/* === Nature accents === */}
      <section className={styles.section}>
        <SectionHead
          tag="Nature palette"
          title="Màu sắc thiên nhiên"
          desc="Bầu trời, nước, cây, sỏi, đất, mặt trời — được dùng làm accent cho từng preset."
        />
        <div className={styles.row}>
          <Field label="Sky / Water" className={styles.sky}>
            <Input placeholder="Focus sẽ là xanh dương" />
          </Field>
          <Field label="Leaf" className={styles.leaf}>
            <Input placeholder="Focus sẽ là xanh lá" />
          </Field>
          <Field label="Earth" className={styles.earth}>
            <Input placeholder="Focus sẽ là nâu đất" />
          </Field>
          <Field label="Sun" className={styles.sun}>
            <Input placeholder="Focus sẽ là vàng nắng" />
          </Field>
        </div>
      </section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Input',
  description: 'Styled text input with sizes (sm, md, lg), variants (glass, filled, outline, ghost), error/success/loading states, and prefix/suffix slots.',
  level: 'atoms',
  category: 'Input',
  group: 'Shared UI — Input',
  order: 20,
};
