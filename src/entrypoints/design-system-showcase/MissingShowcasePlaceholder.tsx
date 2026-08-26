import { Box, Card, Heading, Text } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import styles from './MissingShowcasePlaceholder.module.css';

export interface MissingShowcasePlaceholderProps {
  title: string;
}

export function MissingShowcasePlaceholder({ title }: MissingShowcasePlaceholderProps) {
  return (
    <Box className={styles.root}>
      <Card className={styles.card}>
        <Icon name="info" size={48} className={styles.icon} />
        <Heading level={2} size={3} className={styles.title}>
          {title}
        </Heading>
        <Text color="secondary" className={styles.body}>
          This shared component exists in <code>src/shared/ui/</code> but does not have a
          showcase yet. Add <code>{`${title.replace(/\s+/g, '')}.showcase.tsx`}</code> to
          document its variants, states, and usage.
        </Text>
      </Card>
    </Box>
  );
}
