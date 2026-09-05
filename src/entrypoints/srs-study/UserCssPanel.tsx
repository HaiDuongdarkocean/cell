import { useEffect, useState, type ChangeEvent } from 'react';
import { getSrsUserCss, setSrsUserCss } from '@/features/srs/services/userCssStore';
import { Box } from '@/shared/ui/Box';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Textarea } from '@/shared/ui/Textarea';
import styles from './UserCssPanel.module.css';

export function UserCssPanel(): React.JSX.Element {
  const [css, setCss] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getSrsUserCss().then((value) => {
      if (mounted) setCss(value);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const styleId = 'srs-user-css';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = css;
    return () => {
      // keep injected; this only runs on unmount, not between css changes
    };
  }, [css]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    setCss(e.target.value);
    setSaved(false);
  };

  const handleSave = async (): Promise<void> => {
    await setSrsUserCss(css);
    setSaved(true);
  };

  return (
    <Box className={styles.panel}>
      <Text className={styles.title}>Custom CSS</Text>
      <Textarea
        className={styles.textarea}
        value={css}
        onChange={handleChange}
        rows={6}
        placeholder="/* Add your custom CSS here */"
        aria-label="Custom CSS for study page"
      />
      <Button className={styles.save} onClick={() => { void handleSave(); }}>
        {saved ? 'Saved' : 'Save CSS'}
      </Button>
    </Box>
  );
}
