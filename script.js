// Initial User Data
const USER_PROVIDED_STUDENTS = [
    "ABHIJITH B", "ABHINAV REJI", "ABHINAV S", "ABHISHEK S", "ABY T JOSEPH",
    "ADARSH ANIL", "ADHITHYA KRISHNAN", "ADHVITH KRISHNA", "ADITHYAN S", "ADITHYAN V",
    "AJITH A", "AJITH P SAJI", "AKSHAYDAS KS", "ADWAITHRS", "ALAN KURIAKOSE",
    "ALBIN SUNIL", "ALEN SHАЛ", "ALFIN PHILIP", "AMAL A M", "ANANDHA KRISHNA VS",
    "ANANDHU KRISHNAPS", "ANTO GEORGE", "ARAVIND V ANIL", "ARUN U", "ASHIK NIZAR",
    "ASWIN V GOPINATH", "ASWIN.A.R", "ATHISH PRASEED", "ATHUL KRISHNA V S", "BILAL RAFI",
    "DEVADATHAN V VISHNU", "FAISAL JABBAR M M", "JANVIN CIJU", "JIBIN VINCE", "JINS KURIAN",
    "KANNAN CM", "KANNAN T.R", "KIRAN RAVEENDRAN", "MADHAV M SHAJI", "MARSHAL TOMY",
    "MATHEW JAMES", "MEHBIN HALEEL", "MUHAMMAD KHAIS. M", "NANDHANA ANEESH", "NIKHIL A",
    "PRANAV PRADEEP", "PRANAV T PRADEEP", "REVATHY MADHU", "SHARON ANTONY", "SOORYAMSU RAMACHANDRAN",
    "THOMAS V RAJU", "VIJESH E V", "VYSHAKH Κ Κ", "ABHIJITH ABHILASH", "ALBIN JAMES",
    "ALEN RIJO", "AMAN ASHARAF", "ANAND KRISHNA", "ANAND KRISHNANV", "ARJUN K PRAVEEN",
    "HADI THASNEEM K.Η", "JOHN AUGUSTINE JOSEPH", "JOHNS P.J", "MUHAMMED HISHAAM",
    "RAVIKIRAN R NAIR", "SREERUDRAN PL", "V S AJESH"
];

const STORAGE_KEY = 'zenith_attendance_data';

// Default State
let state = {
    classes: [],
    attendance: {}, // { classId: { studentId: 'present' | 'absent' | 'late' } }
    currentView: 'dashboard',
    selectedClassId: null
};

// DOM Elements
const app = document.getElementById('app');

// Init
function init() {
    loadData();
    render();

    // Auto-connect hardware if IP exists
    if (hwState.ip) {
        checkHardwareStatus();
    }
}

function checkHardwareStatus() {
    if (!hwState.ip) return;

    fetch(`http://${hwState.ip}/status`)
        .then(res => res.json())
        .then(data => {
            hwState.isConnected = true;
            document.getElementById('hw-status-badge').textContent = 'Scanner Online';
            document.getElementById('hw-status-badge').style.background = 'var(--status-present)';
            document.getElementById('hw-ip-display').textContent = `(${hwState.ip})`;
            startPolling();
        })
        .catch(err => {
            console.warn("Hardware not reached on startup.");
            hwState.isConnected = false;
        });
}

// Data Persistence
function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        const parsed = JSON.parse(saved);
        state.classes = parsed.classes || [];
        state.attendance = parsed.attendance || {};
    } else {
        // Init with Default Class
        const defaultClassId = Date.now();
        state.classes = [{
            id: defaultClassId,
            name: 'Class A (User List)',
            time: '09:00 AM',
            students: USER_PROVIDED_STUDENTS.map((name, i) => ({ id: i + 1, name }))
        }];

        // Init Attendance for default class
        state.attendance[defaultClassId] = state.classes[0].students.map(s => ({
            id: s.id,
            name: s.name,
            status: 'present'
        }));

        saveData();
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        classes: state.classes,
        attendance: state.attendance
    }));
}

// Router/Renderer
function render() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';

    if (state.currentView === 'dashboard') {
        renderDashboard(mainContent);
    } else if (state.currentView === 'class') {
        renderClassView(mainContent);
    } else if (state.currentView === 'reports') {
        renderReports(mainContent);
    }
}

