const express = require('express');
const admin = require('firebase-admin');

// 1. Initialize Firebase with your service account
const serviceAccount = require("./clgres-firebase-adminsdk-fbsvc-869f328c96.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
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