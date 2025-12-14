# TypeScript Rule Set – Usage Guide

This directory contains **modular rule files (`.mdc`)** that extend AI coding assistants (e.g. Cursor, Windsurf) with TypeScript-specific guidance for different aspects of development.

> **Important:** Do **not** enable _Always On_ for every rule at the same time. Large rule sets increase context size, slow completions and may dilute relevance. Activate only what you need for the task at hand.

---

## 1. Available Rules

| File                                       | Purpose                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `typescript-coding.mdc`                    | General coding guidelines, error handling, async patterns, CI checks, etc.                   |
| `typescript-documentation.mdc`             | TypeScript/JSDoc documentation standards and best practices.                                 |
| `typescript-performance.mdc`               | Performance optimization techniques, profiling tools, and monitoring for Node.js/TypeScript. |
| `typescript-security-patterns-rules_v1.mdc` | 🚧 Security patterns and secure coding practices for TypeScript.                             |

---

## 2. Applying the Rules

Refer to the **root README** for IDE-specific setup instructions (Cursor, Windsurf). Enable TypeScript rules selectively from your IDE's rule panel to avoid excessive context.

---

## 3. Recommended Activation Patterns

| Scenario                      | Recommended Rules                                          | Notes                                                             |
| ----------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Implementing a new feature    | `typescript-coding`, `typescript-security-patterns-rules_v1` | Activate documentation rules when writing public APIs.            |
| Writing/Updating docs         | `typescript-documentation`, `typescript-coding`            | Focus on JSDoc standards and code organization.                   |
| Creating or refactoring tests | `typescript-coding`                                        | Use TypeScript best practices for testing patterns.               |
| Security review               | `typescript-security-patterns-rules_v1`, `typescript-coding` | Combine with coding guidelines for comprehensive security checks. |
| Performance optimization      | `typescript-performance`, `typescript-coding`              | Use profiling tools and optimization techniques.                  |

---

## 4. Tips for Optimal Use

1. **Be selective** – load only the rules relevant to the current task.
2. **Refresh context** – after finishing a task, disable unneeded rules to avoid stale guidance.
3. **Watch token limits** – each rule consumes context window. Too many rules may truncate code or user prompts.
4. **Iterative enabling** – start with core rules (`typescript-coding`, `typescript-security-patterns-rules_v1`) and enable others temporarily when you reach their scope.
5. **Keep rules updated** – if you enhance a rule, commit the change and reload it in your IDE.
6. **Know agent limits** – AI assistants may hallucinate APIs; cross-check with actual code and official TypeScript/Node.js documentation.

---

## 5. Feedback & Contributions

Feel free to improve rules or propose new ones. Follow the idioms already present and submit a pull request.
