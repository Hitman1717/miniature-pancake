const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

let serviceAccount;
if (process.env.FIREBASE_CONFIG) {
    serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
} else {
    try {
        serviceAccount = require("./clgres-firebase-adminsdk-fbsvc-869f328c96.json");
    } catch (e) {
        console.error("Firebase config not found!");
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

// Helper function to calculate SGPA
const calculateSGPA = (subjects, benchmarkCredits) => {
    if (!subjects || subjects.length === 0) return 0;
    
    let totalPoints = 0;
    // We check if the student has any 'F' or 'AB' grades
    const hasFailed = subjects.some(s => s.grade === 'F' || s.grade === 'AB');
    
    // If they have a backlog, JNTUH rules usually mean SGPA is 0.00 until cleared
    if (hasFailed) return 0.00;

    subjects.forEach(sub => {
        totalPoints += (parseFloat(sub.gp) * parseFloat(sub.credit));
    });

    // We divide by benchmarkCredits (from topper) to account for internal fails
    const divisor = benchmarkCredits || subjects.reduce((acc, s) => acc + s.credit, 0);
    return divisor > 0 ? parseFloat((totalPoints / divisor).toFixed(2)) : 0;
};

/**
 * 1. Get Total Results (Now with Real-Time SGPA/CGPA Math)
 */
app.get('/results/:rollno', async (req, res) => {
    try {
        const rollno = req.params.rollno.toUpperCase();
        const studentDoc = await db.collection('students').doc(rollno).get();
        
        if (!studentDoc.exists) {
            return res.status(404).json({ error: "Student not found" });
        }

        const studentData = studentDoc.data();
        const semSnapshot = await db.collection('students').doc(rollno).collection('semesters').get();
        
        let results = {};
        let totalWeightedPoints = 0;
        let totalCumulativeCredits = 0;

        semSnapshot.forEach(doc => {
            const data = doc.data();
            const subjects = data.subjects || []; // Note: changed from 'subject' to 'subjects' to match new DB
            const benchmark = data.benchmarked_credits || 0;

            const sgpa = calculateSGPA(subjects, benchmark);
            
            // Prepare the semester object for your frontend
            results[`sem_${doc.id}`] = {
                ...data,
                sgpa: sgpa,
                // Match your old UI's expected 'subject' field if necessary
                subject: subjects 
            };

            // Prep for CGPA (Only count credits if they passed the whole sem)
            if (sgpa > 0) {
                subjects.forEach(s => {
                    totalWeightedPoints += (parseFloat(s.gp) * parseFloat(s.credit));
                    totalCumulativeCredits += parseFloat(s.credit);
                });
            }
        });

        const cgpa = totalCumulativeCredits > 0 ? (totalWeightedPoints / totalCumulativeCredits).toFixed(2) : "0.00";

        res.json({
            rollNo: rollno,
            fullName: studentData.fullName,
            currentBacklogs: studentData.current_backlogs || [],
            cgpa: cgpa, // New field your UI can use
            results: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 2. Get Individual Semester Result (Updated for new DB fields)
 */
app.get('/results/:rollno/:sem', async (req, res) => {
    try {
        const { rollno, sem } = req.params;
        const rollUpper = rollno.toUpperCase();

        const semDoc = await db.collection('students').doc(rollUpper).collection('semesters').doc(sem).get();

        if (!semDoc.exists) {
            return res.status(404).json({ error: `Semester ${sem} not found` });
        }

        const data = semDoc.data();
        const subjects = data.subjects || [];
        const benchmark = data.benchmarked_credits || 0;

        res.json({
            rollNo: rollUpper,
            semester: sem,
            data: {
                ...data,
                sgpa: calculateSGPA(subjects, benchmark),
                subject: subjects
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});