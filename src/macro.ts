import { Expression } from '@babel/types';
import { MacroError, createMacro } from 'babel-plugin-macros';
// @ts-ignore
import postcssJs from 'postcss-js';
import { parse } from 'postcss-scss';

let i = 0;
export default createMacro(({ references, babel, state }) => {
  const { types: t } = babel;

  function buildAst(obj: unknown, placeholders: Map<string, any>): Expression {
    if (Array.isArray(obj)) {
      return t.arrayExpression(obj.map((e) => buildAst(e, placeholders)));
    }
    if (obj && typeof obj === 'object') {
      return t.objectExpression(
        Object.entries(obj).map(([key, value]) =>
          t.objectProperty(
            t.stringLiteral(key),
            buildAst(value, placeholders),
          ),
        ),
      );
    }
    if (obj == null) {
      return t.nullLiteral();
    }
    if (typeof obj === 'number') {
      return t.numericLiteral(obj);
    }
    if (typeof obj === 'string') {
      const parts = obj.split(/(MACRO_PH_\d+)/gm);
      if (parts.length === 1) return t.stringLiteral(obj);

      const quasis = [];
      const expressions = [];
      for (const part of parts) {
        const expr = placeholders.get(part);
        if (expr) expressions.push(expr);
        else quasis.push(t.templateElement({ raw: part }));
      }
      return t.templateLiteral(quasis, expressions);
    }
    // fallback
    return t.stringLiteral(String(obj));
  }

  for (let path of references.default) {
    path = path.parentPath!;
    if (!path.isTaggedTemplateExpression()) {
      throw new MacroError('Must use a tagged template');
    }

    const quasiPath = path.get('quasi');
    const quasi = quasiPath.node;
    const exprPath = quasiPath.get('expressions');

    const placeholders = new Map<string, any>();
    let text = '';
    // eslint-disable-next-line no-loop-func
    quasi.quasis.forEach((tmplNode, idx) => {
      const { raw } = tmplNode.value;
      const expr = exprPath[idx];

      text += raw;

      if (expr) {
        const ph = `MACRO_PH_${i++}`;
        text += ph;
        placeholders.set(ph, expr.node);
      }
    });

    const root = parse(text, { from: state.filename });
    const obj = postcssJs.objectify(root);

    path.replaceWith(buildAst(obj, placeholders));
  }
});
