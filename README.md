# style-convert

A [babel-plugin-macros](https://github.com/kentcdodds/babel-plugin-macros) macro for
converting CSS strings to a JavaScript object notation, popular in CSS-in-JS libraries.
Helpful for libraries that only accept object notation, such as TailwindCSS's component API.

## Usage

```js
import css from 'style-convert/macro';
import theme from './theme';

const styles = css`
  .btn {
    color: red;
    width: ${theme.borderWidth} ${theme.borderColor} solid;
  }
`;
```

becomes:

```js
import theme from './theme';

const styles = {
  '.btn': {
    color: 'red',
    width: `${theme()} 1px solid`,
  },
};
```

### Use with Tailwind API

```js
import css from 'style-convert/macro';
import plugin from 'tailwindcss/plugin';

export default plugin(({ theme, addComponents }) => {
  const components = css`
    .btn {
      color: red;
      width: PLACEHOLDER_1 1px solid;
    }
  `;

  addComponents(components);
});
```
