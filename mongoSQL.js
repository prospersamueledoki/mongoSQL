/**
 * mongoSQL v2 – SQL-like engine over MongoDB (single-file, no deps)
 *
 * Goals
 *  - Parse a practical SQL subset and translate to MongoDB commands/aggregations
 *  - Support: SELECT (WHERE, JOIN, GROUP BY, HAVING, ORDER BY, LIMIT, OFFSET),
 *             INSERT, UPDATE, DELETE
 *  - Parameters: ?, :named
 *  - Transactions: BEGIN/COMMIT/ROLLBACK (Mongo sessions)
 *  - Simple schema registry for collection ↔ table alias and field mapping
 *  - Extensible architecture (add functions, operators, etc.)
 *
 * Not 100% of SQL (that’s enormous and dialect-specific), but covers the bulk of day‑to‑day usage.
 *
 * Usage
 *  const client = new MongoClient(uri);
 *  await client.connect();
 *  const db = client.db('mydb');
 *  const ms = new MongoSQL({ db, client });
 *  ms.registerTable('users', { collection: 'users' });
 *  ms.registerTable('orders', { collection: 'orders', indexes: [{ keys: { userId: 1 } }] });
 *
 *  // SELECT with JOIN + GROUP BY + HAVING
 *  const rows = await ms.query(
 *    `SELECT u._id as userId, u.name, COUNT(o._id) AS orders
 *       FROM users u
 *       LEFT JOIN orders o ON o.userId = u._id
 *      WHERE u.country = :country
 *   GROUP BY u._id, u.name
 *     HAVING COUNT(o._id) > ?
 *   ORDER BY orders DESC
 *      LIMIT 10 OFFSET 0`,
 *    { country: 'NG' }, [3]
 *  );
 *
 *  // INSERT / UPDATE / DELETE
 *  await ms.query("INSERT INTO users (name, country) VALUES (:name, :country)", { name: 'Ada', country: 'NG' });
 *  await ms.query("UPDATE users SET country = 'US' WHERE name LIKE 'A%'");
 *  await ms.query("DELETE FROM users WHERE country = 'US'");
 *
 *  // Transactions
 *  await ms.query('BEGIN');
 *  try {
 *    await ms.query("UPDATE users SET vip = true WHERE _id = :id", { id: someId });
 *    await ms.query('COMMIT');
 *  } catch (e) {
 *    await ms.query('ROLLBACK');
 *    throw e;
 *  }
 */

class MongoSQL {
  constructor({ db, client, logger } = {}) {
    if (!db) throw new Error('MongoSQL requires a MongoDB db handle');
    this.db = db;
    this.client = client; // optional unless you need transactions
    this.logger = logger || ((...args) => {});
    this.tables = new Map();
    this.session = null; // active Mongo ClientSession for transactions
    this.functions = buildBuiltinFunctions();
  }

  /**
   * Register a SQL table name → Mongo collection mapping.
   * options: { collection, view?, indexes?[], fieldMap? }
   */
  registerTable(name, options) {
    if (!options || !options.collection) throw new Error('registerTable requires a collection');
    this.tables.set(name.toLowerCase(), {
      name,
      collection: options.collection,
      view: options.view,
      indexes: options.indexes || [],
      fieldMap: options.fieldMap || {},
    });
  }

  /** Get collection for a table name */
  _getCollection(tableName) {
    const meta = this.tables.get(tableName.toLowerCase());
    if (!meta) throw new Error(`Unknown table: ${tableName}`);
    return this.db.collection(meta.collection);
  }

  /** Ensure indexes declared in registerTable */
  async ensureIndexes() {
    for (const meta of this.tables.values()) {
      const col = this.db.collection(meta.collection);
      for (const idx of meta.indexes) {
        await col.createIndex(idx.keys, idx.options || {});
      }
    }
  }

  /**
   * Main entry: parse SQL, bind params, and execute against MongoDB
   */
  async query(sql, namedParams = {}, positionalParams = []) {
    const tokenizer = new Tokenizer(sql);
    const parser = new Parser(tokenizer);
    const ast = parser.parseStatement();

    const binder = new ParamBinder(namedParams, positionalParams);

    switch (ast.type) {
      case 'BEGIN':
        return this._begin();
      case 'COMMIT':
        return this._commit();
      case 'ROLLBACK':
        return this._rollback();
      case 'INSERT':
        return this._execInsert(ast, binder);
      case 'UPDATE':
        return this._execUpdate(ast, binder);
      case 'DELETE':
        return this._execDelete(ast, binder);
      case 'SELECT':
        return this._execSelect(ast, binder);
      default:
        throw new Error(`Unsupported statement type: ${ast.type}`);
    }
  }