// Views
function renderDashboard(container) {
    const section = document.createElement('div');
    section.className = 'fade-in';

    section.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items:flex-end; margin-bottom: 2rem">
            <div>
                <h1>Good Morning, Professor</h1>
                <p style="color: var(--text-muted)">Select a class to mark attendance for today.</p>
            </div>
            <button class="btn" onclick="openModal('add-class-modal')">+ New Class</button>
        </div>
        <div class="dashboard-grid" id="course-grid"></div>
    `;

    const grid = section.querySelector('#course-grid');

    if (state.classes.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted)">No classes found. Create one to get started.</p>`;
    }

    state.classes.forEach(course => {
        const card = document.createElement('div');
        card.className = 'glass-panel course-card';
        card.onclick = () => selectClass(course.id);
        card.innerHTML = `
            <div class="course-time">${course.time}</div>
            <h2 class="course-title">${course.name}</h2>
            <div class="course-meta">
                <span>${course.students.length} Students</span>
                <div style="
                    width: 32px; height: 32px; 
                    border-radius: 50%; 
                    background: rgba(255,255,255,0.1);
                    display: flex; align-items: center; justify-content: center;
                ">→</div>
            </div>
        `;
        grid.appendChild(card);
    });

    container.appendChild(section);
}

function renderClassView(container) {
    const course = state.classes.find(c => c.id === state.selectedClassId);
    if (!course) return navigate('dashboard');

    if (!state.attendance[course.id]) {
        state.attendance[course.id] = course.students.map(s => ({ ...s, status: 'present' }));
    }

    const students = state.attendance[course.id];

    const stats = {
        present: students.filter(s => s.status === 'present').length,
        absent: students.filter(s => s.status === 'absent').length,
        late: students.filter(s => s.status === 'late').length,
    };

    const section = document.createElement('div');
    section.className = 'fade-in';

    section.innerHTML = `
        <div class="view-header">
            <button class="btn btn-secondary" onclick="navigate('dashboard')">← Back to Dashboard</button>
            <div style="display: flex; gap: 1rem">
                <button class="btn btn-secondary" onclick="exportCSV()">Export CSV</button>
                 <button class="btn btn-secondary" onclick="openModal('manage-students-modal')">Manage Students</button>
                <button class="btn btn-danger" onclick="markAll('absent')">Mark All Absent</button>
                <button class="btn" onclick="markAll('present')">Mark All Present</button>
            </div>
        </div>

        <div class="glass-panel stats-panel">
            <div class="stat-item">
                <div class="stat-value" style="color: var(--status-present)">${stats.present}</div>
                <div class="stat-label">Present</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: var(--status-absent)">${stats.absent}</div>
                <div class="stat-label">Absent</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: var(--status-late)">${stats.late}</div>
                <div class="stat-label">Late</div>
            </div>
        </div>

        <div class="student-list" id="student-list"></div>
    `;

    const list = section.querySelector('#student-list');
    students.forEach(student => {
        const row = document.createElement('div');
        row.className = 'glass-panel student-row';
        row.dataset.status = student.status;
        row.onclick = () => toggleStatus(student.id);

        row.innerHTML = `
            <div class="student-info">
                <div class="student-avatar">${student.name.charAt(0)}</div>
                <div style="display: flex; flex-direction: column; align-items: flex-start;">
                    <span style="font-size: 1.1rem">${student.name}</span>
                    <button class="btn-text" onclick="editStudentName(event, ${student.id})">Edit Name</button>
                </div>
            </div>
            <div class="status-badge ${student.status}">
                ${student.status}
            </div>
        `;
        list.appendChild(row);
    });

    container.appendChild(section);
}

function editStudentName(event, studentId) {
    event.stopPropagation(); // Prevent toggling attendance
    const course = state.classes.find(c => c.id === state.selectedClassId);

    // Find in class list
    const studentInClass = course.students.find(s => s.id === studentId);
    // Find in attendance list
    const studentInAttendance = state.attendance[course.id].find(s => s.id === studentId);

    if (!studentInClass) return;

    const newName = prompt("Enter new name:", studentInClass.name);
    if (newName && newName.trim() !== "") {
        // Update both lists
        studentInClass.name = newName.trim();
        if (studentInAttendance) {
            studentInAttendance.name = newName.trim();
        }

        saveData();
        render(); // Re-render to show changes
    }
}


function renderReports(container) {
    const section = document.createElement('div');
    section.className = 'fade-in';
    // Simplified Reports for Dynamic Data
    section.innerHTML = `
        <div class="view-header">
            <button class="btn btn-secondary" onclick="navigate('dashboard')">← Back to Dashboard</button>
            <h1>Global Reports</h1>
        </div>
        <div class="glass-panel" style="padding: 2rem">
            <p>Select a class to view specific reports (Feature coming soon for dynamic classes).</p>
        </div>
    `;
    container.appendChild(section);
}

// Logic & Actions
function navigate(view) {
    state.currentView = view;
    render();
}

function selectClass(id) {
    state.selectedClassId = id;
    navigate('class');
}

function toggleStatus(studentId) {
    const courseId = state.selectedClassId;
    const student = state.attendance[courseId].find(s => s.id === studentId);

    const nextStatus = {
        'present': 'absent',
        'absent': 'late',
        'late': 'present'
    };

    student.status = nextStatus[student.status];
    saveData();
    render();
}

