# Internationalization (i18n) Protocol (v2)

## 1. Core Principles (Invariants)
*   **Zero Strings:** Hardcoded user-facing strings are strictly forbidden. Use Keys only.
*   **English Fallback:** `en-US` is the source of truth. If a key is missing in `es`, fallback to `en` without crashing.
*   **Nested Keys:** Use a deep, logical structure (`auth.login.title`) to avoid collision.

## 2. Workflow (The Translation Cycle)
1.  **Code:** Write components using `t('key')` (phantom keys allowed temporarily).
2.  **Extract:** Run `npm run i18n:extract` to auto-populate `en.json`.
3.  **Translate:** Update value in `en.json` (and other locales).
4.  **Verify:** Check UI to ensure no key drift.

## 3. Directory & Naming
*   **Locales:** `public/locales/[lang]/[namespace].json`.
*   **Config:** `src/i18n/config.ts`.
*   **Standard Names:** `common`, `auth`, `errors`.

## 4. Forbidden Patterns (Strict)
1.  **Dynamic Keys:** `t('menu.' + id)`. **STOP.** Extractors cannot find this. Map explicit keys instead.
2.  **Manual Plurals:** `count > 1 ? 'items' : 'item'`. Use `i18next` pluralization support (`t('key', { count })`).
3.  **HTML Injection:** `dangerouslySetInnerHTML`. Use `<Trans>` component for safe interpolation.

## 5. Golden Example (The Verified View)
```tsx
import { useTranslation } from 'react-i18next';

export const WelcomeHeader = ({ username, count }: { username: string, count: number }) => {
  const { t } = useTranslation('dashboard');

  return (
    <header>
      {/* "Welcome back, {{name}}" */}
      <h1>{t('header.welcome', { name: username })}</h1>
      
      {/* "You have {{count}} notification" (singular/plural handled by library) */}
      <p>{t('header.notifications', { count })}</p>
    </header>
  );
};
```