  // ---------------- Transactions ----------------
  async _begin() {
    if (!this.client) throw new Error('BEGIN requires a Mongo client to create sessions');
    if (this.session) throw new Error('Transaction already started');
    this.session = this.client.startSession();
    this.session.startTransaction();
    return { ok: 1, started: true };
  }

  async _commit() {
    if (!this.session) throw new Error('No active transaction');
    await this.session.commitTransaction();
    await this.session.endSession();
    this.session = null;
    return { ok: 1, committed: true };
  }

  async _rollback() {
    if (!this.session) throw new Error('No active transaction');
    await this.session.abortTransaction();
    await this.session.endSession();
    this.session = null;
    return { ok: 1, rolledBack: true };
  }

  // ---------------- DML Executors ----------------
  async _execInsert(ast, binder) {
    const table = ast.into.name;
    const col = this._getCollection(table);

    if (ast.values) {
      // INSERT INTO t (a,b) VALUES (...),(...)
      const docs = ast.values.map(row => {
        const doc = {};
        ast.columns.forEach((c, i) => {
          doc[c.name] = binder.bindValue(row[i]);
        });
        return doc;
      });
      const opts = this.session ? { session: this.session } : {};
      const res = await col.insertMany(docs, opts);
      return { insertedCount: res.insertedCount, insertedIds: res.insertedIds };
    }

    if (ast.select) {
      // INSERT INTO t (a,b) SELECT ...
      const rows = await this._execSelect(ast.select, binder);
      const docs = rows.map(r => {
        const doc = {};
        ast.columns.forEach((c) => {
          doc[c.name] = r[c.alias || c.name];
        });
        return doc;
      });
      const opts = this.session ? { session: this.session } : {};
      const res = await col.insertMany(docs, opts);
      return { insertedCount: res.insertedCount, insertedIds: res.insertedIds };
    }

    throw new Error('INSERT must have VALUES or SELECT');
  }

  async _execUpdate(ast, binder) {
    const table = ast.table.name;
    const col = this._getCollection(table);
    const filter = buildMatch(ast.where, binder, table);
    const update = buildUpdate(ast.set, binder);
    const opts = this.session ? { session: this.session } : {};
    const res = await col.updateMany(filter, update, opts);
    return { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount, upsertedId: res.upsertedId };
  }

  async _execDelete(ast, binder) {
    const table = ast.from.name;
    const col = this._getCollection(table);
    const filter = buildMatch(ast.where, binder, table);
    const opts = this.session ? { session: this.session } : {};
    const res = await col.deleteMany(filter, opts);
    return { deletedCount: res.deletedCount };
  }

