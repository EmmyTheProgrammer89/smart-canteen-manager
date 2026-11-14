
// ============================================
// SMART CANTEEN MANAGER
// FIREBASE VERSION - CORRECTED
// ============================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    setDoc,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";


// ============================================
// 1. CONFIGURATION
// ============================================

// Administrator Firebase UID
const ADMIN_UID = "mRLoouOWj4Ng4phNGB7e6QAaNY32";


// ============================================
// 2. HTML ELEMENTS
// ============================================

const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

const adminApp = document.getElementById("admin-app");
const studentApp = document.getElementById("student-app");

const adminLogoutButton = document.getElementById("admin-logout-button");
const studentLogoutButton = document.getElementById("student-logout-button");

const studentForm = document.getElementById("student-form");
const studentList = document.getElementById("student-list");

const depositForm = document.getElementById("deposit-form");
const purchaseForm = document.getElementById("purchase-form");
const creditForm = document.getElementById("credit-form");
const repaymentForm = document.getElementById("repayment-form");

const transactionList = document.getElementById("transaction-list");

const selectAllTransactions = document.getElementById(
    "select-all-transactions"
);

const deleteSelectedTransactions = document.getElementById(
    "delete-selected-transactions"
);


// ============================================
// 3. APPLICATION DATA
// ============================================

let students = [];
let balances = {};
let transactions = [];


// ============================================
// 4. GENERAL FUNCTIONS
// ============================================

function formatMoney(amount) {
    return Number(amount || 0).toLocaleString("en-US") + " RWF";
}


function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
}


function showError(message) {
    if (loginError) {
        loginError.textContent = message;
    }
}


function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return replacements[character];
    });
}


function showLogin() {
    loginScreen.hidden = false;
    adminApp.hidden = true;
    studentApp.hidden = true;
}


function showAdmin() {
    loginScreen.hidden = true;
    adminApp.hidden = false;
    studentApp.hidden = true;
}


function showStudent() {
    loginScreen.hidden = true;
    adminApp.hidden = true;
    studentApp.hidden = false;
}


function getStudentByAdmission(admission) {
    return students.find(student => student.admission === admission);
}


function getBalanceByUid(uid) {
    return balances[uid] || {
        balance: 0,
        creditBalance: 0
    };
}


function getDateValue(transaction) {

    if (transaction.date) {
        return new Date(transaction.date);
    }

    if (transaction.createdAt?.toDate) {
        return transaction.createdAt.toDate();
    }

    return new Date(0);
}


function formatDate(transaction) {

    const date = getDateValue(transaction);

    if (Number.isNaN(date.getTime())) {
        return "Unknown date";
    }

    return date.toLocaleString();
}


// ============================================
// 5. LOGIN AND LOGOUT
// ============================================

loginForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const email = getValue("login-email");
    const password = getValue("login-password");

    if (!email || !password) {
        showError("Please enter your email and password.");
        return;
    }

    showError("Signing in...");

    try {

        await signInWithEmailAndPassword(auth, email, password);

        showError("");

    } catch (error) {

        console.error("Login error:", error);

        showError("Login failed. Check your email and password.");
    }
});


async function logoutUser() {

    try {

        await signOut(auth);

        students = [];
        balances = {};
        transactions = [];

        showLogin();

    } catch (error) {

        console.error("Logout error:", error);

        alert("Unable to log out. Please try again.");
    }
}


if (adminLogoutButton) {
    adminLogoutButton.addEventListener("click", logoutUser);
}


if (studentLogoutButton) {
    studentLogoutButton.addEventListener("click", logoutUser);
}


// ============================================
// 6. CHECK THE SIGNED-IN USER
// ============================================

onAuthStateChanged(auth, async function(user) {

    if (!user) {

        showLogin();

        return;
    }


    // ADMINISTRATOR LOGIN

    if (user.uid === ADMIN_UID) {

        showAdmin();

        try {

            await loadAdminData();

            refreshDisplays();

        } catch (error) {

            console.error("Admin loading error:", error);

            alert(
                "Could not load administrator data. Check your Firebase rules and connection."
            );
        }

        return;
    }


    // STUDENT LOGIN

    try {

        const studentQuery = query(
            collection(db, "students"),
            where("authUid", "==", user.uid)
        );

        const studentSnapshot = await getDocs(studentQuery);

        if (studentSnapshot.empty) {

            alert(
                "Your account has not been linked to a student record. Please contact the administrator."
            );

            await signOut(auth);

            return;
        }


        const studentDocument = studentSnapshot.docs[0];

        const student = studentDocument.data();

        showStudent();

        await loadStudentPortal(user.uid, student);

    } catch (error) {

        console.error("Student loading error:", error);

        alert(
            "Unable to load your student account. Please contact the administrator."
        );

        await signOut(auth);
    }
});