function markAll(status) {
    const courseId = state.selectedClassId;
    state.attendance[courseId].forEach(s => s.status = status);
    saveData();
    render();
}

// Modals
function openModal(id) {
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

function submitNewClass() {
    const name = document.getElementById('new-class-name').value;
    const time = document.getElementById('new-class-time').value;

    if (name && time) {
        const newClass = {
            id: Date.now(),
            name,
            time,
            students: []
        };
        state.classes.push(newClass);
        saveData();
        closeModal('add-class-modal');
        render(); // Refresh dashboard

        // Reset inputs
        document.getElementById('new-class-name').value = '';
        document.getElementById('new-class-time').value = '';
    }
}

function submitNewStudents() {
    const input = document.getElementById('bulk-students-input').value;
    if (!input || !state.selectedClassId) return;

    const lines = input.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    const course = state.classes.find(c => c.id === state.selectedClassId);

    let currentMaxId = 0;
    if (course.students.length > 0) {
        currentMaxId = Math.max(...course.students.map(s => s.id));
    }

    const newStudents = lines.map((name, i) => ({
        id: currentMaxId + i + 1,
        name
    }));

    // Update Class Data
    course.students.push(...newStudents);

    // Update Attendance Data
    const attendanceRecords = newStudents.map(s => ({ ...s, status: 'present' }));
    state.attendance[course.id].push(...attendanceRecords);

    saveData();
    closeModal('manage-students-modal');
    document.getElementById('bulk-students-input').value = '';
    render(); // Refresh class view
}


function exportCSV() {
    if (!state.selectedClassId) return;

    const course = state.classes.find(c => c.id === state.selectedClassId);
    const students = state.attendance[course.id];

    // CSV Header
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Student ID,Student Name,Status,Date\n";

    // CSV Rows
    const today = new Date().toLocaleDateString();
    students.forEach(s => {
        const row = `${s.id},"${s.name}",${s.status},${today}`;
        csvContent += row + "\n";
    });

    // Download Logic
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_${course.name}_${today.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// --- HARDWARE INTEGRATION (ESP8266) ---
let hwState = {
    ip: localStorage.getItem('zenith_hw_ip') || '',
    isConnected: false,
    intervalId: null
};

function connectToScanner() {
    const ip = prompt("Enter ESP8266 IP Address:", hwState.ip);
    if (!ip) return;

    hwState.ip = ip;
    localStorage.setItem('zenith_hw_ip', ip);

    // Test Connection
    fetch(`http://${ip}/status`)
        .then(res => res.json())
        .then(data => {
            alert(`Connected! Status: ${data.status}`);
            hwState.isConnected = true;
            document.getElementById('hw-status-badge').textContent = 'Scanner Online';
            document.getElementById('hw-status-badge').style.background = 'var(--status-present)';
            document.getElementById('hw-ip-display').textContent = `(${ip})`;
            startPolling();
        })
        .catch(err => {
            alert("Connection Failed. Check IP and ensure ESP8266 is on the same Wi-Fi.");
            console.error(err);
            hwState.isConnected = false;
            document.getElementById('hw-ip-display').textContent = '';
        });
}

function startPolling() {
    if (hwState.intervalId) clearInterval(hwState.intervalId);

    hwState.intervalId = setInterval(() => {
        if (!state.selectedClassId) return; // Only poll if in class view

        fetch(`http://${hwState.ip}/poll`)
            .then(res => res.json())
            .then(data => {
                if (data.match_id && data.match_id !== -1) {
                    markAttendanceByFingerID(data.match_id);
                }
                // Maintain Online Status
                document.getElementById('hw-status-badge').textContent = 'Scanner Online';
                document.getElementById('hw-status-badge').style.background = 'var(--status-present)';
                document.getElementById('hw-ip-display').textContent = `(${hwState.ip})`;
            })
            .catch(err => {
                console.error("Poll Error", err);
                document.getElementById('hw-status-badge').textContent = 'Scanner Offline';
                document.getElementById('hw-status-badge').style.background = '#334155';
                document.getElementById('hw-ip-display').textContent = '';
            });
    }, 1000); // Check every second
}

// Finger ID is assumed to match Student ID for simplicity
// In robust app, use a map: FingerID -> StudentID
function markAttendanceByFingerID(fingerId) {
    if (!state.selectedClassId) return;

    // Find student with matching ID
    const courseId = state.selectedClassId;
    const students = state.attendance[courseId];
    const student = students.find(s => s.id === fingerId);

    if (student && student.status !== 'present') {
        student.status = 'present';
        saveData();
        render(); // Update UI

        // Visual Feedback (Toast)
        showToast(`Marked ${student.name} Present!`);
    }
}

function showToast(msg) {
    // Simple Toast implementation
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = 'var(--primary)';
    toast.style.color = 'white';
    toast.style.padding = '1rem 2rem';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    toast.style.zIndex = '1000';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Start
init();