  // ---------------- SELECT via Aggregation ----------------
  async _execSelect(ast, binder) {
    // Single table with optional joins
    const main = ast.from;
    const col = this._getCollection(main.name);
    const pipeline = [];

    // WHERE
    if (ast.where) {
      pipeline.push({ $match: buildMatch(ast.where, binder, main.alias || main.name) });
    }

    // JOINS
    for (const j of ast.joins) {
      if (j.type !== 'INNER' && j.type !== 'LEFT') throw new Error(`Unsupported JOIN type: ${j.type}`);
      // Only support simple equality ON a.b = b.c
      const on = j.on;
      if (!on || on.op !== '=' || on.left.type !== 'Field' || on.right.type !== 'Field') {
        throw new Error('JOIN ... ON must be equality between two fields');
      }
      const left = on.left; // { table, name }
      const right = on.right;

      const localField = qualifyField(left, main.alias || main.name);
      const foreignField = qualifyField(right, j.table.alias || j.table.name);

      const lookup = {
        $lookup: {
          from: this._getCollection(j.table.name).collectionName,
          localField: localField.field,
          foreignField: foreignField.field,
          as: j.table.alias || j.table.name,
        },
      };
      pipeline.push(lookup);
      if (j.type === 'INNER') {
        pipeline.push({ $unwind: { path: `$${j.table.alias || j.table.name}`, preserveNullAndEmptyArrays: false } });
      } else {
        pipeline.push({ $unwind: { path: `$${j.table.alias || j.table.name}`, preserveNullAndEmptyArrays: true } });
      }
    }

    // GROUP BY
    if (ast.groupBy && ast.groupBy.length) {
      const idExpr = {};
      for (const g of ast.groupBy) {
        idExpr[projectKey(g)] = toMongoExpr(g, main, ast.joins, binder, this.functions);
      }
      const group = { $group: { _id: idExpr } };

      // Add aggregate projections for SELECT list
      for (const sel of ast.columns) {
        if (sel.expr.type === 'Call' && isAggregate(sel.expr.name)) {
          const key = sel.alias || exprAlias(sel.expr);
          group.$group[key] = toMongoAgg(sel.expr, main, ast.joins, binder);
        }
      }
      pipeline.push(group);

      // HAVING
      if (ast.having) {
        pipeline.push({ $match: buildHaving(ast.having, binder) });
      }

      // Re-project grouped keys to top-level fields
      const project = { $project: {} };
      for (const k of Object.keys(idExpr)) {
        project.$project[k] = `$_id.${k}`;
      }
      for (const sel of ast.columns) {
        if (sel.expr.type === 'Call' && isAggregate(sel.expr.name)) {
          const key = sel.alias || exprAlias(sel.expr);
          project.$project[key] = 1;
        }
        if (sel.expr.type === 'Field' && !ast.groupBy.some(g => eqField(g, sel.expr))) {
          // Non-grouped field in SELECT without aggregation is not allowed in strict SQL.
          // We project only grouped fields and aggregates.
        }
      }
      pipeline.push(project);
    } else {
      // No GROUP BY — simple projection
      const project = { $project: {} };
      if (ast.columns.length === 1 && ast.columns[0].expr.type === 'All') {
        // SELECT *
        // no $project → keep all
      } else {
        for (const sel of ast.columns) {
          const key = sel.alias || exprAlias(sel.expr);
          project.$project[key] = toMongoExpr(sel.expr, main, ast.joins, binder, this.functions);
        }
        pipeline.push(project);
      }
    }

    // ORDER BY
    if (ast.orderBy && ast.orderBy.length) {
      const sort = {};
      for (const ob of ast.orderBy) {
        const key = ob.expr.type === 'Field' ? projectKey(ob.expr) : exprAlias(ob.expr);
        sort[key] = ob.dir === 'DESC' ? -1 : 1;
      }
      pipeline.push({ $sort: sort });
    }

    // OFFSET / LIMIT
    if (Number.isFinite(ast.offset)) pipeline.push({ $skip: ast.offset });
    if (Number.isFinite(ast.limit)) pipeline.push({ $limit: ast.limit });

    // Execute
    const opts = this.session ? { session: this.session } : {};
    const cursor = col.aggregate(pipeline, opts);
    const result = await cursor.toArray();
    return result;
  }
}

// ---------------- Utilities ----------------

function buildUpdate(setList, binder) {
  const $set = {};
  for (const s of setList) {
    $set[s.column.name] = binder.bindValue(s.value);
  }
  return { $set };
}

function buildMatch(expr, binder, defaultTable) {
  if (!expr) return {};
  switch (expr.type) {
    case 'Binary': {
      const left = expr.left;
      const right = expr.right;
      const op = expr.op;
      if (op === 'AND' || op === 'OR') {
        const a = buildMatch(left, binder, defaultTable);
        const b = buildMatch(right, binder, defaultTable);
        return op === 'AND' ? { $and: [a, b] } : { $or: [a, b] };
      }
      if (left.type === 'Field') {
        const key = qualifyField(left, defaultTable).path;
        const val = binder.bindValue(right);
        switch (op) {
          case '=': return { [key]: val };
          case '!=': case '<>': return { [key]: { $ne: val } };
          case '>': return { [key]: { $gt: val } };
          case '>=': return { [key]: { $gte: val } };
          case '<': return { [key]: { $lt: val } };
          case '<=': return { [key]: { $lte: val } };
          case 'IN': return { [key]: { $in: toArray(val) } };
          case 'NOT IN': return { [key]: { $nin: toArray(val) } };
          case 'LIKE': return { [key]: likeToRegex(String(val)) };
          case 'IS':
            if (right.kind === 'NULL') return { [key]: null };
            break;
          case 'IS NOT':
            if (right.kind === 'NULL') return { [key]: { $ne: null } };
            break;
          case 'BETWEEN':
            // encoded as Binary with right = { type:'Between', from, to }
            return { [key]: { $gte: binder.bindValue(right.from), $lte: binder.bindValue(right.to) } };
          default:
            throw new Error(`Unsupported operator in WHERE: ${op}`);
        }
      }
      throw new Error('Unsupported WHERE clause');
    }
    case 'Unary': {
      if (expr.op === 'NOT') {
        const inner = buildMatch(expr.expr, binder, defaultTable);
        return { $nor: [inner] };
      }
      break;
    }
    default:
      throw new Error('Unsupported WHERE expression');
  }
}

