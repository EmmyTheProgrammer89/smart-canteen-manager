
// =====================================
// SMART CANTEEN MANAGER
// =====================================

// 1. LOAD SAVED STUDENTS
let students = JSON.parse(
    localStorage.getItem("students")
) || [];
// LOAD SAVED TRANSACTIONS
let transactions = JSON.parse(
    localStorage.getItem("transactions")
) || [];

// 2. GET HTML ELEMENTS
const studentForm = document.getElementById("student-form");
const studentList = document.getElementById("student-list");
const depositForm = document.getElementById("deposit-form");

// 3. SAVE STUDENTS
function saveStudents() {
    localStorage.setItem(
        "students",
        JSON.stringify(students)
    );
}

// SAVE TRANSACTIONS
function saveTransactions() {
    localStorage.setItem(
        "transactions",
        JSON.stringify(transactions)
    );
}

// 4. DISPLAY STUDENTS
function displayStudents() {
    studentList.textContent = "";

    students.forEach(student => {
        const row = document.createElement("tr");

        [
            student.admission,
            student.name,
            student.studentClass,
            student.phone,
            (student.balance || 0).toLocaleString() + " RWF"
        ].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value || "Not provided";
            row.appendChild(cell);
        });

        studentList.appendChild(row);
    });

    // UPDATE TOTAL STUDENTS
    document.getElementById("total-students").textContent =
        students.length;
}
     
// 5. DISPLAY STUDENTS WHEN PAGE OPENS
displayStudents();

// 6. REGISTER STUDENT
studentForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const admission = document.getElementById("admission").value.trim();
    const name = document.getElementById("student-name").value.trim();
    const studentClass = document.getElementById("student-class").value.trim();
    const phone = document.getElementById("phone").value.trim();

    if (!admission || !name || !studentClass) {
        alert("Please complete the required fields!");
        return;
    }

    const existingStudent = students.find(
        student => student.admission === admission
    );

    if (existingStudent) {
        alert("This admission number is already registered!");
        return;
    }

    const student = {
        admission: admission,
        name: name,
        studentClass: studentClass,
        phone: phone,
        balance: 0
    };

    students.push(student);

    saveStudents();
    displayStudents();

    studentForm.reset();

    alert("Student registered successfully!");
});

// 7. STUDENT DEPOSIT
depositForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const studentAdmission = document.getElementById(
        "deposit-student-id"
    ).value.trim();

    const amount = Number(document.getElementById(
        "deposit-amount"
    ).value);

    const student = students.find(
        student => student.admission === studentAdmission
    );

    if (!student) {
        alert("Student not found!");
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Enter a valid deposit amount!");
        return;
    }

    student.balance = (student.balance || 0) + amount;
    // RECORD DEPOSIT TRANSACTION
const transaction = {
    admission: student.admission,
    studentName: student.name,
    type: "Deposit",
    amount: amount,
    date: new Date().toLocaleString()
};

transactions.push(transaction);

saveTransactions();

    saveStudents();
    displayStudents();

    depositForm.reset();

    alert("Deposit successful!");
});
