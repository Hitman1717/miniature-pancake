const BASE_URL = 'https://miniature-pancake-asda.onrender.com';

async function fetchResults() {
    const rollNo = document.getElementById('rollNo').value.trim().toUpperCase();
    const container = document.getElementById('results-container');
    const errorMsg = document.getElementById('error-message');
    
    if (!rollNo) return;

    try {
        const response = await fetch(`${BASE_URL}/results/${rollNo}`);
        if (!response.ok) throw new Error();

        const data = await response.json();
        errorMsg.style.display = 'none';
        container.classList.remove('hidden');

        // Set Profile
        document.getElementById('student-name').innerText = data.fullName;
        document.getElementById('student-roll').innerText = data.rollNo;

        // Show Red Warning if backlogs exist
        const backlogAlert = document.getElementById('backlog-alert');
        if (data.currentBacklogs && data.currentBacklogs.some(b => b !== "")) {
            backlogAlert.classList.remove('hidden');
        } else {
            backlogAlert.classList.add('hidden');
        }

        // Render Semesters
        const grid = document.getElementById('semesters-grid');
        grid.innerHTML = '';

        // Sort semesters keys (sem_1, sem_2...)
        const sortedSems = Object.keys(data.results).sort();

        sortedSems.forEach(semKey => {
            const sem = data.results[semKey];
            const semNum = semKey.split('_')[1];
            
            const card = document.createElement('div');
            card.className = 'sem-card';
            
            let subjectsHtml = sem.subject.map(sub => `
                <div class="sub-row">
                    <span>${sub.name}</span>
                    <span style="color: #888">C:${sub.credit}</span>
                    <span class="${sub.gp === 0 ? 'fail-text' : ''}">${sub.gp === 0 ? 'F' : sub.gp}</span>
                </div>
            `).join('');

            card.innerHTML = `
                <div class="sem-header">
                    <h3>Semester ${semNum}</h3>
                    <span class="sgpa-pill">SGPA: ${sem.sgpa}</span>
                </div>
                <div class="subjects-list">
                    ${subjectsHtml}
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (err) {
        errorMsg.style.display = 'block';
        container.classList.add('hidden');
    }
}