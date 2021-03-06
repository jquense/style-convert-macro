import { transform } from '@babel/core';
import plugin from 'babel-plugin-macros';
import {
  prettierFormatter,
  unstringSnapshotSerializer,
} from 'babel-plugin-tester';

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

  it('should not add unnecessary strings', () => {
    const code = run(
      `
        import css from '../src/macro'
  
        const styles = css\`
          .btn {
            color: \${theme('blue', 'var(--theme-color)')};
          }

        \`
      `,
    );

    expect(code).toMatchInlineSnapshot(`
'use strict';

const styles = {
  '.btn': {
    color: theme('blue', 'var(--theme-color)'),
  },
};

`);
  });

  it('should handle rule body', () => {
    const code = run(
      `
        import css from '../src/macro'
  
        const styles = css\`
          color: \${color};
          background: \${bgColor};
          border: 1px solid transparent;
          border-color: \${bgColor};
      
          &:hover {
            filter: brightness(85%);
          }
      
          &:disabled,
          &:global(.disabled) {
            color: \${color};
            background: \${bgColor};
            border-color: \${bgColor};
          }
      
          // IDK but this is how bootstrap structures the state precendence, so copying
          &:not(:disabled):not(:global(.disabled)):active,
          &:not(:disabled):not(:global(.disabled)).active {
            filter: brightness(75%);
          }
        \`
      `,
    );

    expect(code).toMatchInlineSnapshot(`
'use strict';

const styles = {
  'color': color,
  'background': bgColor,
  'border': '1px solid transparent',
  'borderColor': bgColor,
  '&:hover': {
    filter: 'brightness(85%)',
  },
  '&:disabled,\\n          &:global(.disabled)': {
    color: color,
    background: bgColor,
    borderColor: bgColor,
  },
  '&:not(:disabled):not(:global(.disabled)):active,\\n          &:not(:disabled):not(:global(.disabled)).active':
    {
      filter: 'brightness(75%)',
    },
};

`);
  });

  it('should handle interpolation in properties', () => {
    const code = run(
      `
        import css from '../src/macro'
        import color from 'colors'
        const styles = css\`
          .btn {
            @apply background-\${color};

            background\${color}: red;
            background-\${color}: red;
          }
        \`
      `,
    );

    expect(code).toMatchInlineSnapshot(`
'use strict';

var _colors = _interopRequireDefault(require('colors'));

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

const styles = {
  '.btn': {
    [\`@apply background-\${_colors.default}\`]: 'true',
    [\`background\${_colors.default}\`]: 'red',
    [\`background\${_colors.default}\`]: 'red',
  },
};

`);
  });

  it('should statically eval', () => {
    const code = run(
      `
        import css from '../src/macro'
        const color = 'color';
        const styles = css\`
          .btn {
            @apply background-\${color};

            background\${color}: red;
            background-\${color}: red;
          }
        \`
      `,
    );

    expect(code).toMatchInlineSnapshot(`
'use strict';

const color = 'color';
const styles = {
  '.btn': {
    '@apply background-color': 'true',
    'backgroundcolor': 'red',
    'backgroundColor': 'red',
  },
};

`);
  });

  it('should handle nested marcos', () => {
    const code = run(
      `
        import css from '../src/macro'
  
        const styles = css\`
          .btn {
            color: red;

            $\{css\`
              @supports (color: red) {
                height: 10px;
              }
            \`}
          }

        \`
      `,
    );

    expect(code).toMatchInlineSnapshot(`
'use strict';

const styles = {
  '.btn': {
    'color': 'red',
    '@supports (color: red)': {
      height: '10px',
    },
  },
};

`);
  });
});
