import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// NOTE: eslint-config-next 是 eslintrc 旧格式，与 flat config + ESLint 9 不兼容
// Next.js 项目的 Core Web Vitals 规则待 Next 16+ 稳定 flat config 支持后再接入
// 目前仅启用 typescript-eslint strict + stylistic；基础覆盖够用
//
// 12 项目级自定义规则的位置占位（参见 .42cog/spec/spec-coding.md §16）：
//   no-accusatory-language / no-total-score / no-confidence-selfeval /
//   no-frozen-field-update / no-raw-text-log / no-missing-user-filter /
//   no-marketing-automation / no-direct-llm-fetch / no-direct-db-instance /
//   no-pages-router / no-random-id-for-business / no-time-in-logic
// 实装放在 eslint-rules/ 目录后改 import
// 规则清单（参见 .42cog/spec/spec-coding.md §16）：
//   no-accusatory-language / no-total-score / no-confidence-selfeval /
//   no-frozen-field-update / no-raw-text-log / no-missing-user-filter /
//   no-marketing-automation / no-direct-llm-fetch / no-direct-db-instance /
//   no-pages-router / no-random-id-for-business / no-time-in-logic

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.42plugin/**',
      '.42cog/**',
      'origin/**',
      'dist/**',
      'build/**',
      'lib/db/migrations/**',
      'prompts/**',
      'notes/**',
      'docs/**',
      'src/**',
      'source/**',
      'chats/**',
      'logs/**',
      '*.config.mjs',
      '*.config.ts',
      '*.config.js',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@ai-sdk/openai',
              message: '禁止在 lib/ai/client.ts 之外 import；统一走 lib/ai/client',
            },
            {
              name: 'bcrypt',
              message: '应用代码不得直连 bcrypt；密码由 Better Auth 托管',
            },
            {
              name: 'next/router',
              message: '禁用 Pages Router；使用 next/navigation',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['lib/ai/client.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['lib/auth.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // CLI 脚本允许 console.log；它们是非生产路径
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // lib/env.ts 需要 console.warn 报告占位；放行
    files: ['lib/env.ts'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // 契约测用 pg Client RETURNING 拿新行 id，rows[0]! 是必然存在的；
    // 全部加守卫会把测试文件撑爆。单独放行 non-null 断言。
    files: ['tests/contract/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
