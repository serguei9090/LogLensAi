# UI Architecture Standards (Global)

## 1. Core Principles (Invariants)
* **Presentation Only:** `packages/ui` NEVER imports `packages/core`. No business logic, no API calls, no persistence. Data enters via props.
* **Token Truth:** Source of Truth is **Style Dictionary (JSON)**. Generated output is Read-Only.
* **Public API:** Deep imports prohibited (e.g., `import X from 'ui/atoms/X'`). Import only from root: `@{scope}/ui`.
* **Platform Split:**
    * Web/Desktop: `*.tsx` (No React Native imports).
    * Native: `*.native.tsx` (No `react-dom`/HTML imports).
    * Shared logic: Use `*.ts` or strict interface abstraction.
    * Entry Points: `index.ts` (Web), `index.native.ts` (Native).

## 2. Workflow (Component Classification)
1.  **Is it a single block?** -> **Atom**.
2.  **Does it mix Atoms?** -> **Molecule**.
3.  **Does it have Logic/Layout?** -> **Organism**.
4.  **Is it a Page Skeleton?** -> **Template**.
5.  **Does it Fetch Data?** -> **Page**.

## 3. Atomic Hierarchy (packages/ui)
**2.0 Tokens** (`/tokens`):
    *   `src/**/*.json`: **Source of Truth** (Raw Design Values).
    *   `dist/`: **Generated** (TS/CSS outputs via Style Dictionary).
**2.1 Atoms** (`/atoms`): Smallest blocks (Button, Icon). No external margins. Props in/UI out.
**2.2 Molecules** (`/molecules`): Compositions of atoms (SearchInput). No business logic.
**2.3 Organisms** (`/organisms`): Complex sections (Header, LoginForm). Internal layout allowed. No data fetching.
**2.4 Templates** (`/templates`): Layout skeletons (DashboardLayout). Slots/children only.
**2.5 Pages** (`apps/*/pages`): **State Owners.** Data fetching, `core` hooks, and wiring happen here.

## 4. File Standards
Path: `packages/ui/src/[type]/[Name]/`
* `[Name].tsx` (Web implementation)
* `[Name].native.tsx` (Native implementation - Optional)
* `[Name].types.ts` (Prop interfaces - Required)
* `[Name].styles.ts` (Styles using Generated Tokens - Required)
* `index.ts` (Web Public API - Required)
* `index.native.ts` (Mobile Public API - Required)

## 5. Forbidden Patterns (Strict)
1.  **Logic Leak:** `useEffect(() => fetch('/api'))` inside `packages/ui`.
2.  **Style Drift:** `backgroundColor: '#ff0000'` (Must use `tokens.colors.danger`).
3.  **Layout Pollution:** Atoms defining `margin` (Layout belongs to parent/Molecules).
4.  **Cross-Pollution:** Importing `react-native` in a `.tsx` file or `react-dom` in `.native.tsx`.
5.  **Polluted Entry:** Exporting Native components in `index.ts` (Web Entry) or Web components in `index.native.ts` (Native Entry).

## 6. Golden Example (The Ideal Molecule)
```tsx
// packages/ui/src/molecules/SearchInput/SearchInput.tsx
import React, { useState } from 'react';
import { View, TextInput } from 'react-native'; // Or 'react-dom' divs depends on platform
import { Button } from '../../atoms/Button';
import { tokens } from '../../tokens/dist/js/tokens'; // Generated Imports
import { SearchInputProps } from './SearchInput.types';

export const SearchInput = ({ onSearch, placeholder }: SearchInputProps) => {
  const [query, setQuery] = useState('');

  // PURE UI LOGIC ONLY. No useEffect(fetch).
  const handleSubmit = () => {
    if (query.length > 0) onSearch(query);
  };

  return (
    <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
      <TextInput 
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        style={{ borderColor: tokens.colors.primary, borderWidth: 1 }}
      />
      <Button onPress={handleSubmit} label="Go" />
    </View>
  );
};
```