// ============================================
// 7. LOAD ADMINISTRATOR DATA
// ============================================

async function loadAdminData() {

    // LOAD STUDENTS

    const studentSnapshot = await getDocs(
        collection(db, "students")
    );

    students = studentSnapshot.docs.map(document => ({
        ...document.data(),
        documentId: document.id
    }));


    // LOAD BALANCES

    const balanceSnapshot = await getDocs(
        collection(db, "balances")
    );

    balances = {};

    balanceSnapshot.forEach(document => {

        balances[document.id] = document.data();

    });


    // LOAD TRANSACTIONS

    const transactionSnapshot = await getDocs(
        collection(db, "transactions")
    );

    transactions = transactionSnapshot.docs.map(document => ({
        ...document.data(),
        id: document.id
    }));


    // SORT TRANSACTIONS

    transactions.sort((a, b) => {

        return getDateValue(b) - getDateValue(a);

    });
}


// ============================================
// 8. GENERATE ADMISSION NUMBER
// ============================================

function generateAdmissionNumber() {

    let highestNumber = 0;

    students.forEach(student => {

        const match = String(student.admission || "").match(/^ASYV(\d+)$/);

        if (match) {

            highestNumber = Math.max(
                highestNumber,
                Number(match[1])
            );
        }
    });

    const nextNumber = highestNumber + 1;

    return "ASYV" + String(nextNumber).padStart(3, "0");
}


// ============================================
// 9. STUDENT REGISTRATION
// ============================================

if (studentForm) {

    studentForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const name = getValue("student-name");

        const studentClass = getValue("student-class");

        const phone = getValue("phone");

        const authUid = getValue("student-auth-uid");


        if (!name || !studentClass || !authUid) {

            alert("Please complete all required student information.");

            return;
        }


        // CHECK DUPLICATE UID

        const duplicateUid = students.find(student => {

            return student.authUid === authUid;

        });

        if (duplicateUid) {

            alert("This Firebase UID is already linked to another student.");

            return;
        }


        const admission = generateAdmissionNumber();


        try {

            // CREATE STUDENT PROFILE

            await setDoc(
                doc(db, "students", admission),
                {
                    admission: admission,
                    name: name,
                    studentClass: studentClass,
                    phone: phone,
                    authUid: authUid,
                    createdAt: serverTimestamp()
                }
            );


            // CREATE SEPARATE FINANCIAL RECORD

            await setDoc(
                doc(db, "balances", authUid),
                {
                    admission: admission,
                    balance: 0,
                    creditBalance: 0
                }
            );


            alert(
                "Student registered successfully!\nAdmission number: " + admission
            );

            studentForm.reset();

            await loadAdminData();

            refreshDisplays();

        } catch (error) {

            console.error("Student registration error:", error);

            alert(
                "Could not register student. Check the Firebase UID and your connection."
            );
        }
    });
}


// ============================================
// 10. DISPLAY STUDENTS
// ============================================

