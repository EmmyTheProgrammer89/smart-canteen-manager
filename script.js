document.addEventListener("DOMContentLoaded", function() {

// =============================================
// SMART CANTEEN MANAGER
// COMPLETE REVISED JAVASCRIPT
// =============================================


// 1. LOAD SAVED DATA

function loadData(key) {
    try {
        const savedData = JSON.parse(localStorage.getItem(key));
        return Array.isArray(savedData) ? savedData : [];
    } catch (error) {
        console.error("Error loading " + key + ":", error);
        return [];
    }
}

let students = loadData("students");
let transactions = loadData("transactions");

// Ensure older student records have all required fields
students.forEach(student => {
    student.balance = Number(student.balance) || 0;
    student.creditBalance = Number(student.creditBalance) || 0;
});


// 2. GET HTML ELEMENTS

const studentForm = document.getElementById("student-form");
const studentList = document.getElementById("student-list");
const admissionInput = document.getElementById("admission");

const depositForm = document.getElementById("deposit-form");
const transactionList = document.getElementById("transaction-list");
const purchaseForm = document.getElementById("purchase-form");
const creditForm = document.getElementById("credit-form");
const repaymentForm = document.getElementById("repayment-form");
const creditList = document.getElementById("credit-list");


// 3. SAVE DATA

function saveStudents() {
    try {
        localStorage.setItem("students", JSON.stringify(students));
    } catch (error) {
        alert("Unable to save students. Check your browser storage.");
        console.error(error);
    }
}

function saveTransactions() {
    try {
        localStorage.setItem("transactions", JSON.stringify(transactions));
    } catch (error) {
        alert("Unable to save transactions. Check your browser storage.");
        console.error(error);
    }
}


// 4. HELPER FUNCTIONS

function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
}

function formatMoney(amount) {
    return (Number(amount) || 0).toLocaleString() + " RWF";
}

function findStudent(admission) {
    return students.find(
        student => student.admission === admission
    );
}

function recordTransaction(student, type, amount) {
    const transaction = {
        admission: student.admission,
        studentName: student.name,
        type: type,
        amount: amount,
        date: new Date().toLocaleString()
    };

    transactions.push(transaction);
}


// 5. GENERATE NEXT ADMISSION NUMBER

function generateAdmissionNumber() {
    let highestNumber = 0;

    students.forEach(student => {
        const admission = String(student.admission || "");
        const match = admission.match(/^ASYV(\d+)$/i);

        if (match) {
            highestNumber = Math.max(
                highestNumber,
                Number(match[1])
            );
        }
    });

    return "ASYV" + String(highestNumber + 1).padStart(3, "0");
}


// 6. DISPLAY STUDENTS

function displayStudents() {

    if (!studentList) return;

    studentList.textContent = "";

    students.forEach(student => {

        const row = document.createElement("tr");

        const values = [
            student.admission,
            student.name,
            student.studentClass,
            student.phone || "Not provided",
            formatMoney(student.balance)
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        studentList.appendChild(row);
    });

    const totalStudents = document.getElementById("total-students");

    if (totalStudents) {
        totalStudents.textContent = students.length;
    }
}


// 7. DISPLAY TRANSACTIONS

function displayTransactions() {

    if (!transactionList) return;

    transactionList.textContent = "";

    transactions.forEach(transaction => {

        const row = document.createElement("tr");

        const values = [
            transaction.admission,
            transaction.studentName,
            transaction.type,
            formatMoney(transaction.amount),
            transaction.date
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value ?? "";
            row.appendChild(cell);
        });

        transactionList.appendChild(row);
    });
}


// 8. DISPLAY OUTSTANDING STUDENT CREDIT

function displayCredits() {

    if (!creditList) return;

    creditList.textContent = "";

    students.forEach(student => {

        const credit = Number(student.creditBalance) || 0;

        if (credit > 0) {

            const row = document.createElement("tr");

            const values = [
                student.admission,
                student.name,
                formatMoney(credit)
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            creditList.appendChild(row);
        }
    });
}


// 9. REFRESH ALL DISPLAYS

function refreshDisplays() {
    displayStudents();
    displayTransactions();
    displayCredits();
}


// 10. REGISTER STUDENT

if (studentForm) {

    // SHOW NEXT ADMISSION NUMBER WHEN FORM OPENS

    if (admissionInput) {
        admissionInput.value = generateAdmissionNumber();
    }

    studentForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const admission = admissionInput
            ? admissionInput.value.trim()
            : "";

        const name = getValue("student-name");
        const studentClass = getValue("student-class");
        const phone = getValue("phone");

        // VALIDATE REQUIRED FIELDS

        if (!admission || !name || !studentClass) {
            alert("Please complete the required fields!");
            return;
        }

        // CHECK DUPLICATE ADMISSION NUMBER

        if (findStudent(admission)) {
            alert("This admission number is already registered!");
            return;
        }

        // CREATE STUDENT

        const student = {
            admission: admission,
            name: name,
            studentClass: studentClass,
            phone: phone,
            balance: 0,
            creditBalance: 0
        };

        students.push(student);

        // SAVE AND UPDATE

        saveStudents();
        refreshDisplays();

        // CLEAR FORM AND GENERATE NEXT NUMBER

        studentForm.reset();

        if (admissionInput) {
            admissionInput.value = generateAdmissionNumber();
        }

        alert("Student registered successfully!");

    });
}


