import type { NodePath } from '@babel/core';
import type { Expression } from '@babel/types';
import { MacroError, createMacro } from 'babel-plugin-macros';
// @ts-ignore
import postcssJs from 'postcss-js';
import { parse } from 'postcss-scss';

const SEEN = Symbol('css macro seen');
let i = 0;
export default createMacro(({ references, babel, state }) => {
  const { types: t } = babel;

  function buildAst(obj: unknown, placeholders: Map<string, any>): Expression {
    if (Array.isArray(obj)) {
      return t.arrayExpression(obj.map((e) => buildAst(e, placeholders)));
    }
    if (obj && typeof obj === 'object') {
      return t.objectExpression(
        Object.entries(obj).map(([key, value]) => {
          const keyNode = buildAst(key, placeholders);
          return t.objectProperty(
            keyNode,
            buildAst(value, placeholders),
            keyNode.type === 'TemplateLiteral',
          );
        }),
      );
    }
    if (obj == null) {
      return t.nullLiteral();
    }
    if (typeof obj === 'number') {
      return t.numericLiteral(obj);
    }
    if (typeof obj === 'string') {
      // if the placeholder is in a key it will get camel cased so don't
      // match on case
      const parts = obj.split(/(MACRO_PH_\d+)/gim);
      if (parts.length === 1) return t.stringLiteral(obj);

      const quasis = [];
      const expressions = [];

      for (const part of parts) {
        const expr = placeholders.get(part.toUpperCase());
        if (expr) expressions.push(expr);
        else quasis.push(t.templateElement({ raw: part }));
      }

      // if this is `${expr}` then unwrap and
      // return the expression directly
      if (
        expressions.length === 1 &&
        quasis.every((q) => !q.value.raw.trim())
      ) {
        return expressions[0];
      }

      return t.templateLiteral(quasis, expressions);
    }
    // fallback
    return t.stringLiteral(String(obj));
  }

  function buildTemplateString(
    path: NodePath,
    placeholders: Map<string, any>,
    tagName: string,
  ) {
    if (!path.isTaggedTemplateExpression()) {
      throw new MacroError('Must use a tagged template');
    }

    const quasiPath = path.get('quasi');
    const quasi = quasiPath.node;
    const exprPath = quasiPath.get('expressions');

    let text = '';
    // eslint-disable-next-line no-loop-func
    quasi.quasis.forEach((tmplNode, idx) => {
      const { raw } = tmplNode.value;
      const expr = exprPath[idx];

      text += raw;

      if (expr) {
        const evaled = expr.evaluate();

        if (evaled.confident) {
          text += evaled.value;
        } else if (
          expr.isTaggedTemplateExpression() &&
          (expr.get('tag').node as any).name === tagName
        ) {
          text += buildTemplateString(expr, placeholders, tagName);
        } else {
          const ph = `MACRO_PH_${i++}`;
          text += ph;
          placeholders.set(ph, expr.node);
        }
      }
    });

    return text;
  }

  function objectify(path: NodePath) {
    if (!path.isTaggedTemplateExpression()) {
      throw new MacroError('Must use a tagged template');
    }

    const placeholders = new Map<string, any>();
    const tagName = (path.get('tag').node as any).name;
    const text = buildTemplateString(path, placeholders, tagName);

    let root;
    try {
      root = parse(text, { from: state.filename });
    } catch (err: any) {
      throw new MacroError(err);
    }

    const obj = postcssJs.objectify(root);
    // @ts-ignore
    // eslint-disable-next-line no-param-reassign
    path[SEEN] = true;
    return buildAst(obj, placeholders);
  }

  for (let path of references.default) {
    path = path.parentPath!;

    // @ts-ignore
    if (path[SEEN]) {
      continue;
    }

    path.replaceWith(objectify(path));
  }
});
