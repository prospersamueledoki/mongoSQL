<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MongoSQL - README</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f8fafc; /* Light gray background */
            color: #334155; /* Slate 700 */
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 2rem auto;
            padding: 2rem;
            background-color: #ffffff;
            border-radius: 0.75rem; /* rounded-xl */
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); /* shadow-xl */
        }
        h1, h2, h3, h4, h5, h6 {
            font-weight: 600; /* semibold */
            color: #1e293b; /* Slate 900 */
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
        }
        h1 { font-size: 2.25rem; /* text-4xl */ }
        h2 { font-size: 1.875rem; /* text-3xl */ border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 2rem;}
        h3 { font-size: 1.5rem; /* text-2xl */ }
        h4 { font-size: 1.25rem; /* text-xl */ }

        p {
            margin-bottom: 1rem;
        }
        a {
            color: #2563eb; /* Blue 600 */
            text-decoration: none;
            transition: color 0.2s ease-in-out;
        }
        a:hover {
            color: #1d4ed8; /* Blue 700 */
            text-decoration: underline;
        }
        ul {
            list-style-type: disc;
            margin-left: 1.5rem;
            margin-bottom: 1rem;
        }
        ol {
            list-style-type: decimal;
            margin-left: 1.5rem;
            margin-bottom: 1rem;
        }
        li {
            margin-bottom: 0.5rem;
        }
        code {
            background-color: #e2e8f0; /* Gray 200 */
            padding: 0.2em 0.4em;
            border-radius: 0.375rem; /* rounded-md */
            font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
            font-size: 0.9em;
            color: #334155;
        }
        pre {
            background-color: #1e293b; /* Slate 900 */
            color: #f8fafc; /* Light gray */
            padding: 1rem;
            border-radius: 0.75rem; /* rounded-xl */
            overflow-x: auto;
            margin-bottom: 1.5rem;
            font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
            font-size: 0.875rem; /* text-sm */
            line-height: 1.4;
        }
        pre code {
            background-color: transparent;
            color: inherit;
            padding: 0;
            border-radius: 0;
        }
        hr {
            border: 0;
            border-top: 1px solid #cbd5e1; /* Slate 300 */
            margin: 2rem 0;
        }
    </style>
</head>
<body class="p-4 sm:p-6 md:p-8">
    <div class="container">
        <h1 class="text-center text-slate-900 mb-6">MongoSQL</h1>
        <p class="text-center text-lg text-slate-600 mb-8">
            A simplified SQL-like interface for MongoDB, providing basic <strong>SELECT</strong>, <strong>INSERT</strong>, <strong>UPDATE</strong>, and <strong>DELETE</strong> operations with support for <strong>WHERE</strong>, <strong>ORDER BY</strong>, and <strong>LIMIT</strong> clauses. This project aims to offer a more familiar SQL syntax for developers accustomed to relational databases, while still leveraging the power and flexibility of MongoDB.
        </p>

        <hr>

        <h2 class="text-slate-900">Features</h2>
        <ul class="list-disc pl-6 text-slate-700">
            <li><strong>SQL-like Syntax:</strong> Interact with MongoDB using familiar SQL query structures.</li>
            <li><strong>Basic CRUD Operations:</strong>
                <ul class="list-circle pl-6 mt-2">
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

        <h2 class="text-slate-900">Limitations</h2>
        <p class="text-slate-700">
            This <code>MongoSQL</code> implementation is a <strong>basic demonstration</strong> and not a full-fledged SQL parser. It has several limitations:
        </p>
        <ul class="list-disc pl-6 text-slate-700">
            <li><strong>No Complex WHERE Clauses:</strong> Does not support nested <code>AND</code>/<code>OR</code> groups (e.g., <code>(A AND B) OR C</code>).</li>
            <li><strong>Limited Data Types:</strong> Assumes simple data types for values in queries.</li>
            <li><strong>No Joins or Aggregations:</strong> Does not support SQL JOINs, GROUP BY, or other complex aggregation framework operations.</li>
            <li><strong>No Schema Enforcement:</strong> MongoDB is schemaless, and this tool does not impose or validate any schema.</li>
            <li><strong>Error Handling:</strong> While some basic error handling is in place, it may not catch all malformed queries comprehensively.</li>
            <li><strong>Security:</strong> Not designed for production use in terms of security; direct SQL string parsing can be vulnerable if not carefully handled with untrusted input.</li>
        </ul>

        <hr>

        <h2 class="text-slate-900">Getting Started</h2>

        <h3 class="text-slate-900">Prerequisites</h3>
        <ul class="list-disc pl-6 text-slate-700">
            <li>Node.js (LTS recommended)</li>
            <li>MongoDB instance (local or remote)</li>
        </ul>

        <h3 class="text-slate-900">Installation</h3>
        <ol class="list-decimal pl-6 text-slate-700">
            <li><strong>Clone the repository (or copy the files):</strong>
                <pre><code class="language-bash">git clone https://github.com/your-username/mongo-sql.git
