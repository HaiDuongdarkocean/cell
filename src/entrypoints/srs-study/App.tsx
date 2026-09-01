import { useState } from 'react';
import { Box, Button, Center, Container, Heading, Text } from '@/shared/ui';
import styles from './App.module.css';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <Container maxWidth="md" className={styles.page}>
      <Center className={styles.hero}>
        <Box className={styles.card}>
          <Heading level={1} className={styles.title}>
            Ocean SRS
          </Heading>
          <Text className={styles.subtitle}>
            Spaced repetition for language acquisition. Data is stored locally in
            this browser — uninstalling the extension will delete it.
          </Text>
          <Button
            className={styles.studyButton}
            onClick={() => setCount((c) => c + 1)}
            aria-label="Start study session"
          >
            Study ({count})
          </Button>
        </Box>
      </Center>
    </Container>
  );
}