function displayStudents() {

    if (!studentList) return;

    studentList.innerHTML = "";


    if (students.length === 0) {

        studentList.innerHTML = `
            <tr>
                <td colspan="6">No students registered yet.</td>
            </tr>
        `;

        return;
    }


    students.forEach(student => {

        const financialRecord = getBalanceByUid(student.authUid);

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(student.admission)}</td>

            <td>${escapeHTML(student.name)}</td>

            <td>${escapeHTML(student.studentClass)}</td>

            <td>${escapeHTML(student.phone || "")}</td>

            <td>${formatMoney(financialRecord.balance)}</td>

            <td>
                <button
                    type="button"
                    class="delete-student"
                    data-admission="${escapeHTML(student.admission)}"
                >
                    Delete
                </button>
            </td>
        `;

        studentList.appendChild(row);

    });
}


// ============================================
// 11. DELETE STUDENT
// ============================================

if (studentList) {

    studentList.addEventListener("click", async function(event) {

        const button = event.target.closest(".delete-student");

        if (!button) return;

        const admission = button.dataset.admission;

        const student = getStudentByAdmission(admission);

        if (!student) return;


        const financialRecord = getBalanceByUid(student.authUid);


        // PREVENT DELETION IF CREDIT REMAINS

        if (Number(financialRecord.creditBalance || 0) > 0) {

            alert(
                "This student still has unpaid credit. Clear the credit before deleting the student."
            );

            return;
        }


        const confirmed = confirm(
            "Delete " + student.name +
            "?\n\nTheir transaction history will be preserved."
        );

        if (!confirmed) return;


        try {

            const batch = writeBatch(db);

            batch.delete(
                doc(db, "students", admission)
            );

            batch.delete(
                doc(db, "balances", student.authUid)
            );

            await batch.commit();


            await loadAdminData();

            refreshDisplays();


            alert(
                "Student deleted. Their transaction history has been preserved."
            );

        } catch (error) {

            console.error("Student deletion error:", error);

            alert("Could not delete this student.");
        }
    });
}


// ============================================
// 12. RECORD FINANCIAL TRANSACTION
// ============================================

async function recordFinancialTransaction(
    student,
    type,
    amount,
    newBalance,
    newCreditBalance
) {

    const batch = writeBatch(db);


    const balanceReference = doc(
        db,
        "balances",
        student.authUid
    );


    const transactionReference = doc(
        collection(db, "transactions")
    );


    // UPDATE BALANCE

    batch.set(
        balanceReference,
        {
            admission: student.admission,
            balance: newBalance,
            creditBalance: newCreditBalance
        }
    );


    // SAVE TRANSACTION

    batch.set(
        transactionReference,
        {
            admission: student.admission,
            studentName: student.name,
            type: type,
            amount: amount,
            date: new Date().toISOString(),
            createdAt: serverTimestamp()
        }
    );


    await batch.commit();


    await loadAdminData();

    refreshDisplays();
}


// ============================================
// 13. DEPOSIT MONEY
// ============================================

if (depositForm) {

    depositForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const admission = getValue("deposit-student-id");

        const amount = Number(getValue("deposit-amount"));

        const student = getStudentByAdmission(admission);


        if (!student) {

            alert("Please enter a valid student admission number.");

            return;
        }


        if (!Number.isFinite(amount) || amount <= 0) {

            alert("Enter a valid deposit amount.");

            return;
        }


        try {

            const current = getBalanceByUid(student.authUid);

            const newBalance =
                Number(current.balance || 0) + amount;


            await recordFinancialTransaction(
                student,
                "Deposit",
                amount,
                newBalance,
                Number(current.creditBalance || 0)
            );


            depositForm.reset();

            alert("Deposit recorded successfully.");

        } catch (error) {

            console.error("Deposit error:", error);

            alert("Could not record the deposit.");
        }
    });
}


// ============================================
// 14. MAKE PURCHASE
// ============================================

if (purchaseForm) {

    purchaseForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const admission = getValue("purchase-student-id");

        const description = getValue("purchase-description");

        const amount = Number(getValue("purchase-amount"));

        const student = getStudentByAdmission(admission);


        if (!student) {

            alert("Please enter a valid student admission number.");

            return;
        }


        if (!Number.isFinite(amount) || amount <= 0) {

            alert("Enter a valid purchase amount.");

            return;
        }


        const current = getBalanceByUid(student.authUid);


        if (Number(current.balance || 0) < amount) {

            alert("Insufficient wallet balance.");

            return;
        }


        try {

            const newBalance =
                Number(current.balance || 0) - amount;


            await recordFinancialTransaction(
                student,
                description ? "Purchase: " + description : "Purchase",
                amount,
                newBalance,
                Number(current.creditBalance || 0)
            );


            purchaseForm.reset();

            alert("Purchase recorded successfully.");

        } catch (error) {

            console.error("Purchase error:", error);

            alert("Could not record the purchase.");
        }
    });
}


// ============================================
// 15. RECORD CREDIT
// ============================================

if (creditForm) {

    creditForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const admission = getValue("credit-student-id");

        const description = getValue("credit-description");

        const amount = Number(getValue("credit-amount"));

        const student = getStudentByAdmission(admission);


        if (!student) {

            alert("Please enter a valid student admission number.");

            return;
        }


        if (!Number.isFinite(amount) || amount <= 0) {

            alert("Enter a valid credit amount.");

            return;
        }


        try {

            const current = getBalanceByUid(student.authUid);

            const newCreditBalance =
                Number(current.creditBalance || 0) + amount;


            await recordFinancialTransaction(
                student,
                description ? "Credit: " + description : "Credit",
                amount,
                Number(current.balance || 0),
                newCreditBalance
            );


            creditForm.reset();

            alert("Credit recorded successfully.");

        } catch (error) {

            console.error("Credit error:", error);

            alert("Could not record the credit.");
        }
    });
}


// ============================================
// 16. RECORD CREDIT REPAYMENT
// ============================================

if (repaymentForm) {

    repaymentForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const admission = getValue("repayment-student-id");

        const amount = Number(getValue("repayment-amount"));

        const student = getStudentByAdmission(admission);


        if (!student) {

            alert("Please enter a valid student admission number.");

            return;
        }


        if (!Number.isFinite(amount) || amount <= 0) {

            alert("Enter a valid repayment amount.");

            return;
        }


        const current = getBalanceByUid(student.authUid);


        if (amount > Number(current.creditBalance || 0)) {

            alert(
                "The repayment cannot be greater than the student's outstanding credit."
            );

            return;
        }


        try {

            const newCreditBalance =
                Number(current.creditBalance || 0) - amount;


            await recordFinancialTransaction(
                student,
                "Repayment",
                amount,
                Number(current.balance || 0),
                newCreditBalance
            );


            repaymentForm.reset();

            alert("Credit repayment recorded successfully.");

        } catch (error) {

            console.error("Repayment error:", error);

            alert("Could not record the repayment.");
        }
    });
}


// ============================================
// 17. DISPLAY TRANSACTIONS
// ============================================

function displayTransactions() {

    if (!transactionList) return;

    transactionList.innerHTML = "";


    if (transactions.length === 0) {

        transactionList.innerHTML = `
            <tr>
                <td colspan="6">No transactions recorded yet.</td>
            </tr>
        `;

        return;
    }


    transactions.forEach(transaction => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                <input
                    type="checkbox"
                    class="transaction-checkbox"
                    value="${escapeHTML(transaction.id)}"
                >
            </td>

            <td>${escapeHTML(transaction.admission)}</td>

            <td>${escapeHTML(transaction.studentName)}</td>

            <td>${escapeHTML(transaction.type)}</td>

            <td>${formatMoney(transaction.amount)}</td>

            <td>${escapeHTML(formatDate(transaction))}</td>
        `;

        transactionList.appendChild(row);

    });
}