function likeToRegex(pattern) {
  // SQL LIKE: % → .*  _ → .
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`);
  const re = '^' + escaped.replace(/%/g, '.*').replace(/_/g, '.') + '$';
  return { $regex: re, $options: 'i' };
}

function toArray(v) { return Array.isArray(v) ? v : [v]; }

function isAggregate(name) {
  return ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(name.toUpperCase());
}

function exprAlias(expr) {
  if (expr.type === 'Field') return projectKey(expr);
  if (expr.type === 'Call') return expr.name.toLowerCase();
  if (expr.type === 'All') return '*';
  return 'expr';
}

function eqField(a, b) {
  return a.type === 'Field' && b.type === 'Field' && (a.table || '').toLowerCase() === (b.table || '').toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();
}

function projectKey(f) {
  if (f.type !== 'Field') return 'expr';
  return (f.alias || f.name);
}

function qualifyField(f, defaultTable) {
  if (f.type !== 'Field') throw new Error('Expected Field');
  const table = f.table || defaultTable;
  const field = f.name;
  const path = table ? `${table}.${field}`.replace(/^[.]/, '') : field;
  return { table, field, path };
}

function toMongoExpr(expr, main, joins, binder, functions) {
  switch (expr.type) {
    case 'Number': return Number(expr.value);
    case 'String': return String(expr.value);
    case 'Boolean': return !!expr.value;
    case 'Param': return binder.bindValue(expr);
    case 'Field': {
      const q = qualifyField(expr, main.alias || main.name);
      return `$${q.path}`;
    }
    case 'All': return '$$ROOT';
    case 'Call': {
      const fn = functions[expr.name.toUpperCase()];
      if (!fn || !fn.expr) throw new Error(`Unknown function: ${expr.name}`);
      const args = expr.args.map(a => toMongoExpr(a, main, joins, binder, functions));
      return fn.expr(args);
    }
    case 'Binary': {
      const left = toMongoExpr(expr.left, main, joins, binder, functions);
      const right = toMongoExpr(expr.right, main, joins, binder, functions);
      switch (expr.op) {
        case '+': return { $add: [left, right] };
        case '-': return { $subtract: [left, right] };
        case '*': return { $multiply: [left, right] };
        case '/': return { $divide: [left, right] };
        default: throw new Error(`Unsupported binary op in projection: ${expr.op}`);
      }
    }
    default:
      throw new Error(`Unsupported expression in projection: ${expr.type}`);
  }
}

function toMongoAgg(callExpr, main, joins, binder) {
  const name = callExpr.name.toUpperCase();
  const arg = callExpr.args[0];
  if (name === 'COUNT') {
    if (!arg || arg.type === 'All') return { $sum: 1 };
    return { $sum: { $cond: [{ $gt: [toMongoExpr(arg, main, joins, binder), null] }, 1, 0] } };
  }
  if (name === 'SUM') return { $sum: toMongoExpr(arg, main, joins, binder) };
  if (name === 'AVG') return { $avg: toMongoExpr(arg, main, joins, binder) };
  if (name === 'MIN') return { $min: toMongoExpr(arg, main, joins, binder) };
  if (name === 'MAX') return { $max: toMongoExpr(arg, main, joins, binder) };
  throw new Error(`Unsupported aggregate ${name}`);
}

function buildHaving(expr, binder) {
  // In grouped docs, aggregates live at top-level, group keys under _id.
  // For simplicity, support comparisons on aggregate aliases or COUNT(*) etc.
  if (expr.type === 'Binary') {
    const op = expr.op;
    const left = expr.left;
    const rightVal = binder.bindValue(expr.right);

    const key = left.type === 'Call' ? left.name.toLowerCase() : (left.type === 'Field' ? projectKey(left) : 'expr');
    const field = key; // projected earlier

    switch (op) {
      case '=': return { [field]: rightVal };
      case '!=': case '<>': return { [field]: { $ne: rightVal } };
      case '>': return { [field]: { $gt: rightVal } };
      case '>=': return { [field]: { $gte: rightVal } };
      case '<': return { [field]: { $lt: rightVal } };
      case '<=': return { [field]: { $lte: rightVal } };
      default: throw new Error('Unsupported HAVING operator');
    }
  }
  throw new Error('Unsupported HAVING');
}

// ---------------- Parameter Binding ----------------
class ParamBinder {
  constructor(named, positional) {
    this.named = named || {};
    this.positional = positional || [];
    this.posIndex = 0;
  }
  bindValue(node) {
    if (!node) return null;
    switch (node.type) {
      case 'Param':
        if (node.mode === 'pos') {
          if (this.posIndex >= this.positional.length) throw new Error('Not enough positional params');
          return this.positional[this.posIndex++];
        } else {
          const v = this.named[node.name];
          if (typeof v === 'undefined') throw new Error(`Missing named param :${node.name}`);
          return v;
        }
      case 'Number': return Number(node.value);
      case 'String': return String(node.value);
      case 'Boolean': return !!node.value;
      case 'Null': return null;
      case 'Array': return node.values.map(v => this.bindValue(v));
      case 'Between': return { from: this.bindValue(node.from), to: this.bindValue(node.to) };
      default: return node.value ?? null;
    }
  }
}

// ---------------- Built-in SQL Functions ----------------
function buildBuiltinFunctions() {
  const fns = {};
  const add = (name, impl) => { fns[name] = impl; };
  // Scalar functions as projection expressions
  add('LOWER', { expr: ([x]) => ({ $toLower: x }) });
  add('UPPER', { expr: ([x]) => ({ $toUpper: x }) });
  add('CONCAT', { expr: (args) => ({ $concat: args }) });
  add('COALESCE', { expr: (args) => ({ $ifNull: [args[0], args[1] ?? null] }) });
  add('ABS', { expr: ([x]) => ({ $abs: x }) });
  add('ROUND', { expr: ([x, d]) => (d != null ? { $round: [x, d] } : { $round: ['$$_internal', 0] }) });
  return fns;
}

// ---------------- Tokenizer & Parser (practical subset) ----------------

class Tokenizer {
  constructor(input) { this.input = input; this.i = 0; this.len = input.length; this.peeked = null; }
  _isSpace(c) { return /\s/.test(c); }
  _isIdentStart(c) { return /[A-Za-z_]/.test(c); }
  _isIdent(c) { return /[A-Za-z0-9_$]/.test(c); }
  _isDigit(c) { return /[0-9]/.test(c); }

  next() {
    if (this.peeked) { const t = this.peeked; this.peeked = null; return t; }
    const s = this.input;
    const n = this.len;
    while (this.i < n && this._isSpace(s[this.i])) this.i++;
    if (this.i >= n) return { type: 'eof' };
    const c = s[this.i];

    // Comments -- and /* */
    if (c === '-' && s[this.i+1] === '-') { while (this.i < n && s[this.i] !== '\n') this.i++; return this.next(); }
    if (c === '/' && s[this.i+1] === '*') { this.i += 2; while (this.i < n && !(s[this.i] === '*' && s[this.i+1] === '/')) this.i++; this.i += 2; return this.next(); }

    // Strings
    if (c === '\'' || c === '"') {
      const quote = c; this.i++; let val = '';
      while (this.i < n) {
        const ch = s[this.i++];
        if (ch === '\\') { val += s[this.i++]; continue; }
        if (ch === quote) break;
        val += ch;
      }
      return { type: 'string', value: val };
    }

    // Numbers
    if (this._isDigit(c)) {
      let j = this.i; while (j < n && (this._isDigit(s[j]) || s[j] === '.')) j++;
      const num = s.slice(this.i, j); this.i = j; return { type: 'number', value: num };
    }

    // Identifiers or keywords or parameters
    if (this._isIdentStart(c)) {
      let j = this.i; while (j < n && this._isIdent(s[j])) j++;
      const word = s.slice(this.i, j); this.i = j;
      return { type: 'ident', value: word };
    }

    // Parameters :name or ?
    if (c === ':') { this.i++; let j = this.i; while (j < n && this._isIdent(s[j])) j++; const name = s.slice(this.i, j); this.i = j; return { type: 'param_named', value: name }; }
    if (c === '?') { this.i++; return { type: 'param_pos' }; }

    // Operators and punctuation
    const two = s.substr(this.i, 2);
    const twoOps = ['>=', '<=', '<>', '!='];
    if (twoOps.includes(two)) { this.i += 2; return { type: 'op', value: two } }

    this.i++;
    const singles = ',().=*+/-<>';
    if (singles.includes(c)) return { type: 'op', value: c };

    throw new Error(`Unexpected character: ${c}`);
  }
  peek() { if (!this.peeked) this.peeked = this.next(); return this.peeked; }
}

class Parser {
  constructor(tokenizer) { this.t = tokenizer; }
  parseStatement() {
    const tok = this._expectIdent();
    const kw = tok.value.toUpperCase();
    switch (kw) {
      case 'SELECT': return this.parseSelect();
      case 'INSERT': return this.parseInsert();
      case 'UPDATE': return this.parseUpdate();
      case 'DELETE': return this.parseDelete();
      case 'BEGIN': return { type: 'BEGIN' };
      case 'COMMIT': return { type: 'COMMIT' };
      case 'ROLLBACK': return { type: 'ROLLBACK' };
      default: throw new Error(`Unsupported statement: ${kw}`);
    }
  }

  // SELECT col [, col] FROM table [alias]
  //   [LEFT|INNER JOIN table [alias] ON a.b = c.d]
  //   [WHERE expr]
  //   [GROUP BY a, b]
  //   [HAVING expr]
  //   [ORDER BY col [ASC|DESC], ...]
  //   [LIMIT n] [OFFSET m]
  parseSelect() {
    const columns = this.parseSelectList();
    this._expectKW('FROM');
    const from = this.parseTableRef();
    const joins = [];
    while (this._tryKW('JOIN') || this._tryKW('INNER JOIN') || this._tryKW('LEFT JOIN') || this._tryKW('LEFT OUTER JOIN')) {
      let type = 'INNER';
      if (this._eatKW('LEFT') || this._eatKW('LEFT OUTER')) type = 'LEFT';
      else if (this._eatKW('INNER')) type = 'INNER';
      else if (this._eatKW('JOIN')) type = 'INNER';
      else this._expectKW('JOIN');
      const table = this.parseTableRef();
      this._expectKW('ON');
      const on = this.parseJoinCondition();
      joins.push({ type, table, on });
    }

    let where = null, groupBy = [], having = null, orderBy = [], limit = null, offset = null;
    if (this._eatKW('WHERE')) where = this.parseExpr();
    if (this._eatKW('GROUP')) { this._expectKW('BY'); groupBy = this.parseFieldList(); }
    if (this._eatKW('HAVING')) having = this.parseExpr();
    if (this._eatKW('ORDER')) { this._expectKW('BY'); orderBy = this.parseOrderByList(); }
    if (this._eatKW('LIMIT')) limit = this.parseNumberLit();
    if (this._eatKW('OFFSET')) offset = this.parseNumberLit();

    return { type: 'SELECT', columns, from, joins, where, groupBy, having, orderBy, limit, offset };
  }

  parseInsert() {
    this._expectKW('INTO');
    const into = this.parseTableRefNoAlias();
    let columns = [];
    if (this._eatOp('(')) { columns = this.parseIdentList().map(n => ({ type: 'Field', name: n })); this._expectOp(')'); }
    if (this._eatKW('VALUES')) {
      const values = [];
      do { this._expectOp('('); values.push(this.parseValueList()); this._expectOp(')'); } while (this._eatOp(','));
      return { type: 'INSERT', into, columns, values };
    }
    if (this._eatKW('SELECT')) {
      const select = this.parseSelectAfterInitial();
      return { type: 'INSERT', into, columns, select };
    }
    throw new Error('INSERT supports VALUES or SELECT');
  }

  parseUpdate() {
    const table = this.parseTableRefNoAlias();
    this._expectKW('SET');
    const set = [];
    do {
      const col = this._expectIdent().value; this._expectOp('=');
      const value = this.parseValue();
      set.push({ column: { type: 'Field', name: col }, value });
    } while (this._eatOp(','));
    let where = null; if (this._eatKW('WHERE')) where = this.parseExpr();
    return { type: 'UPDATE', table, set, where };
  }

  parseDelete() {
    this._expectKW('FROM');
    const from = this.parseTableRefNoAlias();
    let where = null; if (this._eatKW('WHERE')) where = this.parseExpr();
    return { type: 'DELETE', from, where };
  }

  // Helpers
  parseSelectList() {
    const cols = [];
    do {
      cols.push(this.parseSelectItem());
    } while (this._eatOp(','));
    return cols;
  }
  parseSelectAfterInitial() {
    // utility for INSERT ... SELECT where SELECT has already been consumed
    const columns = this.parseSelectList();
    this._expectKW('FROM');
    const from = this.parseTableRef();
    const joins = [];
    while (this._tryKW('JOIN') || this._tryKW('INNER JOIN') || this._tryKW('LEFT JOIN') || this._tryKW('LEFT OUTER JOIN')) {
      let type = 'INNER';
      if (this._eatKW('LEFT') || this._eatKW('LEFT OUTER')) type = 'LEFT';
      else if (this._eatKW('INNER')) type = 'INNER';
      else if (this._eatKW('JOIN')) type = 'INNER';
      else this._expectKW('JOIN');
      const table = this.parseTableRef();
      this._expectKW('ON');
      const on = this.parseJoinCondition();
      joins.push({ type, table, on });
    }
    let where = null, groupBy = [], having = null, orderBy = [], limit = null, offset = null;
    if (this._eatKW('WHERE')) where = this.parseExpr();
    if (this._eatKW('GROUP')) { this._expectKW('BY'); groupBy = this.parseFieldList(); }
    if (this._eatKW('HAVING')) having = this.parseExpr();
    if (this._eatKW('ORDER')) { this._expectKW('BY'); orderBy = this.parseOrderByList(); }
    if (this._eatKW('LIMIT')) limit = this.parseNumberLit();
    if (this._eatKW('OFFSET')) offset = this.parseNumberLit();
    return { type: 'SELECT', columns, from, joins, where, groupBy, having, orderBy, limit, offset };
  }

  parseSelectItem() {
    if (this._eatOp('*')) return { expr: { type: 'All' } };
    const expr = this.parseExpr();
    let alias = null;
    if (this._eatKW('AS')) alias = this._expectIdent().value;
    else if (this._peekIdent()) alias = this._maybeIdent();
    return { expr, alias };
  }

  parseOrderByList() {
    const list = [];
    do {
      const expr = this.parseExpr();
      let dir = 'ASC';
      if (this._eatKW('ASC')) dir = 'ASC'; else if (this._eatKW('DESC')) dir = 'DESC';
      list.push({ expr, dir });
    } while (this._eatOp(','));
    return list;
  }

  parseFieldList() {
    const list = [];
    do { list.push(this.parseField()); } while (this._eatOp(','));
    return list;
  }

  parseJoinCondition() {
    // Only support a.b = c.d style for now
    const left = this.parseField();
    const op = this._expectOp('=');
    const right = this.parseField();
    return { type: 'Binary', op: op.value, left, right };
  }

  parseTableRef() {
    const name = this._expectIdent().value; let alias = null;
    if (this._eatKW('AS')) alias = this._expectIdent().value;
    else if (this._peekIdent()) alias = this._maybeIdent();
    return { type: 'Table', name, alias };
  }
  parseTableRefNoAlias() { const name = this._expectIdent().value; return { type: 'Table', name }; }

  parseField() {
    const a = this._expectIdent().value;
    if (this._eatOp('.')) { const b = this._expectIdent().value; return { type: 'Field', table: a, name: b }; }
    return { type: 'Field', name: a };
  }

  parseExpr() { return this.parseOr(); }
  parseOr() {
    let left = this.parseAnd();
    while (this._eatKW('OR')) { const right = this.parseAnd(); left = { type: 'Binary', op: 'OR', left, right }; }
    return left;
  }
  parseAnd() {
    let left = this.parseNot();
    while (this._eatKW('AND')) { const right = this.parseNot(); left = { type: 'Binary', op: 'AND', left, right }; }
    return left;
  }
  parseNot() {
    if (this._eatKW('NOT')) { const expr = this.parseComparison(); return { type: 'Unary', op: 'NOT', expr }; }
    return this.parseComparison();
  }
  parseComparison() {
    let left = this.parseAdd();
    const next = this.t.peek();
    if (next.type === 'ident') {
      const kw = next.value.toUpperCase();
      if (kw === 'IS') { this.t.next(); if (this._eatKW('NOT')) { this._expectKW('NULL'); return { type: 'Binary', op: 'IS NOT', left, right: { kind: 'NULL' } }; } else { this._expectKW('NULL'); return { type: 'Binary', op: 'IS', left, right: { kind: 'NULL' } }; } }
      if (kw === 'IN') { this.t.next(); this._expectOp('('); const values = []; if (!this._eatOp(')')) { do { values.push(this.parseValue()); } while (this._eatOp(',')); this._expectOp(')'); } return { type: 'Binary', op: 'IN', left, right: { type: 'Array', values } }; }
      if (kw === 'BETWEEN') { this.t.next(); const from = this.parseValue(); this._expectKW('AND'); const to = this.parseValue(); return { type: 'Binary', op: 'BETWEEN', left, right: { type: 'Between', from, to } }; }
      if (kw === 'LIKE') { this.t.next(); const pat = this.parseValue(); return { type: 'Binary', op: 'LIKE', left, right: pat }; }
    }
    const opTok = this.t.peek();
    if (opTok.type === 'op' && ['=', '!=', '<>', '>', '>=', '<', '<='].includes(opTok.value)) { const op = this.t.next().value; const right = this.parseAdd(); return { type: 'Binary', op, left, right }; }
    return left;
  }
  parseAdd() { let left = this.parseMul(); while (true) { const p = this.t.peek(); if (p.type === 'op' && (p.value === '+' || p.value === '-')) { const op = this.t.next().value; const right = this.parseMul(); left = { type: 'Binary', op, left, right }; } else break; } return left; }
  parseMul() { let left = this.parseUnary(); while (true) { const p = this.t.peek(); if (p.type === 'op' && (p.value === '*' || p.value === '/')) { const op = this.t.next().value; const right = this.parseUnary(); left = { type: 'Binary', op, left, right }; } else break; } return left; }
  parseUnary() { if (this._eatOp('-')) { const x = this.parsePrimary(); return { type: 'Call', name: 'NEG', args: [x] }; } return this.parsePrimary(); }
  parsePrimary() {
    const p = this.t.peek();
    if (p.type === 'number') { this.t.next(); return { type: 'Number', value: Number(p.value) }; }
    if (p.type === 'string') { this.t.next(); return { type: 'String', value: p.value }; }
    if (p.type === 'param_pos') { this.t.next(); return { type: 'Param', mode: 'pos' }; }
    if (p.type === 'param_named') { this.t.next(); return { type: 'Param', mode: 'named', name: p.value }; }
    if (p.type === 'ident') {
      const id = this._expectIdent().value; const up = id.toUpperCase();
      if (up === 'NULL') return { type: 'Null' };
      if (up === 'TRUE') return { type: 'Boolean', value: true };
      if (up === 'FALSE') return { type: 'Boolean', value: false };
      if (this._eatOp('(')) { // function call
        const args = []; if (!this._eatOp(')')) { do { args.push(this.parseExpr()); } while (this._eatOp(',')); this._expectOp(')'); }
        return { type: 'Call', name: id, args };
      }
      if (this._eatOp('.')) { const id2 = this._expectIdent().value; return { type: 'Field', table: id, name: id2 }; }
      return { type: 'Field', name: id };
    }
    if (this._eatOp('(')) { const e = this.parseExpr(); this._expectOp(')'); return e; }
    if (this._eatOp('*')) return { type: 'All' };
    throw new Error('Unexpected token in expression');
  }

  parseValue() { const e = this.parsePrimary(); return e; }
  parseValueList() { const vals = []; do { vals.push(this.parseValue()); } while (this._eatOp(',')); return vals; }
  parseIdentList() { const ids = []; do { ids.push(this._expectIdent().value); } while (this._eatOp(',')); return ids; }
  parseNumberLit() { const n = this.t.next(); if (n.type !== 'number') throw new Error('Expected number'); return Number(n.value); }

  // token helpers
  _expectIdent() { const t = this.t.next(); if (t.type !== 'ident') throw new Error('Expected identifier'); return t; }
  _peekIdent() { return this.t.peek().type === 'ident'; }
  _maybeIdent() { const p = this.t.peek(); if (p.type === 'ident') { this.t.next(); return p.value; } return null; }
  _expectKW(kw) { const t = this._expectIdent(); if (t.value.toUpperCase() !== kw.toUpperCase()) throw new Error(`Expected ${kw}`); return t; }
  _eatKW(kw) { const p = this.t.peek(); if (p.type === 'ident' && p.value.toUpperCase() === kw.toUpperCase()) { this.t.next(); return true; } return false; }
  _tryKW(kw) { const p = this.t.peek(); return p.type === 'ident' && p.value.toUpperCase() === kw.toUpperCase(); }
  _expectOp(op) { const t = this.t.next(); if (t.type !== 'op' || t.value !== op) throw new Error(`Expected '${op}'`); return t; }
  _eatOp(op) { const p = this.t.peek(); if (p.type === 'op' && p.value === op) { this.t.next(); return true; } return false; }
  _eatKW2(a,b) { if (this._eatKW(a)) { this._expectKW(b); return true; } return false; }
  _eatKW3(a,b,c) { if (this._eatKW(a)) { this._expectKW(b); this._expectKW(c); return true; } return false; }
}

// Export for Node / ESM
if (typeof module !== 'undefined') module.exports = { MongoSQL };
