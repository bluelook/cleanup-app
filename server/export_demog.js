const mysql = require("mysql2");
const fs = require("fs");
const { format } = require("fast-csv");

const dbConfig = require("./dbConfig"); // ✅ Import the config file

// ✅ Create MySQL connection using imported config
const db = mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database
});

// ✅ Query the `movements` table
const query = "SELECT * FROM demographics ORDER BY timestamp";

db.query(query, (err, results) => {
    if (err) {
        console.error("Failed to fetch data:", err);
        db.end();
        return;
    }

    console.log(`Fetched ${results.length} records. Writing to CSV...`);

    // ✅ Create a writable stream to `movements.csv`
    const ws = fs.createWriteStream("demographics.csv");
    
    // ✅ Define CSV headers
    const csvStream = format({ headers: true });

    // ✅ Pipe data to CSV file
    csvStream.pipe(ws).on("finish", () => {
        console.log("CSV file successfully written as demographics.csv");
        db.end(); // ✅ Close database connection
    });

    // ✅ Write each row to the CSV file
    results.forEach(row => csvStream.write(row));

    // ✅ Close the stream
    csvStream.end();
});
