const { XPathResult, JSDOM } = require('jsdom')
const wgxpath = require('wgxpath')
const {walkTree} = require('./walk-tree.js')

function evaluateDom(select, ctx, evaluate, query) {
  try {
    //    let $ = cheerio.load(ctx)
    //if(!select.match(/^\/|\*\/|\.\//ig) && select.localeCompare('*') !== 0) { // probably XPath, fall through
    //    return query(select);
    //}
  } catch (e) {
    // TODO: determine any side effects of ignoring
    if (e.name !== 'SyntaxError') {
      console.log(select.localeCompare('*'))
      console.log(select)
      console.log(query)
      throw e
    }
  }

  try {
    if (select.includes('//*')) {
      console.warn(`Possible slow query evaluation due to wildcard: ${select}`)
    }
    // defaults to trying for iterator type
    //   so it can automatically be ordered
    let iterator = evaluate(select, ctx, null,
      wgxpath.XPathResultType.ORDERED_NODE_ITERATOR_TYPE, null)
    //let iterator = evaluate(select, ctx, null, 5, null)
    // TODO: create a pattern regonizer for bodyless while
    let co = []
    let m
    while (m = iterator.iterateNext()) {
      co.push(m.nodeValue || m)
    }
    return co
  } catch (e) {
    if (e.message.includes('Value should be a node-set')
      || e.message.includes('You should have asked')) {
      let result = evaluate(select, ctx, null,
        (XPathResult || {}).ANY_TYPE || 0, null)
      return result.resultType === ((XPathResult || {}).NUMBER_TYPE || 1)
        ? result.numberValue
        : result.resultType === ((XPathResult || {}).STRING_TYPE || 2)
          ? result.stringValue
          : result.resultType === ((XPathResult || {}).BOOLEAN_TYPE || 3)
            ? result.booleanValue
            : result.resultValue
    }
    throw e;
  }
}

// parse as html if it's string,
//   if there is no context convert the tree to html
function selectDom(select, ctx) {
  // let cheerio = require('cheerio');
  if (typeof ctx === 'string') {
    let dom = new JSDOM(ctx);
    wgxpath.install(dom.window, true);
    ctx = dom.window.document;
  }
  let eval = ctx.evaluate || ctx.ownerDocument.evaluate;
  let query = ctx.querySelector.bind(ctx.ownerDocument)
    || ctx.ownerDocument.querySelector.bind(ctx.ownerDocument)
  return walkTree(select, ctx, (select, ctx) => {
    return evaluateDom(select, ctx, eval, query)
  })
}

// TODO: try catch with esquery, vm.runInThisContext, conver and select DOM, and jsel

// from least nuanced to most nuanced, CSS -> XPath -> custom ASTQ
//   Most xpath like //Element will not work on CSS, might have a problem with *
function evaluateQuery(select, ctx) {
  try {
    let esquery = require('esquery');
    // we might have to help out the CSS parser here
    if (!select.match(/^\/\/|\*\/|\.\//ig)) // probably XPath, fall through
      return esquery(ctx, select);
  } catch (e) {
    if (!e.name.includes('SyntaxError')
      && !e.message.includes('Cannot find module')) {
      throw e;
    }
  }

  try {
    let jsel = require('jsel');
    return jsel(ctx).selectAll(select);
  } catch (e) {
    if (!e.message.includes('XPath parse error')
      && !e.message.includes('Unexpected character')
      && !e.message.includes('Cannot find module')) {
      throw e;
    }
  }

  try {
    let ASTQ = require("astq");
    let astq = new ASTQ();
    return astq.query(ctx, select);
  } catch (e) {
    if (!e.message.includes('query parsing failed')) {
      throw e;
    }
  }

  throw new Error(`Could not parse select query ${JSON.stringify(select)} using XPath, CSS, or ASTQ`);
}

function selectTree(select, ctx) {
  // TODO: when converting to html, make sure to only return
  //   matching child objects not their attributes containers
  // TODO: something when we receive a string?
  //   Try to parse with all different selectors?
  return walkTree(select, ctx, evaluateQuery)
}


module.exports = {
  evaluateDom,
  evaluateQuery,
  selectTree,
  selectDom
}