// ============================================
// 18. SELECT ALL TRANSACTIONS
// ============================================

if (selectAllTransactions) {

    selectAllTransactions.addEventListener("change", function() {

        const checkboxes = document.querySelectorAll(
            ".transaction-checkbox"
        );

        checkboxes.forEach(checkbox => {

            checkbox.checked = selectAllTransactions.checked;

        });
    });
}


// ============================================
// 19. DELETE SELECTED TRANSACTIONS
// ============================================

if (deleteSelectedTransactions) {

    deleteSelectedTransactions.addEventListener("click", async function() {

        const selected = document.querySelectorAll(
            ".transaction-checkbox:checked"
        );


        const selectedIds = Array.from(selected).map(
            checkbox => checkbox.value
        );


        if (selectedIds.length === 0) {

            alert("Select at least one transaction to delete.");

            return;
        }


        const confirmed = confirm(
            "Delete " + selectedIds.length +
            " selected transaction(s)?\n\nThis will not change student wallet balances or credit balances."
        );

        if (!confirmed) return;


        try {

            const batch = writeBatch(db);


            selectedIds.forEach(id => {

                batch.delete(
                    doc(db, "transactions", id)
                );

            });


            await batch.commit();


            if (selectAllTransactions) {

                selectAllTransactions.checked = false;

            }


            await loadAdminData();

            refreshDisplays();


            alert("Selected transaction history deleted.");

        } catch (error) {

            console.error("Transaction deletion error:", error);

            alert("Could not delete the selected transactions.");
        }
    });
}


// ============================================
// 20. DISPLAY CREDIT RECORDS
// ============================================

function displayCredits() {

    const creditList = document.getElementById("credit-list");

    if (!creditList) return;

    creditList.innerHTML = "";


    const studentsWithCredit = students.filter(student => {

        const financialRecord = getBalanceByUid(student.authUid);

        return Number(financialRecord.creditBalance || 0) > 0;

    });


    if (studentsWithCredit.length === 0) {

        creditList.innerHTML = `
            <tr>
                <td colspan="3">No outstanding credit.</td>
            </tr>
        `;

        return;
    }


    studentsWithCredit.forEach(student => {

        const financialRecord = getBalanceByUid(student.authUid);

        const row = document.createElement("tr");


        row.innerHTML = `
            <td>${escapeHTML(student.admission)}</td>

            <td>${escapeHTML(student.name)}</td>

            <td>${formatMoney(financialRecord.creditBalance)}</td>
        `;


        creditList.appendChild(row);

    });
}


// ============================================
// 21. UPDATE REPORTS AND DASHBOARD
// ============================================

