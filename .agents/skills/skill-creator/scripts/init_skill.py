#!/usr/bin/env python3
"""
Skill Initializer - Creates a new skill from template for the Morphic Framework.

Usage:
    init_skill.py <skill-name> --path <path>
"""

import sys
from pathlib import Path


SKILL_TEMPLATE = """---
name: {skill_name}
description: [TODO: Provide a high-signal trigger description. Include WHAT the skill does and WHEN to use it.]
---

# {skill_title}

## Overview

[TODO: 1-2 sentences explaining what this skill enables in the Morphic Framework]

## Operational Workflow

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Implementation Standards

- [Constraint 1]
- [Constraint 2]

## Resources

- **scripts/**: Executable automation (Python/Bash)
- **references/**: Detailed documentation or schemas
- **assets/**: Templates and boilerplate files
"""

EXAMPLE_SCRIPT = '''#!/usr/bin/env python3
"""
Example helper script for {skill_name}
"""

def main():
    print("This is an example script for {skill_name}")

if __name__ == "__main__":
    main()
'''

def title_case_skill_name(skill_name):
    """Convert hyphenated skill name to Title Case for display."""
    return ' '.join(word.capitalize() for word in skill_name.split('-'))


def init_skill(skill_name, path):
    """
    Initialize a new skill directory with template SKILL.md.
    """
    skill_dir = Path(path).resolve() / skill_name

    if skill_dir.exists():
        print(f"❌ Error: Skill directory already exists: {skill_dir}")
        return None

    try:
        skill_dir.mkdir(parents=True, exist_ok=False)
        (skill_dir / 'scripts').mkdir(exist_ok=True)
        (skill_dir / 'references').mkdir(exist_ok=True)
        (skill_dir / 'assets').mkdir(exist_ok=True)

        # Create SKILL.md
        skill_title = title_case_skill_name(skill_name)
        (skill_dir / 'SKILL.md').write_text(SKILL_TEMPLATE.format(skill_name=skill_name, skill_title=skill_title))

        # Create Example Script
        (skill_dir / 'scripts' / 'helper.py').write_text(EXAMPLE_SCRIPT.format(skill_name=skill_name))

        print(f"✅ Skill '{skill_name}' initialized successfully at {skill_dir}")
        return skill_dir
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def main():
    if len(sys.argv) < 4 or sys.argv[2] != '--path':
        print("Usage: init_skill.py <skill-name> --path <path>")
        sys.exit(1)

    skill_name = sys.argv[1]
    path = sys.argv[3]
    init_skill(skill_name, path)


if __name__ == "__main__":
    main()
