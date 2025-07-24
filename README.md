    <h1>MongoSQL</h1>
    <p>
        A simplified SQL-like interface for MongoDB, providing basic <strong>SELECT</strong>, <strong>INSERT</strong>, <strong>UPDATE</strong>, and <strong>DELETE</strong> operations with support for <strong>WHERE</strong>, <strong>ORDER BY</strong>, and <strong>LIMIT</strong> clauses. This project aims to offer a more familiar SQL syntax for developers accustomed to relational databases, while still leveraging the power and flexibility of MongoDB.
    </p>

    <hr>

    <h2>Features</h2>
    <ul>
        <li><strong>SQL-like Syntax:</strong> Interact with MongoDB using familiar SQL query structures.</li>
        <li><strong>Basic CRUD Operations:</strong>
            <ul>
                <li><code>SELECT</code>: Retrieve documents with field projection, filtering (WHERE), sorting (ORDER BY), and limiting results (LIMIT).</li>
                <li><code>INSERT INTO</code>: Add new documents to a collection, either by specifying fields and values or by providing a full JSON object.</li>
                <li><code>UPDATE</code>: Modify existing documents based on criteria (WHERE) and set new field values (SET).</li>
                <li><code>DELETE FROM</code>: Remove documents from a collection based on specified conditions (WHERE).</li>
            </ul>
        </li>
        <li><strong>Simple WHERE Clause Parsing:</strong> Supports equality (<code>=</code>), inequality (<code>!=</code>), greater than (<code>&gt;</code>), greater than or equal to (<code>&gt;=</code>), less than (<code>&lt;</code>), less than or equal to (<code>&lt;=</code>), and <code>IN</code> operators. Basic <code>AND</code>/<code>OR</code> combining is also supported for top-level conditions.</li>
        <li><strong>Automatic Type Coercion:</strong> Attempts to convert values in queries to appropriate JavaScript types (numbers, booleans, strings, ObjectIDs, arrays for <code>IN</code>).</li>
    </ul>

    <hr>

    <h2>Limitations</h2>
    <p>
        This <code>MongoSQL</code> implementation is a <strong>basic demonstration</strong> and not a full-fledged SQL parser. It has several limitations:
    </p>
    <ul>
        <li><strong>No Complex WHERE Clauses:</strong> Does not support nested <code>AND</code>/<code>OR</code> groups (e.g., <code>(A AND B) OR C</code>).</li>
        <li><strong>Limited Data Types:</strong> Assumes simple data types for values in queries.</li>
        <li><strong>No Joins or Aggregations:</strong> Does not support SQL JOINs, GROUP BY, or other complex aggregation framework operations.</li>
        <li><strong>No Schema Enforcement:</strong> MongoDB is schemaless, and this tool does not impose or validate any schema.</li>
        <li><strong>Error Handling:</strong> While some basic error handling is in place, it may not catch all malformed queries comprehensively.</li>
        <li><strong>Security:</strong> Not designed for production use in terms of security; direct SQL string parsing can be vulnerable if not carefully handled with untrusted input.</li>
    </ul>

    <hr>

    <h2>Getting Started</h2>

    <h3>Prerequisites</h3>
    <ul>
        <li>Node.js (LTS recommended)</li>
        <li>MongoDB instance (local or remote)</li>
    </ul>

    <h3>Installation</h3>
    <ol>
        <li><strong>Clone the repository (or copy the files):</strong>
            <pre><code>git clone https://github.com/your-username/mongo-sql.git