// 11. STUDENT DEPOSIT

if (depositForm) {

    depositForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const admission = getValue("deposit-student-id");
        const amount = Number(getValue("deposit-amount"));

        // FIND STUDENT

        const student = findStudent(admission);

        if (!student) {
            alert("Student not found!");
            return;
        }

        // VALIDATE AMOUNT

        if (!Number.isFinite(amount) || amount <= 0) {
            alert("Enter a valid deposit amount!");
            return;
        }

        // ADD MONEY TO WALLET

        student.balance = (Number(student.balance) || 0) + amount;

        // RECORD TRANSACTION

        recordTransaction(student, "Deposit", amount);

        // SAVE DATA

        saveStudents();
        saveTransactions();

        // UPDATE DISPLAYS

        refreshDisplays();

        depositForm.reset();

        alert("Deposit successful!");

    });
}


// 12. STUDENT PURCHASE

if (purchaseForm) {

    purchaseForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const admission = getValue("purchase-student-id");
        const description = getValue("purchase-description");
        const amount = Number(getValue("purchase-amount"));

        // FIND STUDENT

        const student = findStudent(admission);

        if (!student) {
            alert("Student not found! Check the admission number.");
            return;
        }

        // VALIDATE PRODUCT

        if (!description) {
            alert("Enter the product name!");
            return;
        }

        // VALIDATE AMOUNT

        if (!Number.isFinite(amount) || amount <= 0) {
            alert("Enter a valid purchase amount!");
            return;
        }

        // CHECK WALLET BALANCE

        const currentBalance = Number(student.balance) || 0;

        if (amount > currentBalance) {
            alert(
                "Insufficient wallet balance! Current balance: " +
                formatMoney(currentBalance)
            );
            return;
        }

        // DEDUCT MONEY

        student.balance = currentBalance - amount;

        // RECORD PURCHASE

        recordTransaction(
            student,
            "Purchase: " + description,
            amount
        );

        // SAVE DATA

        saveStudents();
        saveTransactions();

        // UPDATE DISPLAYS

        refreshDisplays();

        purchaseForm.reset();

        alert("Purchase recorded successfully!");

    });
}


// 13. RECORD STUDENT CREDIT PURCHASE

if (creditForm) {

    creditForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const admission = getValue("credit-student-id");
        const description = getValue("credit-description");
        const amount = Number(getValue("credit-amount"));

        // FIND STUDENT

        const student = findStudent(admission);

        if (!student) {
            alert("Student not found!");
            return;
        }

        // VALIDATE INPUT

        if (!description || !Number.isFinite(amount) || amount <= 0) {
            alert("Enter a valid product and amount!");
            return;
        }

        // ADD TO OUTSTANDING CREDIT

        student.creditBalance =
            (Number(student.creditBalance) || 0) + amount;

        // RECORD TRANSACTION

        recordTransaction(
            student,
            "Credit Purchase: " + description,
            amount
        );

        // SAVE DATA

        saveStudents();
        saveTransactions();

        // UPDATE DISPLAYS

        refreshDisplays();

        creditForm.reset();

        alert("Credit purchase recorded successfully!");

    });
}


// 14. RECORD CREDIT REPAYMENT

if (repaymentForm) {

    repaymentForm.addEventListener("submit", function(event) {

        event.preventDefault();

        // GET FORM VALUES

        const admission = getValue("repayment-student-id");
        const amount = Number(getValue("repayment-amount"));

        // FIND STUDENT

        const student = findStudent(admission);

        if (!student) {
            alert("Student not found!");
            return;
        }

        // VALIDATE AMOUNT

        if (!Number.isFinite(amount) || amount <= 0) {
            alert("Please enter a valid repayment amount!");
            return;
        }

        // CHECK OUTSTANDING CREDIT

        const currentCredit = Number(student.creditBalance) || 0;

        if (currentCredit <= 0) {
            alert("This student has no outstanding credit!");
            return;
        }

        // PREVENT EXCESS REPAYMENT

        if (amount > currentCredit) {
            alert(
                "Repayment cannot exceed the outstanding credit!"
            );
            return;
        }

        // REDUCE CREDIT BALANCE

        student.creditBalance = currentCredit - amount;

        // RECORD TRANSACTION

        recordTransaction(
            student,
            "Credit Repayment",
            amount
        );

        // SAVE DATA

        saveStudents();
        saveTransactions();

        // UPDATE DISPLAYS

        refreshDisplays();

        repaymentForm.reset();

        alert("Credit repayment recorded successfully!");

    });
}


// 15. DISPLAY SAVED DATA WHEN PAGE OPENS

refreshDisplays();


// =============================================
// END OF SMART CANTEEN MANAGER JAVASCRIPT
// =============================================

}); // CLOSE DOMContentLoaded
