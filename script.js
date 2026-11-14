
document.addEventListener("DOMContentLoaded", function() {

// =============================================
// SMART CANTEEN MANAGER
// COMPLETE CORRECTED JAVASCRIPT
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

// Ensure older student records have required fields

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


// 5. GENERATE ADMISSION NUMBERS

function generateAdmissionNumber() {

    let highestNumber =
        Number(localStorage.getItem("lastAdmissionNumber")) || 0;

    students.forEach(student => {

        const match = String(student.admission || "")
            .match(/^ASYV(\d+)$/i);

        if (match) {
            highestNumber = Math.max(
                highestNumber,
                Number(match[1])
            );
        }
    });

    transactions.forEach(transaction => {

        const match = String(transaction.admission || "")
            .match(/^ASYV(\d+)$/i);

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

    studentList.innerHTML = "";

    students.forEach(student => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${student.admission}</td>
            <td>${student.name}</td>
            <td>${student.studentClass || ""}</td>
            <td>${student.phone || ""}</td>
            <td>${formatMoney(student.balance)}</td>
        `;

        // ACTION COLUMN

        const actionCell = document.createElement("td");

        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";
        deleteButton.type = "button";
        deleteButton.className = "delete-student-btn";
        deleteButton.dataset.admission = student.admission;

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);

        studentList.appendChild(row);
    });
}


// 7. DELETE STUDENT AND PRESERVE TRANSACTIONS

if (studentList) {

    studentList.addEventListener("click", function(event) {

        const button = event.target.closest(".delete-student-btn");

        if (!button) return;

        const admission = button.dataset.admission;

        const student = findStudent(admission);

        if (!student) {
            alert("Student not found!");
            return;
        }

        // PROTECT OUTSTANDING CREDIT

        if (Number(student.creditBalance) > 0) {

            alert(
                "This student still has outstanding credit. " +
                "Please settle the credit before deleting the account."
            );

            return;
        }

        // CONFIRM DELETION

        const confirmed = confirm(
            "Are you sure you want to delete " +
            student.name + " (" + admission + ")?\n\n" +
            "Their transaction history will be preserved.\n\n" +
            "Their remaining wallet balance, if any, will be removed."
        );

        if (!confirmed) return;

        // REMOVE STUDENT ACCOUNT ONLY

        students = students.filter(
            item => item.admission !== admission
        );

        // TRANSACTION HISTORY IS NOT DELETED

        saveStudents();

        refreshDisplays();

        alert(
            "Student account deleted successfully. " +
            "Transaction history has been preserved."
        );

    });
}


// 8. DISPLAY TRANSACTIONS

function displayTransactions() {

    if (!transactionList) return;

    transactionList.innerHTML = "";

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


// 9. DISPLAY OUTSTANDING STUDENT CREDIT

function displayCredits() {

    if (!creditList) return;

    creditList.innerHTML = "";

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


// 10. REFRESH ALL DISPLAYS

function refreshDisplays() {

    displayStudents();
    displayTransactions();
    displayCredits();

    // UPDATE TOTAL STUDENTS

    const totalStudents = document.getElementById("total-students");

    if (totalStudents) {
        totalStudents.textContent = students.length;
    }
}


// 11. REGISTER STUDENT

if (studentForm) {

    // SHOW NEXT ADMISSION NUMBER

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

        // SAVE LAST USED ADMISSION NUMBER

        const numberMatch = admission.match(/^ASYV(\d+)$/i);

        if (numberMatch) {
            localStorage.setItem(
                "lastAdmissionNumber",
                numberMatch[1]
            );
        }

        // SAVE AND UPDATE

        saveStudents();
        refreshDisplays();

        // CLEAR FORM AND SHOW NEXT NUMBER

        studentForm.reset();

        if (admissionInput) {
            admissionInput.value = generateAdmissionNumber();
        }

        alert("Student registered successfully!");

    });
}


// 12. STUDENT DEPOSIT

if (depositForm) {

    depositForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const admission = getValue("deposit-student-id");
        const amount = Number(getValue("deposit-amount"));

        const student = findStudent(admission);

        if (!student) {
            alert("Student not found!");
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            alert("Enter a valid deposit amount!");
            return;
        }

        // ADD MONEY TO WALLET

        student.balance = (Number(student.balance) || 0) + amount;

        recordTransaction(student, "Deposit", amount);

        saveStudents();
        saveTransactions();

        refreshDisplays();

        depositForm.reset();

        alert("Deposit successful!");

    });
}


// 13. STUDENT PURCHASE

if (purchaseForm) {

    purchaseForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const admission = getValue("purchase-student-id");
        const description = getValue("purchase-description");
        const amount = Number(getValue("purchase-amount"));

        const student = findStudent(admission);

        if (!student) {
            alert("Student not found! Check the admission number.");
            return;
        }

        if (!description) {
            alert("Enter the product name!");
            return;
        }

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

        recordTransaction(
            student,
            "Purchase: " + description,
            amount
        );

        saveStudents();
        saveTransactions();

        refreshDisplays();

        purchaseForm.reset();

        alert("Purchase recorded successfully!");

    });
}


// 14. RECORD STUDENT CREDIT PURCHASE

if (creditForm) {

    creditForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const admission = getValue("credit-student-id");
        const description = getValue("credit-description");
        const amount = Number(getValue("credit-amount"));

        const student = findStudent(admission);

        if (!student) {
            alert("Student not found!");
            return;
        }

        if (!description || !Number.isFinite(amount) || amount <= 0) {
            alert("Enter a valid product and amount!");
            return;
        }

        // ADD TO OUTSTANDING CREDIT

        student.creditBalance =
            (Number(student.creditBalance) || 0) + amount;

        recordTransaction(
            student,
            "Credit Purchase: " + description,
            amount
        );

        saveStudents();
        saveTransactions();

        refreshDisplays();

        creditForm.reset();

        alert("Credit purchase recorded successfully!");

    });
}


// 15. RECORD CREDIT REPAYMENT

if (repaymentForm) {

    repaymentForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const admission = getValue("repayment-student-id");
        const amount = Number(getValue("repayment-amount"));

        const student = findStudent(admission);

        if (!student) {
            alert("Student not found!");
            return;
        }

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

        recordTransaction(
            student,
            "Credit Repayment",
            amount
        );

        saveStudents();
        saveTransactions();

        refreshDisplays();

        repaymentForm.reset();

        alert("Credit repayment recorded successfully!");

    });
}


// INITIAL DISPLAY

refreshDisplays();


// CLOSE DOMCONTENTLOADED

});