function updateReports() {

    let totalDeposits = 0;

    let totalSales = 0;

    let totalCredit = 0;

    let totalRepayments = 0;


    transactions.forEach(transaction => {

        const type = String(transaction.type || "").toLowerCase();

        const amount = Number(transaction.amount || 0);


        if (type === "deposit") {

            totalDeposits += amount;

        }


        if (type.startsWith("purchase")) {

            totalSales += amount;

        }


        if (type.startsWith("credit")) {

            totalCredit += amount;

        }


        if (type === "repayment") {

            totalRepayments += amount;

        }

    });


    // DASHBOARD ELEMENTS

    const totalStudentsElement = document.getElementById("total-students");

    const dashboardDeposits = document.getElementById("dashboard-deposits");

    const dashboardSales = document.getElementById("dashboard-sales");

    const dashboardCredit = document.getElementById("dashboard-credit");


    if (totalStudentsElement) {

        totalStudentsElement.textContent = students.length;

    }


    if (dashboardDeposits) {

        dashboardDeposits.textContent = formatMoney(totalDeposits);

    }


    if (dashboardSales) {

        dashboardSales.textContent = formatMoney(totalSales);

    }


    if (dashboardCredit) {

        const outstandingCredit = students.reduce((total, student) => {

            const financialRecord = getBalanceByUid(student.authUid);

            return total + Number(financialRecord.creditBalance || 0);

        }, 0);


        dashboardCredit.textContent = formatMoney(outstandingCredit);

    }


    // REPORT ELEMENTS

    const reportDeposits = document.getElementById("report-deposits");

    const reportSales = document.getElementById("report-sales");

    const reportCredit = document.getElementById("report-credit");

    const reportRepayments = document.getElementById("report-repayments");


    if (reportDeposits) {

        reportDeposits.textContent = formatMoney(totalDeposits);

    }


    if (reportSales) {

        reportSales.textContent = formatMoney(totalSales);

    }


    if (reportCredit) {

        reportCredit.textContent = formatMoney(totalCredit);

    }


    if (reportRepayments) {

        reportRepayments.textContent = formatMoney(totalRepayments);

    }
}


// ============================================
// 22. REFRESH ALL ADMIN DISPLAYS
// ============================================

function refreshDisplays() {

    displayStudents();

    displayTransactions();

    displayCredits();

    updateReports();

}


// ============================================
// 23. STUDENT PORTAL
// ============================================

async function loadStudentPortal(uid, student) {

    const nameDisplay = document.getElementById("student-name-display");

    const admissionDisplay = document.getElementById("student-admission-display");

    const classDisplay = document.getElementById("student-class-display");

    const balanceDisplay = document.getElementById("student-balance");


    if (nameDisplay) {

        nameDisplay.textContent = student.name;

    }


    if (admissionDisplay) {

        admissionDisplay.textContent = student.admission;

    }


    if (classDisplay) {

        classDisplay.textContent = student.studentClass;

    }


    // LOAD ONLY THE SIGNED-IN STUDENT'S BALANCE

    const balanceDocument = await getDoc(
        doc(db, "balances", uid)
    );


    let balance = 0;


    if (balanceDocument.exists()) {

        balance = Number(balanceDocument.data().balance || 0);

    }


    if (balanceDisplay) {

        balanceDisplay.textContent = formatMoney(balance);

    }


    // LOAD STUDENT DIRECTORY

    await displayStudentDirectory();

}


// ============================================
// 24. STUDENT DIRECTORY
// ============================================

async function displayStudentDirectory() {

    const directory = document.getElementById(
        "student-directory-list"
    );


    if (!directory) return;


    directory.innerHTML = "";


    const snapshot = await getDocs(
        collection(db, "students")
    );


    const directoryStudents = snapshot.docs.map(document => {

        return document.data();

    });


    directoryStudents.sort((a, b) => {

        return String(a.name || "").localeCompare(String(b.name || ""));

    });


    if (directoryStudents.length === 0) {

        directory.innerHTML = `
            <tr>
                <td colspan="3">No students found.</td>
            </tr>
        `;

        return;
    }


    directoryStudents.forEach(student => {

        const row = document.createElement("tr");


        row.innerHTML = `
            <td>${escapeHTML(student.admission)}</td>

            <td>${escapeHTML(student.name)}</td>

            <td>${escapeHTML(student.studentClass)}</td>
        `;


        directory.appendChild(row);

    });

}


// ============================================
// 25. INITIAL MESSAGE
// ============================================

console.log("Smart Canteen Manager Firebase script loaded.");