cd mongo-sql</code></pre>
                <p class="text-sm text-slate-500"><em>(If you're just copying <code>mongoSQL.js</code> and <code>app.js</code>, place them in the same directory.)</em></p>
            </li>
            <li><strong>Install dependencies:</strong>
                <pre><code class="language-bash">npm install mongodb</code></pre>
            </li>
        </ol>

        <h3 class="text-slate-900">Configuration</h3>
        <p class="text-slate-700">Open <code>app.js</code> and update the MongoDB connection details:</p>
        <pre><code class="language-javascript">// app.js
const MONGODB_URI = 'mongodb://localhost:27017'; // Your MongoDB connection URI
const DB_NAME = 'myMongoSQLDB'; // The name of your database</code></pre>

        <hr>

        <h2 class="text-slate-900">Usage</h2>

        <h3 class="text-slate-900">Running the Example</h3>
        <p class="text-slate-700">The <code>app.js</code> file provides a comprehensive example of how to use the <code>MongoSQL</code> class for various operations.</p>
        <p class="text-slate-700">To run the example:</p>
        <pre><code class="language-bash">node app.js</code></pre>
        <p class="text-slate-700">You should see output demonstrating connection, data insertion, selection with different criteria, updates, and deletions.</p>

        <h3 class="text-slate-900">Integrating into Your Project</h3>
        <ol class="list-decimal pl-6 text-slate-700">
            <li><strong>Require the <code>MongoSQL</code> class:</strong>
                <pre><code class="language-javascript">const MongoSQL = require('./mongoSQL'); // Adjust path as needed</code></pre>
            </li>
            <li><strong>Initialize <code>MongoSQL</code>:</strong>
                <pre><code class="language-javascript">const uri = 'mongodb://localhost:27017';
const dbName = 'yourDatabaseName';
const mongoSQL = new MongoSQL(uri, dbName);</code></pre>
            </li>
            <li><strong>Connect to MongoDB:</strong>
                <pre><code class="language-javascript">await mongoSQL.connect();
// Now you can execute queries</code></pre>
            </li>
            <li><strong>Execute SQL-like queries:</strong>
                <pre><code class="language-javascript">// SELECT
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
                <pre><code class="language-javascript">await mongoSQL.disconnect();</code></pre>
            </li>
        </ol>

        <hr>

        <h2 class="text-slate-900">Query Syntax Examples</h2>

        <h3 class="text-slate-900">SELECT</h3>
        <ul class="list-disc pl-6 text-slate-700">
            <li><strong>Select all fields:</strong>
                <pre><code class="language-sql">SELECT * FROM users</code></pre>
            </li>
            <li><strong>Select specific fields:</strong>
                <pre><code class="language-sql">SELECT name, age FROM users</code></pre>
            </li>
            <li><strong>With WHERE clause:</strong>
                <pre><code class="language-sql">SELECT * FROM users WHERE city = 'New York'
SELECT * FROM products WHERE price > 100 AND category = 'Electronics'
SELECT * FROM orders WHERE status != 'completed' OR total < 50
SELECT * FROM items WHERE tags IN ('electronic', 'gadget')
SELECT * FROM users WHERE _id = '60c72b2f9b1d8f001c8e4d2a' -- Auto-converts to ObjectId</code></pre>
            </li>
            <li><strong>With ORDER BY:</strong>
                <pre><code class="language-sql">SELECT * FROM users ORDER BY age DESC
SELECT name, city FROM users ORDER BY name ASC</code></pre>
            </li>
            <li><strong>With LIMIT:</strong>
                <pre><code class="language-sql">SELECT * FROM users LIMIT 5</code></pre>
            </li>
            <li><strong>Combined:</strong>
                <pre><code class="language-sql">SELECT name, age FROM users WHERE age > 25 ORDER BY age DESC LIMIT 3</code></pre>
            </li>
        </ul>

        <h3 class="text-slate-900">INSERT INTO</h3>
        <ul class="list-disc pl-6 text-slate-700">
            <li><strong>Specify fields and values:</strong>
                <pre><code class="language-sql">INSERT INTO users (name, age, city) VALUES ('Eve', 29, 'Tokyo')</code></pre>
            </li>
            <li><strong>Provide a JSON object (all fields):</strong>
                <pre><code class="language-sql">INSERT INTO products VALUES ({ "name": "Keyboard", "price": 75, "brand": "Logitech" })</code></pre>
            </li>
        </ul>

        <h3 class="text-slate-900">UPDATE</h3>
        <ul class="list-disc pl-6 text-slate-700">
            <li><strong>Update with a WHERE clause:</strong>
                <pre><code class="language-sql">UPDATE users SET age = 30, isActive = true WHERE name = 'Eve'
UPDATE products SET price = 80 WHERE brand = 'Logitech'</code></pre>
            </li>
        </ul>

        <h3 class="text-slate-900">DELETE FROM</h3>
        <ul class="list-disc pl-6 text-slate-700">
            <li><strong>Delete with a WHERE clause:</strong>
                <pre><code class="language-sql">DELETE FROM users WHERE age > 40
DELETE FROM products WHERE category = 'Books' AND price < 20</code></pre>
            </li>
            <li><strong>Delete all documents (use with caution!):</strong>
                <pre><code class="language-sql">DELETE FROM users</code></pre>
            </li>
        </ul>

        <hr>

        <h2 class="text-slate-900">Contributing</h2>
        <p class="text-slate-700">Contributions are welcome! If you'd like to improve this basic <code>MongoSQL</code> implementation, consider:</p>
        <ul class="list-disc pl-6 text-slate-700">
            <li>Enhancing the SQL parsing logic for more complex queries.</li>
            <li>Adding support for more MongoDB operators (<code>$regex</code>, <code>$exists</code>, etc.).</li>
            <li>Implementing aggregation framework commands (e.g., <code>GROUP BY</code>, <code>JOIN</code> simulations).</li>
            <li>Improving error handling and validation.</li>
        </ul>

        <hr>

        <h2 class="text-slate-900">License</h2>
        <p class="text-slate-700">This project is open-source and available under the <a href="LICENSE" class="text-blue-600 hover:text-blue-700">MIT License</a>. <em>(You'd typically create a <code>LICENSE</code> file in your repository with the full text.)</em></p>
    </div>
</body>
</html>
