const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
let serviceAccount;
// Check if we are on Render (using the environment variable)
if (process.env.FIREBASE_CONFIG) {
    serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
} else {
    // Check if we are running locally (using the file)
    try {
        serviceAccount = require("./clgres-firebase-adminsdk-fbsvc-869f328c96.json");
    } catch (e) {
        console.error("Firebase config not found! Make sure FIREBASE_CONFIG env var is set on Render.");
        process.exit(1);
    }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json());

/**
 * 2. Get Total Results (All Semesters)
 * Usage: GET /results/22011P0533
 */
app.get('/results/:rollno', async (req, res) => {
    try {
        const rollno = req.params.rollno.toUpperCase();
        
        // Fetch student profile
        const studentDoc = await db.collection('students').doc(rollno).get();
        
        if (!studentDoc.exists) {
            return res.status(404).json({ error: "Student not found" });
        }

        const studentData = studentDoc.data();

        // Fetch all semesters from the subcollection
        const semSnapshot = await db.collection('students').doc(rollno).collection('semesters').get();
        const semesters = {};
        
        semSnapshot.forEach(doc => {
            semesters[`sem_${doc.id}`] = doc.data();
        });

        res.json({
            rollNo: rollno,
            fullName: studentData.fullName,
            currentBacklogs: studentData.current_backlogs,
            results: semesters
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 3. Get Individual Semester Result
 * Usage: GET /results/22011P0533/1
 */
app.get('/results/:rollno/:sem', async (req, res) => {
    try {
        const { rollno, sem } = req.params;
        const rollUpper = rollno.toUpperCase();

        // Access specific semester document
        const semDoc = await db.collection('students')
                                .doc(rollUpper)
                                .collection('semesters')
                                .doc(sem)
                                .get();

        if (!semDoc.exists) {
            return res.status(404).json({ error: `Semester ${sem} results not found for ${rollUpper}` });
        }

        res.json({
            rollNo: rollUpper,
            semester: sem,
            data: semDoc.data()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});