cd mongo-sql</code></pre>
            <p><em>(If you're just copying <code>mongoSQL.js</code> and <code>app.js</code>, place them in the same directory.)</em></p>
        </li>
        <li><strong>Install dependencies:</strong>
            <pre><code>npm install mongodb</code></pre>
        </li>
    </ol>

    <h3>Configuration</h3>
    <p>Open <code>app.js</code> and update the MongoDB connection details:</p>
    <pre><code>// app.js
const MONGODB_URI = 'mongodb://localhost:27017'; // Your MongoDB connection URI
const DB_NAME = 'myMongoSQLDB'; // The name of your database</code></pre>

    <hr>

    <h2>Usage</h2>

    <h3>Running the Example</h3>
    <p>The <code>app.js</code> file provides a comprehensive example of how to use the <code>MongoSQL</code> class for various operations.</p>
    <p>To run the example:</p>
    <pre><code>node app.js</code></pre>
    <p>You should see output demonstrating connection, data insertion, selection with different criteria, updates, and deletions.</p>

    <h3>Integrating into Your Project</h3>
    <ol>
        <li><strong>Require the <code>MongoSQL</code> class:</strong>
            <pre><code>const MongoSQL = require('./mongoSQL'); // Adjust path as needed</code></pre>
        </li>
        <li><strong>Initialize <code>MongoSQL</code>:</strong>
            <pre><code>const uri = 'mongodb://localhost:27017';
const dbName = 'yourDatabaseName';
const mongoSQL = new MongoSQL(uri, dbName);</code></pre>
        </li>
        <li><strong>Connect to MongoDB:</strong>
            <pre><code>await mongoSQL.connect();
// Now you can execute queries</code></pre>
        </li>
        <li><strong>Execute SQL-like queries:</strong>
            <pre><code>// SELECT
const users = await mongoSQL.query("SELECT * FROM users WHERE age > 25 ORDER BY name ASC LIMIT 10");
console.log(users);

// INSERT
const insertResult = await mongoSQL.query("INSERT INTO products (name, price, category) VALUES ('Laptop', 1200, 'Electronics')");
console.log('Inserted ID:', insertResult.insertedId);

// UPDATE
const updateResult = await mongoSQL.query("UPDATE products SET price = 1150 WHERE name = 'Laptop'");
console.log('Modified count:', updateResult.modifiedCount);

// DELETE
const deleteResult = await mongoSQL.query("DELETE FROM products WHERE category = 'Electronics'");
console.log('Deleted count:', deleteResult.deletedCount);</code></pre>
        </li>
        <li><strong>Disconnect when done:</strong>
            <pre><code>await mongoSQL.disconnect();</code></pre>
        </li>
    </ol>

    <hr>

    <h2>Query Syntax Examples</h2>

    <h3>SELECT</h3>
    <ul>
        <li><strong>Select all fields:</strong>
            <pre><code>SELECT * FROM users</code></pre>
        </li>
        <li><strong>Select specific fields:</strong>
            <pre><code>SELECT name, age FROM users</code></pre>
        </li>
        <li><strong>With WHERE clause:</strong>
            <pre><code>SELECT * FROM users WHERE city = 'New York'
SELECT * FROM products WHERE price > 100 AND category = 'Electronics'
SELECT * FROM orders WHERE status != 'completed' OR total < 50
SELECT * FROM items WHERE tags IN ('electronic', 'gadget')
SELECT * FROM users WHERE _id = '60c72b2f9b1d8f001c8e4d2a' -- Auto-converts to ObjectId</code></pre>
        </li>
        <li><strong>With ORDER BY:</strong>
            <pre><code>SELECT * FROM users ORDER BY age DESC
SELECT name, city FROM users ORDER BY name ASC</code></pre>
        </li>
        <li><strong>With LIMIT:</strong>
            <pre><code>SELECT * FROM users LIMIT 5</code></pre>
        </li>
        <li><strong>Combined:</strong>
            <pre><code>SELECT name, age FROM users WHERE age > 25 ORDER BY age DESC LIMIT 3</code></pre>
        </li>
    </ul>

    <h3>INSERT INTO</h3>
    <ul>
        <li><strong>Specify fields and values:</strong>
            <pre><code>INSERT INTO users (name, age, city) VALUES ('Eve', 29, 'Tokyo')</code></pre>
        </li>
        <li><strong>Provide a JSON object (all fields):</strong>
            <pre><code>INSERT INTO products VALUES ({ "name": "Keyboard", "price": 75, "brand": "Logitech" })</code></pre>
        </li>
    </ul>

    <h3>UPDATE</h3>
    <ul>
        <li><strong>Update with a WHERE clause:</strong>
            <pre><code>UPDATE users SET age = 30, isActive = true WHERE name = 'Eve'
UPDATE products SET price = 80 WHERE brand = 'Logitech'</code></pre>
        </li>
    </ul>

    <h3>DELETE FROM</h3>
    <ul>
        <li><strong>Delete with a WHERE clause:</strong>
            <pre><code>DELETE FROM users WHERE age > 40
DELETE FROM products WHERE category = 'Books' AND price < 20</code></pre>
        </li>
        <li><strong>Delete all documents (use with caution!):</strong>
            <pre><code>DELETE FROM users</code></pre>
        </li>
    </ul>

    <hr>

    <h2>Contributing</h2>
    <p>Contributions are welcome! If you'd like to improve this basic <code>mongoSQL.js</code>
