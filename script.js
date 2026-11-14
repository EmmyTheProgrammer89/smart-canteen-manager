
document.addEventListener("DOMContentLoaded", function() {

// =============================================
// SMART CANTEEN MANAGER
// COMPLETE FINAL JAVASCRIPT
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

const selectAllTransactions =
    document.getElementById("select-all-transactions");

const deleteSelectedTransactions =
    document.getElementById("delete-selected-transactions");


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

        if (Number(student.creditBalance) > 0) {

            alert(
                "This student still has outstanding credit. " +
                "Please settle the credit before deleting the account."
            );

            return;
        }

        const confirmed = confirm(
            "Are you sure you want to delete " +
            student.name + " (" + admission + ")?\n\n" +
            "Their transaction history will be preserved.\n\n" +
            "Their remaining wallet balance, if any, will be removed."
        );

        if (!confirmed) return;

        students = students.filter(
            item => item.admission !== admission
        );

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

    transactions.forEach((transaction, index) => {

        const row = document.createElement("tr");

        // CHECKBOX COLUMN

        const checkboxCell = document.createElement("td");

        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.className = "transaction-checkbox";
        checkbox.dataset.index = index;

        checkboxCell.appendChild(checkbox);
        row.appendChild(checkboxCell);

        // TRANSACTION INFORMATION

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

    updateSelectAllCheckbox();
}


// 9. SELECT ALL TRANSACTIONS

function updateSelectAllCheckbox() {

    if (!selectAllTransactions || !transactionList) return;

    const checkboxes = transactionList.querySelectorAll(
        ".transaction-checkbox"
    );

    const selectedCheckboxes = transactionList.querySelectorAll(
        ".transaction-checkbox:checked"
    );

    selectAllTransactions.checked =
        checkboxes.length > 0 &&
        checkboxes.length === selectedCheckboxes.length;

    selectAllTransactions.indeterminate =
        selectedCheckboxes.length > 0 &&
        selectedCheckboxes.length < checkboxes.length;
}


// SELECT ALL CHECKBOX EVENT

if (selectAllTransactions) {

    selectAllTransactions.addEventListener("change", function() {

        const checkboxes = transactionList
            ? transactionList.querySelectorAll(".transaction-checkbox")
            : [];

        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllTransactions.checked;
        });

        updateSelectAllCheckbox();

    });
}


// UPDATE SELECT ALL WHEN INDIVIDUAL CHECKBOXES CHANGE

if (transactionList) {

    transactionList.addEventListener("change", function(event) {

        if (
            event.target.classList.contains("transaction-checkbox")
        ) {
            updateSelectAllCheckbox();
        }

    });
}


// 10. DELETE SELECTED TRANSACTIONS

if (deleteSelectedTransactions) {

    deleteSelectedTransactions.addEventListener("click", function() {

        if (!transactionList) return;

        const selectedCheckboxes = transactionList.querySelectorAll(
            ".transaction-checkbox:checked"
        );

        if (selectedCheckboxes.length === 0) {

            alert("Please select at least one transaction to delete!");

            return;
        }

        const confirmed = confirm(
            "Are you sure you want to delete " +
            selectedCheckboxes.length +
            " selected transaction(s)?\n\n" +
            "This action cannot be undone.\n\n" +
            "Student wallet and credit balances will NOT change."
        );

        if (!confirmed) return;

        // GET SELECTED TRANSACTION INDEXES

        const selectedIndexes = new Set(
            Array.from(selectedCheckboxes).map(checkbox =>
                Number(checkbox.dataset.index)
            )
        );

        // REMOVE ONLY SELECTED TRANSACTIONS

        transactions = transactions.filter(
            (transaction, index) => !selectedIndexes.has(index)
        );

        // SAVE UPDATED HISTORY

        saveTransactions();

        // REFRESH ALL DISPLAYS AND REPORTS

        refreshDisplays();

        if (selectAllTransactions) {
            selectAllTransactions.checked = false;
            selectAllTransactions.indeterminate = false;
        }

        alert("Selected transaction history deleted successfully!");

    });
}


// 11. DISPLAY OUTSTANDING STUDENT CREDIT

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


// 12. UPDATE FINANCIAL REPORTS AND DASHBOARD

function updateReports() {

    let totalDeposits = 0;
    let totalSales = 0;
    let totalRepayments = 0;
    let outstandingCredit = 0;

    // CALCULATE FROM TRANSACTION HISTORY

    transactions.forEach(transaction => {

        const amount = Number(transaction.amount) || 0;
        const type = String(transaction.type || "");

        if (type === "Deposit") {

            totalDeposits += amount;

        }

        else if (
            type.startsWith("Purchase:") ||
            type.startsWith("Credit Purchase:")
        ) {

            totalSales += amount;

        }

        else if (type === "Credit Repayment") {

            totalRepayments += amount;

        }
    });

    // CALCULATE OUTSTANDING CREDIT

    students.forEach(student => {

        outstandingCredit +=
            Number(student.creditBalance) || 0;

    });


    // FINANCIAL REPORTS

    const reportDeposits =
        document.getElementById("report-deposits");

    const reportSales =
        document.getElementById("report-sales");

    const reportCredit =
        document.getElementById("report-credit");

    const reportRepayments =
        document.getElementById("report-repayments");


    if (reportDeposits) {
        reportDeposits.textContent = formatMoney(totalDeposits);
    }

    if (reportSales) {
        reportSales.textContent = formatMoney(totalSales);
    }

    if (reportCredit) {
        reportCredit.textContent = formatMoney(outstandingCredit);
    }

    if (reportRepayments) {
        reportRepayments.textContent = formatMoney(totalRepayments);
    }


    // DASHBOARD CARDS

    const dashboardDeposits =
        document.getElementById("dashboard-deposits");

    const dashboardSales =
        document.getElementById("dashboard-sales");

    const dashboardCredit =
        document.getElementById("dashboard-credit");


    if (dashboardDeposits) {
        dashboardDeposits.textContent = formatMoney(totalDeposits);
    }

    if (dashboardSales) {
        dashboardSales.textContent = formatMoney(totalSales);
    }

    if (dashboardCredit) {
        dashboardCredit.textContent = formatMoney(outstandingCredit);
    }
}


// 13. REFRESH ALL DISPLAYS

function refreshDisplays() {

    displayStudents();
    displayTransactions();
    displayCredits();

    // UPDATE TOTAL STUDENTS

    const totalStudents =
        document.getElementById("total-students");

    if (totalStudents) {
        totalStudents.textContent = students.length;
    }

    // UPDATE FINANCIAL REPORTS AND DASHBOARD

    updateReports();
}


// 14. REGISTER STUDENT

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

        if (!admission || !name || !studentClass) {

            alert("Please complete the required fields!");
            return;
        }

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

        saveStudents();
        refreshDisplays();

        studentForm.reset();

        if (admissionInput) {
            admissionInput.value = generateAdmissionNumber();
        }

        alert("Student registered successfully!");

    });
}


// 15. STUDENT DEPOSIT

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

        student.balance =
            (Number(student.balance) || 0) + amount;

        recordTransaction(student, "Deposit", amount);

        saveStudents();
        saveTransactions();

        refreshDisplays();

        depositForm.reset();

        alert("Deposit successful!");

    });
}


// 16. STUDENT PURCHASE

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


// 17. RECORD STUDENT CREDIT PURCHASE

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


// 18. RECORD CREDIT REPAYMENT

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

        const currentCredit =
            Number(student.creditBalance) || 0;

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
