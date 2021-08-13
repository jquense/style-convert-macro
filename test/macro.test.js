import {
  prettierFormatter,
  unstringSnapshotSerializer,
} from 'babel-plugin-tester';
import plugin from 'babel-plugin-macros';
import { transform } from '@babel/core';

expect.addSnapshotSerializer(unstringSnapshotSerializer);

describe('macro', () => {
  function run(str) {
    const { code } = transform(str, {
      plugins: [plugin],
      filename: __filename,
    });

    return prettierFormatter(code, { filename: __filename });
  }
  it('should work', () => {
    const code = run(
      `
        import css from '../src/macro'
  
        const styles = css\`
          .btn,
          .other-btn {
            --theme-color: blue;

            color: red \${theme('blue', 'var(--theme-color)')};
          }

          @media (max-width: 200px) {
            .btn {
              width: 30px;
            }
          }
          @media (max-width: 200px) {
            .other-btn {
              width: 30px;
            }
          }
        \`
      `,
    );

    expect(code).toMatchInlineSnapshot(`
'use strict';

const styles = {
  '.btn,\\n          .other-btn': {
    '--theme-color': 'blue',
    'color': \`red \${theme('blue', 'var(--theme-color)')}\`,
  },
  '@media (max-width: 200px)': [
    {
      '.btn': {
        width: '30px',
      },
    },
    {
      '.other-btn': {
        width: '30px',
      },
    },
  ],
};

`);
  });
});
