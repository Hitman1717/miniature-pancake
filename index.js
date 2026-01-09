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
        const studentRef = db.collection('students').doc(rollno);
        const [studentDoc, semSnapshot] = await Promise.all([
            studentRef.get(),
            studentRef.collection('semesters').get()
        ]);

        if (semSnapshot.empty) {
            return res.status(404).json({ error: "Student not found" });
        }

        const studentData = studentDoc.exists ? studentDoc.data() : { fullName: "Student " + rollno };
        const results = {};
        const backlogs = []; // This will store the string array of backlog codes
        
        let totalWeightedPoints = 0;
        let totalCumulativeCredits = 0;

        semSnapshot.forEach(doc => {
            const data = doc.data();
            const subjects = data.subjects || [];
            const benchmark = data.benchmarked_credits || 0;

            // Identify backlogs in this semester
            subjects.forEach(sub => {
                if (sub.grade === 'F' || sub.grade === 'AB') {
                    backlogs.push(sub.code); // Adding code to the string array
                }
            });

            const sgpa = calculateSGPA(subjects, benchmark);
            const status = subjects.some(s => s.grade === 'F' || s.grade === 'AB') ? "FAIL" : "PASS";

            results[`sem_${doc.id}`] = {
                semester: doc.id,
                status: status,
                sgpa: sgpa,
                credits: subjects.reduce((acc, s) => acc + (s.grade !== 'F' && s.grade !== 'AB' ? s.credit : 0), 0),
                subjects: subjects
            };

            // CGPA calculation (only include points if passed the subject)
            subjects.forEach(s => {
                if (s.grade !== 'F' && s.grade !== 'AB') {
                    totalWeightedPoints += (parseFloat(s.gp) * parseFloat(s.credit));
                    totalCumulativeCredits += parseFloat(s.credit);
                }
            });
        });

        const cgpa = totalCumulativeCredits > 0 ? (totalWeightedPoints / totalCumulativeCredits).toFixed(2) : "0.00";

        res.json({
            rollNo: rollno,
            fullName: studentData.fullName,
            backlogs: backlogs, // String array: ["22CS29", "22M01", ...]
            cgpa: cgpa,
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