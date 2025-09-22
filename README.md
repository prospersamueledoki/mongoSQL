# MongoSQL

A simplified SQL-like interface for MongoDB, providing familiar **SELECT**, **INSERT**, **UPDATE**, and **DELETE** operations with support for **WHERE**, **ORDER BY**, **LIMIT**, **JOIN**, **GROUP BY**, and **HAVING**.  
This project helps developers accustomed to SQL work seamlessly with MongoDB.

---

## ✨ Features
- **SQL-like Syntax:** Interact with MongoDB using SQL query strings.
- **CRUD Operations:**
  - `SELECT`: Projection, filtering (`WHERE`), sorting (`ORDER BY`), pagination (`LIMIT`/`OFFSET`).
  - `INSERT INTO`: Add new documents (fields/values or JSON object).
  - `UPDATE`: Modify documents (`SET`, `WHERE`).
  - `DELETE FROM`: Remove documents (`WHERE`).
- **JOIN Support:** Perform `LEFT JOIN` across collections.
- **WHERE Clause Parsing:** Handles `=`, `!=`, `<`, `<=`, `>`, `>=`, `IN`, plus simple `AND`/`OR`.
- **GROUP BY + HAVING:** Aggregate queries with filtering on aggregate results.
- **Transactions:** Supports `BEGIN`, `COMMIT`, and `ROLLBACK`.
- **Automatic Type Casting:** Converts values to numbers, booleans, ObjectIds, etc.

---

## ⚠️ Limitations
- No complex nested `AND`/`OR` groups (e.g. `(A AND B) OR C`).
- No joins beyond simple `LEFT JOIN`.
- No full aggregation pipeline (e.g., `GROUP BY ROLLUP`, window functions).
- No schema enforcement — MongoDB remains schemaless.
- Not production-hardened for SQL injection. Avoid passing untrusted raw SQL.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (LTS recommended)
- MongoDB instance (local or remote)
- `npm install mongodb`

### Installation
```bash
git clone https://github.com/prospersamueledoki/mongoSQL.git
cd mongoSQL
npm install
```
### Useage

```Js
const { MongoClient } = require("mongodb");
const { MongoSQL } = require("./mongoSQLv2");

async function main() {
  const client = new MongoClient("mongodb://localhost:27017");
  await client.connect();
  const db = client.db("mydb");

  const ms = new MongoSQL({ db, client });

  // Register tables
  ms.registerTable("users", { collection: "users" });
  ms.registerTable("orders", { 
    collection: "orders",
    indexes: [{ keys: { userId: 1 } }]  // optional index hints
  });

  // SELECT with JOIN + GROUP BY + HAVING
  const rows = await ms.query(
    `SELECT u._id as userId, u.name, COUNT(o._id) AS orders
       FROM users u
       LEFT JOIN orders o ON o.userId = u._id
      WHERE u.country = :country
   GROUP BY u._id, u.name
     HAVING COUNT(o._id) > ?
   ORDER BY orders DESC
      LIMIT 10 OFFSET 0`,
    { country: "NG" }, [3]
  );
  console.log(rows);

  // INSERT / UPDATE / DELETE
  await ms.query("INSERT INTO users (name, country) VALUES (:name, :country)", { name: "Ada", country: "NG" });
  await ms.query("UPDATE users SET country = 'US' WHERE name LIKE 'A%'");
  await ms.query("DELETE FROM users WHERE country = 'US'");

  // Transactions
  await ms.query("BEGIN");
  try {
    await ms.query("UPDATE users SET vip = true WHERE _id = :id", { id: someId });
    await ms.query("COMMIT");
  } catch (e) {
    await ms.query("ROLLBACK");
    throw e;
  }

  await client.close();
}

main();
```

### 🛠️ Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you’d like to change.

### 📜 License

MIT License.
Developed by Splendid Edge Technologies.
install
