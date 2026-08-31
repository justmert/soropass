import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

function BrandMark() {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        background: '#3969D9',
        color: '#F2F4F8',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 11a2 2 0 0 0-2 2c0 2 0 4-1 6" />
        <path d="M12 7a6 6 0 0 0-6 6c0 1 0 2-.5 3.5" />
        <path d="M12 7a6 6 0 0 1 6 6c0 1.5-.3 3-.8 4" />
        <path d="M12 11a2 2 0 0 1 2 2c0 2 .3 3.5 1 5" />
        <path d="M9 4.5a8 8 0 0 1 9 1.5" />
      </svg>
    </span>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: (
        <>
          <BrandMark />
          {appName}
        </>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
