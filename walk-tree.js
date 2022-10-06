
// returns results from multiple queries added together
function walkTree(select, ctx, evaluate) {
  let result;
  if (Array.isArray(select)) {
    result = select.reduce((arr, query, i) => {
      // pass the previous results to the next statement as the context
      if (i > 0) {
        return arr.map(r => walkTree(query, r, evaluate))
      }
      let result = walkTree(query, ctx, evaluate)
      if (typeof result !== 'undefined') {
        if (Array.isArray(result)) {
          return arr.concat(result)
        } else {
          return arr.concat([result])
        }
      }
      return arr
    }, []);
  } else if (typeof select === 'function') {
    // this is just here because it could be
    //   called from the array reduce above
    result = select(ctx);
  } else if (typeof select === 'object') {
    result = Object.keys(select).reduce((obj, prop) => {
      obj[prop] = walkTree(select[prop], ctx, evaluate);
      return obj;
    }, {});
  } else {
    result = evaluate(select, ctx);
  }
  return typeof select === 'string' && Array.isArray(result)
    && result.length <= 1
    ? result[0]
    : result;
}


module.exports = {
  walkTree
}

