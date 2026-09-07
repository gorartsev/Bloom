/* ЭТО НЕ РАНТАЙМ CLAUDE DESIGN. Это минимальный шим, чтобы открыть любой
   *.dc.html в браузере локально и померить его: контраст, тап-таргеты, обрезку.
   В самом канвасе доски рендерит настоящий рантайм, этот файл туда не попадает.

   Умеет ровно то, что используют наши доски: {{...}} в тексте и атрибутах,
   <sc-for list as>, <sc-if value>, onClick, класс DCLogic с state/setState/renderVals.

   Как прогнать: python3 -m http.server 8901 из папки design, дальше открыть
   http://localhost:8901/Main.dc.html или прогнать плейврайтом. */
(function () {
  window.DCLogic = class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) { Object.assign(this.state, patch); window.__dcRender(); }
    renderVals() { return {}; }
  };

  const get = (vals, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), vals);

  function subst(str, vals, scope) {
    return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, expr) => {
      let v = scope && Object.prototype.hasOwnProperty.call(scope, expr.split('.')[0])
        ? get(scope, expr) : get(vals, expr);
      if (typeof v === 'function') return '__FN__';
      return v == null ? '' : String(v);
    });
  }

  function fnFor(str, vals, scope) {
    const m = str.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    if (!m) return null;
    const expr = m[1];
    let v = scope && Object.prototype.hasOwnProperty.call(scope, expr.split('.')[0])
      ? get(scope, expr) : get(vals, expr);
    return typeof v === 'function' ? v : null;
  }

  // атрибуты самого узла: walk обходит только детей, поэтому клоны из sc-for
  // надо прогонять отдельно, иначе {{bg}} и onClick на них остаются сырыми
  function applyAttrs(n, vals, scope) {
    if (n.nodeType !== 1) return;
    for (const attr of Array.from(n.attributes)) {
      if (attr.name === 'onclick') {
        const f = fnFor(attr.value, vals, scope);
        n.removeAttribute('onclick');
        if (f) n.addEventListener('click', f);
        continue;
      }
      if (attr.value.includes('{{')) n.setAttribute(attr.name, subst(attr.value, vals, scope));
    }
  }

  function walk(node, vals, scope) {
    const kids = Array.from(node.childNodes);
    for (const n of kids) {
      if (n.nodeType === 3) {
        if (n.nodeValue.includes('{{')) n.nodeValue = subst(n.nodeValue, vals, scope);
        continue;
      }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toLowerCase();

      if (tag === 'sc-for') {
        const listExpr = (n.getAttribute('list') || '').replace(/[{}\s]/g, '');
        const as = n.getAttribute('as') || 'item';
        const list = get(vals, listExpr) || [];
        const frag = document.createDocumentFragment();
        for (const item of list) {
          const inner = Object.assign({}, scope, { [as]: item });
          for (const child of Array.from(n.children)) {
            const c = child.cloneNode(true);
            applyAttrs(c, vals, inner);
            walk(c, vals, inner);
            frag.appendChild(c);
          }
        }
        n.replaceWith(frag);
        continue;
      }

      if (tag === 'sc-if') {
        const vExpr = (n.getAttribute('value') || '').replace(/[{}\s]/g, '');
        const on = scope && Object.prototype.hasOwnProperty.call(scope, vExpr.split('.')[0])
          ? get(scope, vExpr) : get(vals, vExpr);
        if (on) {
          const frag = document.createDocumentFragment();
          for (const child of Array.from(n.children)) {
            const c = child.cloneNode(true);
            applyAttrs(c, vals, scope);
            walk(c, vals, scope);
            frag.appendChild(c);
          }
          n.replaceWith(frag);
        } else n.remove();
        continue;
      }

      applyAttrs(n, vals, scope);
      walk(n, vals, scope);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const src = document.querySelector('x-dc');
    const helmet = src.querySelector('helmet');
    if (helmet) {
      for (const el of Array.from(helmet.children)) document.head.appendChild(el.cloneNode(true));
      helmet.remove();
    }
    const tpl = src.innerHTML;
    // class Component живёт в глобальной лексической области, а не на window
    const Comp = window.Component || (0, eval)('Component');
    const inst = new Comp({});
    const host = document.createElement('div');
    document.body.appendChild(host);
    src.remove();
    window.__dcRender = () => {
      host.innerHTML = tpl;
      walk(host, inst.renderVals(), null);
    };
    window.__dcRender();
  });
})();
