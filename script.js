// Store registered students
let students = [];

// Get the registration form
const studentForm = document.getElementById("student-form");

// Get the student table
const studentList = document.getElementById("student-list");

// Listen for form submission
studentForm.addEventListener("submit", function(event) {

    // Prevent the page from refreshing
    event.preventDefault();

    // Collect student information
    const admission = document.getElementById("admission").value.trim();
    const name = document.getElementById("student-name").value.trim();
    const studentClass = document.getElementById("student-class").value.trim();
    const phone = document.getElementById("phone").value.trim();

    // Check for duplicate admission numbers
    const existingStudent = students.find(
        student => student.admission === admission
    );

    if (existingStudent) {
        alert("This admission number is already registered!");
        return;
    }

    // Create a student object
    const student = {
        admission: admission,
        name: name,
        studentClass: studentClass,
        phone: phone
    };

    // Add student to the array
    students.push(student);

    // Create a new table row
    const row = document.createElement("tr");

    // Add student information to the row
    [admission, name, studentClass, phone].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value || "Not provided";
        row.appendChild(cell);
    });

    // Display student in the table
    studentList.appendChild(row);

    // Clear the form
    studentForm.reset();

    // Confirm registration
    alert("Student registered successfully!");
});
