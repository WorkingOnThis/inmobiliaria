# Next.js & React Rule Set – Usage Guide

This directory contains **modular rule files (`.mdc`)** that extend AI coding assistants (e.g. Cursor, Windsurf) with Next.js 16 and React 19-specific guidance for different aspects of development.

> **Important:** Do **not** enable _Always On_ for every rule at the same time. Large rule sets increase context size, slow completions and may dilute relevance. Activate only what you need for the task at hand.

---

## 1. Available Rules

| File                           | Purpose                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `nextjs-app-router.mdc`        | App Router patterns, routing, layouts, metadata, and file conventions.                      |
| `nextjs-server-components.mdc` | Server Components vs Client Components, when to use each, and best practices.               |
| `nextjs-data-fetching.mdc`     | Data fetching patterns, Server Actions, API routes, and database integration (Drizzle ORM). |
| `nextjs-optimization.mdc`      | Performance optimizations: Image, Link, fonts, caching, and bundle optimization.            |
| `react-patterns.mdc`           | React 19 patterns, hooks, component composition, and modern React best practices.           |
| `elysia-integration.mdc`       | ElysiaJS integration with Next.js, type-safe APIs, validation, and Eden Treaty client.      |

---

## 2. Applying the Rules

Refer to the **root README** for IDE-specific setup instructions (Cursor, Windsurf). Enable Next.js rules selectively from your IDE's rule panel to avoid excessive context.

---

## 3. Recommended Activation Patterns

| Scenario                   | Recommended Rules                                                       | Notes                                                        |
| -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| Creating new pages/routes  | `nextjs-app-router`, `nextjs-server-components`                         | Focus on routing structure and component type selection.     |
| Implementing data fetching | `nextjs-data-fetching`, `nextjs-server-components`                      | Use Server Components for data fetching when possible.       |
| Building API endpoints     | `elysia-integration`, `nextjs-data-fetching`                            | Use ElysiaJS for type-safe RESTful APIs with validation.     |
| Building interactive UI    | `react-patterns`, `nextjs-server-components`                            | Understand when to use Client Components for interactivity.  |
| Performance optimization   | `nextjs-optimization`, `nextjs-data-fetching`                           | Apply Next.js-specific optimizations and caching strategies. |
| Full feature development   | `nextjs-app-router`, `nextjs-server-components`, `nextjs-data-fetching` | Comprehensive coverage for new features.                     |

---

## 4. Tips for Optimal Use

1. **Be selective** – load only the rules relevant to the current task.
2. **Refresh context** – after finishing a task, disable unneeded rules to avoid stale guidance.
3. **Watch token limits** – each rule consumes context window. Too many rules may truncate code or user prompts.
4. **Iterative enabling** – start with core rules (`nextjs-app-router`, `nextjs-server-components`) and enable others temporarily when you reach their scope.
5. **Keep rules updated** – if you enhance a rule, commit the change and reload it in your IDE.
6. **Know framework limits** – AI assistants may hallucinate APIs; cross-check with actual code and official Next.js/React documentation.

---

## 5. Framework-Specific Notes

This project uses:

- **Next.js 16** with App Router
- **React 19** with React Compiler enabled
- **TypeScript** (see `../typescript/` for TypeScript-specific rules)
- **ElysiaJS** for type-safe API endpoints (see `elysia-integration.mdc`)
- **Drizzle ORM** for database operations
- **Tailwind CSS** for styling

Combine these Next.js rules with TypeScript rules from `../typescript/` for comprehensive guidance.

---

## 6. Feedback & Contributions

Feel free to improve rules or propose new ones. Follow the idioms already present and submit a pull request.
