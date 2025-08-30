// example.js
//
// Demo of using MongoSQL (sql→mongodb engine)
// Make sure you run `npm install mongodb`
// And set MONGO_URI in your environment before running:
//    export MONGO_URI="mongodb://localhost:27017/testdb"
//    node example.js
//

const { MongoClient } = require("mongodb");
const { MongoSQL } = require("./mongoSQLv2"); // adjust to your actual filename

async function main() {
  const client = new MongoClient(process.env.MONGO_URI || "mongodb://localhost:27017");
  await client.connect();
  const db = client.db("testdb");

  const ms = new MongoSQL({ db, client });

  // Register tables (SQL names → Mongo collections)
  ms.registerTable("users", { collection: "users" });
  ms.registerTable("orders", { collection: "orders" });

  // Seed some test data
  await db.collection("users").deleteMany({});
  await db.collection("orders").deleteMany({});
  const [aliceId, bobId] = await Promise.all([
    db.collection("users").insertOne({ name: "Alice", country: "NG" }).then(r => r.insertedId),
    db.collection("users").insertOne({ name: "Bob", country: "NG" }).then(r => r.insertedId),
  ]);
  await db.collection("orders").insertMany([
    { userId: aliceId, total: 50 },
    { userId: aliceId, total: 120 },
    { userId: bobId, total: 75 },
  ]);

  // --- Queries ---

  console.log("\n1. Simple SELECT with WHERE and params:");
  const users = await ms.query("SELECT * FROM users WHERE country = :country", { country: "NG" });
  console.log(users);

  console.log("\n2. JOIN + GROUP BY + HAVING:");
  const stats = await ms.query(
    `
    SELECT u._id AS userId, u.name, COUNT(o._id) AS orders, SUM(o.total) AS spent
      FROM users u
      LEFT JOIN orders o ON u._id = o.userId
     GROUP BY u._id, u.name
    HAVING SUM(o.total) > :minSpent
     ORDER BY spent DESC
     LIMIT 5
    `,
    { minSpent: 60 }
  );
  console.log(stats);

  console.log("\n3. INSERT with named params:");
  await ms.query("INSERT INTO users (name, country) VALUES (:name, :country)", {
    name: "Charlie",
    country: "GH",
  });
  console.log(await db.collection("users").find({}).toArray());

  console.log("\n4. UPDATE with condition:");
  await ms.query("UPDATE users SET country = 'US' WHERE name = 'Charlie'");
  console.log(await db.collection("users").find({ name: "Charlie" }).toArray());

  console.log("\n5. DELETE with WHERE:");
  await ms.query("DELETE FROM users WHERE country = 'US'");
  console.log(await db.collection("users").find({}).toArray());

  // --- Transactions ---
  console.log("\n6. Transaction demo:");
  await ms.query("BEGIN");
  await ms.query("INSERT INTO users (name, country) VALUES ('TxUser1', 'NG')");
  await ms.query("INSERT INTO users (name, country) VALUES ('TxUser2', 'NG')");
  console.log("Before rollback:", await db.collection("users").find({ name: /^Tx/ }).toArray());
  await ms.query("ROLLBACK");
  console.log("After rollback:", await db.collection("users").find({ name: /^Tx/ }).toArray());

  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
