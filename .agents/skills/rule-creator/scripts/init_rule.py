#!/usr/bin/env python3
"""
Rule Initializer - Creates a new rule file in the Morphic Framework format.

Usage:
    init_rule.py <rule-name> --trigger <trigger> [--globs <globs>]
"""

import sys
from pathlib import Path

RULE_TEMPLATE = """---
trigger: {trigger}
{globs_field}description: {description}
---

# {rule_title}

## Objective
[Clear statement of what this rule achieves]

## Mandates
- [Mandate 1]
- [Mandate 2]

## Implementation Details
[Specific instructions for the AI]
"""

def title_case(name):
    return ' '.join(word.capitalize() for word in name.replace('_', '-').split('-'))

def main():
    if len(sys.argv) < 4:
        print("Usage: init_rule.py <rule-name> --trigger <trigger> [--globs <globs>]")
        sys.exit(1)

    rule_name = sys.argv[1]
    trigger = sys.argv[3]
    globs = ""
    
    if "--globs" in sys.argv:
        idx = sys.argv.index("--globs")
        globs = sys.argv[idx + 1]

    globs_field = f"globs: {globs}\n" if globs else ""
    
    rule_title = title_case(rule_name)
    content = RULE_TEMPLATE.format(
        trigger=trigger,
        globs_field=globs_field,
        description=f"Standard for {rule_title}",
        rule_title=rule_title
    )

    rules_dir = Path(".agents/rules")
    rules_dir.mkdir(parents=True, exist_ok=True)
    
    rule_file = rules_dir / f"{rule_name}.md"
    rule_file.write_text(content)
    
    print(f"✅ Rule '{rule_name}' created at {rule_file}")

if __name__ == "__main__":
    main()
