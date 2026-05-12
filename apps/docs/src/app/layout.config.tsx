import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
       <img src="/docs/emfont-logo-light.svg" alt="emfont 官方文件" style={{ height: "1.5rem", marginLeft: ".5rem" }} />
        {/* emfont 官方文件 */}
      </>
    ),
  },
  links: [
    {
      text: '首頁',
      url: '/docs',
      active: 'nested-url',
    }
  ],
};
