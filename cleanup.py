import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
cred = credentials.Certificate("clgres-firebase-adminsdk-fbsvc-869f328c96.json")
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

def fix_sem5_electives():
    print("--- Starting Semester 5 PE Cleanup (IRS vs NLP) ---")
    
    # Target codes
    IRS_CODE = "22CS27"
    NLP_CODE = "22CS29"
    SEM_ID = "5"

    students_ref = db.collection('students').stream()
    fix_count = 0

    for student_doc in students_ref:
        ht_number = student_doc.id
        sem_ref = db.collection('students').document(ht_number).collection('semesters').document(SEM_ID)
        
        doc = sem_ref.get()
        if not doc.exists:
            continue
            
        data = doc.to_dict()
        subjects = data.get('subjects', [])
        
        # Check if the student has both IRS (Passed/Real) and NLP (Injected F)
        has_irs = any(s.get('code') == IRS_CODE for s in subjects)
        has_nlp = any(s.get('code') == NLP_CODE for s in subjects)

        if has_irs and has_nlp:
            # Filter out the NLP subject because they took IRS instead
            # We only remove it if the grade is 'F' (confirming it was an injection)
            new_subjects = [s for s in subjects if not (s.get('code') == NLP_CODE and s.get('grade') == 'F')]
            
            if len(new_subjects) < len(subjects):
                sem_ref.update({"subjects": new_subjects})
                fix_count += 1
                print(f"✅ Fixed {ht_number}: Removed ghost NLP (Student took IRS)")

    print(f"\n--- Cleanup Finished! Total students fixed: {fix_count} ---")

if __name__ == "__main__":
    fix_sem5_electives()