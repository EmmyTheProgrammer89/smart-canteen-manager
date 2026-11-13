// Load previously saved students
let students = JSON.parse(localStorage.getItem("students")) || [];

// Get HTML elements
const studentForm = document.getElementById("student-form");
const studentList = document.getElementById("student-list");

// Display saved students
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
}

// Display students when the page opens
displayStudents();

// Register a new student
studentForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const admission = document.getElementById("admission").value.trim();
    const name = document.getElementById("student-name").value.trim();
    const studentClass = document.getElementById("student-class").value.trim();
    const phone = document.getElementById("phone").value.trim();

    // Check duplicate admission number
    const existingStudent = students.find(
        student => student.admission === admission
    );

    if (existingStudent) {
        alert("This admission number is already registered!");
        return;
    }

    // Create student
    const student = {
        admission: admission,
        name: name,
        studentClass: studentClass,
        phone: phone
    };

    // Save student in the array
    students.push(student);

    // Save students in browser storage
    localStorage.setItem("students", JSON.stringify(students));

    // Update the table
    displayStudents();

    // Clear form
    studentForm.reset();

    alert("Student registered successfully!");
});
function depositMoney(studentId, amount) {

    let student = students.find(
        student => student.id === studentId
    );

    if (!student) {
        alert("Student not found!");
        return;
    }

    if (amount <= 0) {
        alert("Enter a valid deposit amount!");
        return;
    }

    student.balance = (student.balance || 0) + amount;

    localStorage.setItem(
        "students",
        JSON.stringify(students)
    );

    alert("Deposit successful!");
}
// HANDLE STUDENT DEPOSITS

document.getElementById("deposit-form")
    .addEventListener("submit", function(event) {

        event.preventDefault();

        const studentId = document.getElementById(
            "deposit-student-id"
        ).value.trim();

        const amount = Number(document.getElementById(
            "deposit-amount"
        ).value);

       const student = students.find(
    student => student.admission === studentId
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

localStorage.setItem(
    "students",
    JSON.stringify(students)
);
        displayStudents();

        alert("Deposit successful!");

        document.getElementById("deposit-form").reset();

        
});
