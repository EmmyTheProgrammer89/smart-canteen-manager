```javascript
// ============================================
// SMART CANTEEN MANAGER
// FIREBASE VERSION
// STUDENT SELF-REGISTRATION + ACCOUNT LINKING
// STUDENT PURCHASE HISTORY + STATISTICS
// ============================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";


// ============================================
// 1. CONFIGURATION
// ============================================

const ADMIN_UID = "mRLoouOWj4Ng4phNGB7e6QAaNY32";


// ============================================
// 2. HTML ELEMENTS
// ============================================

const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");

const registerScreen = document.getElementById("student-register-screen");
const registerForm = document.getElementById("student-register-form");
const registerMessage = document.getElementById("register-message");

const linkScreen = document.getElementById("student-link-screen");
const linkForm = document.getElementById("student-link-form");
const linkMessage = document.getElementById("link-message");

const showRegisterButton = document.getElementById("show-register-button");
const backToLoginButton = document.getElementById("back-to-login");
const linkLogoutButton = document.getElementById("link-logout-button");

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

const statisticsPeriod = document.getElementById("statistics-period");


// ============================================
// 3. APPLICATION DATA
// ============================================

let students = [];
let balances = {};
let transactions = [];

let registrationInProgress = false;


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
    if (loginMessage) {
        loginMessage.textContent = message;
    }
}


function showRegisterMessage(message) {
    if (registerMessage) {
        registerMessage.textContent = message;
    }
}


function showLinkMessage(message) {
    if (linkMessage) {
        linkMessage.textContent = message;
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
    registerScreen.hidden = true;

    if (linkScreen) {
        linkScreen.hidden = true;
    }

    adminApp.hidden = true;
    studentApp.hidden = true;
}


function showRegister() {

    loginScreen.hidden = true;
    registerScreen.hidden = false;

    if (linkScreen) {
        linkScreen.hidden = true;
    }

    adminApp.hidden = true;
    studentApp.hidden = true;
}


function showLink() {

    loginScreen.hidden = true;
    registerScreen.hidden = true;

    if (linkScreen) {
        linkScreen.hidden = false;
    }

    adminApp.hidden = true;
    studentApp.hidden = true;
}


function showAdmin() {

    loginScreen.hidden = true;
    registerScreen.hidden = true;

    if (linkScreen) {
        linkScreen.hidden = true;
    }

    adminApp.hidden = false;
    studentApp.hidden = true;
}


function showStudent() {

    loginScreen.hidden = true;
    registerScreen.hidden = true;

    if (linkScreen) {
        linkScreen.hidden = true;
    }

    adminApp.hidden = true;
    studentApp.hidden = false;
}


function getStudentByAdmission(admission) {

    return students.find(student => {
        return student.admission === admission;
    });
}


function getBalanceByUid(uid) {

    if (!uid) {
        return {
            balance: 0,
            creditBalance: 0
        };
    }

    return balances[uid] || {
        balance: 0,
        creditBalance: 0
    };
}


function getDateValue(transaction) {

    if (transaction.date) {

        const date = new Date(transaction.date);

        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    if (transaction.createdAt?.toDate) {
        return transaction.createdAt.toDate();
    }

    return new Date(0);
}


function formatDate(transaction) {

    const date = getDateValue(transaction);

    if (date.getTime() === 0) {
        return "Unknown date";
    }

    return date.toLocaleString();
}


function getTransactionProduct(transaction) {

    if (transaction.product) {
        return String(transaction.product).trim();
    }

    // Support older purchase records.

    const type = String(transaction.type || "");

    if (type.startsWith("Purchase:")) {
        return type.substring("Purchase:".length).trim();
    }

    if (type.startsWith("Credit:")) {
        return type.substring("Credit:".length).trim();
    }

    return "Unknown product";
}


function isPurchaseTransaction(transaction) {

    const type = String(transaction.type || "").toLowerCase();

    return (
        type === "purchase" ||
        type === "credit purchase" ||
        type.startsWith("purchase:") ||
        type.startsWith("credit:")
    );
}


function isCreditPurchase(transaction) {

    const type = String(transaction.type || "").toLowerCase();

    return (
        type === "credit purchase" ||
        type.startsWith("credit:")
    );
}


// ============================================
// 5. LOGIN AND REGISTRATION SCREEN BUTTONS
// ============================================

if (showRegisterButton) {

    showRegisterButton.addEventListener("click", function() {

        showRegister();
        showRegisterMessage("");
    });
}


if (backToLoginButton) {

    backToLoginButton.addEventListener("click", function() {

        showLogin();
        showError("");
    });
}


// ============================================
// 6. STUDENT SELF-REGISTRATION
// ============================================

if (registerForm) {

    registerForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const admission = getValue("register-admission");
        const email = getValue("register-email").toLowerCase();
        const password = getValue("register-password");
        const confirmPassword = getValue("register-confirm-password");

        if (!admission || !email || !password || !confirmPassword) {

            showRegisterMessage("Please complete all fields.");
            return;
        }

        if (password.length < 6) {

            showRegisterMessage(
                "Your password must contain at least 6 characters."
            );

            return;
        }

        if (password !== confirmPassword) {

            showRegisterMessage("The passwords do not match.");
            return;
        }

        try {

            showRegisterMessage("Creating your account...");

            registrationInProgress = true;

            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            await sendEmailVerification(userCredential.user);

            registrationInProgress = false;

            await signOut(auth);

            registerForm.reset();

            showLogin();

            showError(
                "Account created. Check your email and verify your address before logging in. Your admission number is " +
                admission + "."
            );

        } catch (error) {

            registrationInProgress = false;

            console.error("Student registration error:", error);

            if (error.code === "auth/email-already-in-use") {

                showRegisterMessage(
                    "This email already has an account. Please log in."
                );

            } else if (error.code === "auth/invalid-email") {

                showRegisterMessage("Please enter a valid email address.");

            } else if (error.code === "auth/weak-password") {

                showRegisterMessage("Please choose a stronger password.");

            } else {

                showRegisterMessage(
                    "Could not create your account: " + error.message
                );
            }
        }
    });
}


// ============================================
// 7. LOGIN AND LOGOUT
// ============================================

if (loginForm) {

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
}


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


if (linkLogoutButton) {
    linkLogoutButton.addEventListener("click", logoutUser);
}


// ============================================
// 8. CHECK SIGNED-IN USER
// ============================================

onAuthStateChanged(auth, async function(user) {

    if (!user) {

        showLogin();
        return;
    }


    // ADMINISTRATOR

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


    // ACCOUNT CREATION IN PROGRESS

    if (registrationInProgress) {
        return;
    }


    // STUDENT EMAIL VERIFICATION

    if (!user.emailVerified) {

        showLogin();

        showError(
            "Please verify your email address before logging in."
        );

        await signOut(auth);

        return;
    }


    // FIND LINKED STUDENT

    try {

        const studentQuery = query(
            collection(db, "students"),
            where("authUid", "==", user.uid)
        );

        const studentSnapshot = await getDocs(studentQuery);

        if (studentSnapshot.empty) {

            showLink();

            showLinkMessage(
                "Your email is verified. Enter your admission number to link your account."
            );

            return;
        }

        const student = {
            ...studentSnapshot.docs[0].data(),
            documentId: studentSnapshot.docs[0].id
        };

        showStudent();

        await loadStudentPortal(user.uid, student);

    } catch (error) {

        console.error("Student loading error:", error);

        alert(
            "Unable to load your student account. Check your internet connection and Firebase rules."
        );
    }
});


// ============================================
// 9. LINK VERIFIED STUDENT ACCOUNT
// ============================================

if (linkForm) {

    linkForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const user = auth.currentUser;
        const admission = getValue("link-admission");

        if (!user) {

            showLinkMessage("Please log in first.");
            return;
        }

        if (!user.emailVerified) {

            showLinkMessage("Please verify your email first.");
            return;
        }

        if (!admission) {

            showLinkMessage("Enter your admission number.");
            return;
        }

        try {

            showLinkMessage("Checking your student record...");

            const studentReference = doc(db, "students", admission);

            const invitationReference = doc(
                db,
                "studentInvitations",
                admission
            );

            const invitationSnapshot = await getDoc(invitationReference);

            if (!invitationSnapshot.exists()) {

                showLinkMessage(
                    "No approved registration was found. Check your admission number or contact the administrator."
                );

                return;
            }

            const invitation = invitationSnapshot.data();

            if (!invitation.approved || invitation.claimed) {

                showLinkMessage(
                    "This student invitation is not available for linking."
                );

                return;
            }

            if (
                String(invitation.email || "").toLowerCase() !==
                String(user.email || "").toLowerCase()
            ) {

                showLinkMessage(
                    "Your verified email does not match the email approved by the administrator."
                );

                return;
            }

            const studentSnapshot = await getDoc(studentReference);

            if (!studentSnapshot.exists()) {

                showLinkMessage("The student record could not be found.");
                return;
            }

            const student = studentSnapshot.data();

            if (student.authUid) {

                showLinkMessage(
                    "This student record is already linked to an account."
                );

                return;
            }

            const batch = writeBatch(db);

            batch.update(studentReference, {
                authUid: user.uid,
                linkedAt: serverTimestamp()
            });

            batch.update(invitationReference, {
                claimed: true,
                authUid: user.uid,
                claimedAt: serverTimestamp()
            });

            batch.set(
                doc(db, "balances", user.uid),
                {
                    admission: admission,
                    balance: 0,
                    creditBalance: 0
                }
            );

            await batch.commit();

            linkForm.reset();

            showLinkMessage("Account linked successfully.");

            alert("Your student account is now linked successfully.");

            const updatedStudent = {
                ...student,
                admission: admission,
                authUid: user.uid
            };

            showStudent();

            await loadStudentPortal(user.uid, updatedStudent);

        } catch (error) {

            console.error("Account linking error:", error);

            showLinkMessage(
                "Account linking failed. Check your Firebase security rules and try again."
            );
        }
    });
}


// ============================================
// 10. LOAD ADMINISTRATOR DATA
// ============================================

async function loadAdminData() {

    // STUDENTS

    const studentSnapshot = await getDocs(
        collection(db, "students")
    );

    students = studentSnapshot.docs.map(document => ({
        ...document.data(),
        documentId: document.id
    }));


    // BALANCES

    const balanceSnapshot = await getDocs(
        collection(db, "balances")
    );

    balances = {};

    balanceSnapshot.forEach(document => {

        balances[document.id] = document.data();
    });


    // TRANSACTIONS

    const transactionSnapshot = await getDocs(
        collection(db, "transactions")
    );

    transactions = transactionSnapshot.docs.map(document => ({
        ...document.data(),
        id: document.id
    }));


    // NEWEST FIRST

    transactions.sort((a, b) => {
        return getDateValue(b) - getDateValue(a);
    });
}


// ============================================
// 11. GENERATE ADMISSION NUMBER
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

    return "ASYV" + String(highestNumber + 1).padStart(3, "0");
}


// ============================================
// 12. FIND DUPLICATE INVITATION EMAIL
// ============================================

async function findInvitationByEmail(email) {

    const invitationQuery = query(
        collection(db, "studentInvitations"),
        where("email", "==", email)
    );

    const snapshot = await getDocs(invitationQuery);

    return !snapshot.empty;
}


// ============================================
// 13. ADMINISTRATOR STUDENT REGISTRATION
// ============================================

if (studentForm) {

    studentForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const name = getValue("student-name");
        const studentClass = getValue("student-class");
        const phone = getValue("phone");
        const email = getValue("student-email").toLowerCase();

        if (!name || !studentClass || !email) {

            alert("Please complete all required student information.");
            return;
        }

        try {

            const duplicateEmail = await findInvitationByEmail(email);

            if (duplicateEmail) {

                alert("This email already has a student invitation.");
                return;
            }

            const admission = generateAdmissionNumber();

            const batch = writeBatch(db);

            // PUBLIC STUDENT PROFILE

            batch.set(
                doc(db, "students", admission),
                {
                    admission: admission,
                    name: name,
                    studentClass: studentClass,
                    phone: phone,
                    authUid: null,
                    createdAt: serverTimestamp()
                }
            );

            // PRIVATE EMAIL INVITATION

            batch.set(
                doc(db, "studentInvitations", admission),
                {
                    admission: admission,
                    email: email,
                    approved: true,
                    claimed: false,
                    authUid: null,
                    createdAt: serverTimestamp()
                }
            );

            await batch.commit();

            alert(
                "Student registered successfully!\nAdmission number: " +
                admission
            );

            studentForm.reset();

            await loadAdminData();

            refreshDisplays();

        } catch (error) {

            console.error("Student registration error:", error);

            alert(
                "Could not register student. Check your Firestore rules and connection."
            );
        }
    });
}


// ============================================
// 14. DISPLAY STUDENTS
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
// 15. DELETE STUDENT
// ============================================

if (studentList) {

    studentList.addEventListener("click", async function(event) {

        const button = event.target.closest(".delete-student");

        if (!button) return;

        const admission = button.dataset.admission;

        const student = getStudentByAdmission(admission);

        if (!student) return;

        const financialRecord = getBalanceByUid(student.authUid);

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

            batch.delete(doc(db, "students", admission));

            batch.delete(
                doc(db, "studentInvitations", admission)
            );

            if (student.authUid) {

                batch.delete(
                    doc(db, "balances", student.authUid)
                );
            }

            await batch.commit();

            await loadAdminData();

            refreshDisplays();

            alert(
                "Student deleted. Transaction history has been preserved."
            );

        } catch (error) {

            console.error("Student deletion error:", error);

            alert("Could not delete this student.");
        }
    });
}


// ============================================
// 16. RECORD FINANCIAL TRANSACTION
// ============================================

async function recordFinancialTransaction(
    student,
    type,
    amount,
    newBalance,
    newCreditBalance,
    product = ""
) {

    if (!student.authUid) {

        throw new Error(
            "This student has not linked an account yet."
        );
    }

    const batch = writeBatch(db);

    const balanceReference = doc(
        db,
        "balances",
        student.authUid
    );

    const transactionReference = doc(
        collection(db, "transactions")
    );

    // UPDATE STUDENT BALANCE

    batch.set(balanceReference, {

        admission: student.admission,

        balance: newBalance,

        creditBalance: newCreditBalance

    });


    // SAVE TRANSACTION

    const transactionData = {

        admission: student.admission,

        studentName: student.name,

        type: type,

        amount: amount,

        date: new Date().toISOString(),

        createdAt: serverTimestamp()
    };

    if (product) {

        transactionData.product = product;
    }

    batch.set(transactionReference, transactionData);

    await batch.commit();

    await loadAdminData();

    refreshDisplays();
}


// ============================================
// 17. DEPOSIT MONEY
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

        if (!student.authUid) {

            alert("This student has not linked their account yet.");
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
// 18. MAKE NORMAL PURCHASE
// ============================================

if (purchaseForm) {

    purchaseForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const admission = getValue("purchase-student-id");

        const product = getValue("purchase-description");

        const amount = Number(getValue("purchase-amount"));

        const student = getStudentByAdmission(admission);

        if (!student) {

            alert("Please enter a valid student admission number.");
            return;
        }

        if (!student.authUid) {

            alert("This student has not linked their account yet.");
            return;
        }

        if (!product) {

            alert("Enter the product purchased.");
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
                "Purchase",
                amount,
                newBalance,
                Number(current.creditBalance || 0),
                product
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
// 19. RECORD CREDIT PURCHASE
// ============================================

if (creditForm) {

    creditForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const admission = getValue("credit-student-id");

        const product = getValue("credit-description");

        const amount = Number(getValue("credit-amount"));

        const student = getStudentByAdmission(admission);

        if (!student) {

            alert("Please enter a valid student admission number.");
            return;
        }

        if (!student.authUid) {

            alert("This student has not linked their account yet.");
            return;
        }

        if (!product) {

            alert("Enter the product purchased.");
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
                "Credit Purchase",
                amount,
                Number(current.balance || 0),
                newCreditBalance,
                product
            );

            creditForm.reset();

            alert("Credit purchase recorded successfully.");

        } catch (error) {

            console.error("Credit error:", error);

            alert("Could not record the credit purchase.");
        }
    });
}


// ============================================
// 20. RECORD CREDIT REPAYMENT
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

        if (!student.authUid) {

            alert("This student has not linked their account yet.");
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
// 21. DISPLAY TRANSACTION HISTORY
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
// 22. SELECT ALL TRANSACTIONS
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
// 23. DELETE SELECTED TRANSACTIONS
// ============================================

if (deleteSelectedTransactions) {

    deleteSelectedTransactions.addEventListener("click", async function() {

        const selected = document.querySelectorAll(
            ".transaction-checkbox:checked"
        );

        const selectedIds = Array.from(selected).map(checkbox => {
            return checkbox.value;
        });

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
// 24. DISPLAY OUTSTANDING CREDIT
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
// 25. UPDATE DASHBOARD AND FINANCIAL REPORTS
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

        if (isPurchaseTransaction(transaction) && !isCreditPurchase(transaction)) {
            totalSales += amount;
        }

        if (isCreditPurchase(transaction)) {
            totalCredit += amount;
        }

        if (type === "repayment") {
            totalRepayments += amount;
        }
    });


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


    const outstandingCredit = students.reduce((total, student) => {

        const financialRecord = getBalanceByUid(student.authUid);

        return total + Number(financialRecord.creditBalance || 0);

    }, 0);


    if (dashboardCredit) {

        dashboardCredit.textContent = formatMoney(outstandingCredit);
    }


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

        reportCredit.textContent = formatMoney(outstandingCredit);
    }

    if (reportRepayments) {

        reportRepayments.textContent = formatMoney(totalRepayments);
    }
}


// ============================================
// 26. STATISTICS DATE FILTER
// ============================================

function getStatisticsStartDate(period) {

    const now = new Date();

    const start = new Date(now);

    if (period === "daily") {

        start.setHours(0, 0, 0, 0);

        return start;
    }

    if (period === "weekly") {

        start.setHours(0, 0, 0, 0);

        const day = start.getDay();

        const difference = day === 0 ? 6 : day - 1;

        start.setDate(start.getDate() - difference);

        return start;
    }

    if (period === "monthly") {

        start.setDate(1);

        start.setHours(0, 0, 0, 0);

        return start;
    }

    return new Date(0);
}


// ============================================
// 27. CALCULATE STATISTICS
// ============================================

function updateStatistics() {

    const period = statisticsPeriod
        ? statisticsPeriod.value
        : "all";

    const startDate = getStatisticsStartDate(period);

    const purchaseTransactions = transactions.filter(transaction => {

        if (!isPurchaseTransaction(transaction)) {
            return false;
        }

        return getDateValue(transaction) >= startDate;
    });


    // FIRST BUYER

    const firstBuyerElement = document.getElementById("first-buyer");

    const firstBuyerDateElement = document.getElementById(
        "first-buyer-date"
    );

    const firstBuyer = [...purchaseTransactions].sort((a, b) => {

        return getDateValue(a) - getDateValue(b);

    })[0];


    if (firstBuyerElement) {

        firstBuyerElement.textContent = firstBuyer
            ? firstBuyer.studentName || firstBuyer.admission
            : "No purchases yet";
    }

    if (firstBuyerDateElement) {

        firstBuyerDateElement.textContent = firstBuyer
            ? formatDate(firstBuyer)
            : "";
    }


    // TOTAL BUYERS

    const uniqueBuyers = new Set(
        purchaseTransactions.map(transaction => transaction.admission)
    );

    const totalBuyersElement = document.getElementById(
        "statistics-total-buyers"
    );

    if (totalBuyersElement) {

        totalBuyersElement.textContent = uniqueBuyers.size;
    }


    // TOTAL PURCHASE RECORDS

    const totalPurchasesElement = document.getElementById(
        "statistics-total-purchases"
    );

    if (totalPurchasesElement) {

        totalPurchasesElement.textContent = purchaseTransactions.length;
    }


    // PRODUCT STATISTICS

    const productStatistics = {};

    purchaseTransactions.forEach(transaction => {

        const product = getTransactionProduct(transaction);

        const key = product.toLowerCase();

        if (!productStatistics[key]) {

            productStatistics[key] = {
                name: product,
                count: 0,
                total: 0
            };
        }

        productStatistics[key].count += 1;

        productStatistics[key].total += Number(transaction.amount || 0);
    });


    const popularProducts = Object.values(productStatistics).sort((a, b) => {

        return b.count - a.count || b.total - a.total;
    });


    // MOST BOUGHT PRODUCT

    const mostBoughtElement = document.getElementById(
        "most-bought-product"
    );

    const mostBoughtCountElement = document.getElementById(
        "most-bought-count"
    );

    if (mostBoughtElement) {

        mostBoughtElement.textContent = popularProducts.length > 0
            ? popularProducts[0].name
            : "No purchases yet";
    }

    if (mostBoughtCountElement) {

        mostBoughtCountElement.textContent = popularProducts.length > 0
            ? popularProducts[0].count + " purchase records"
            : "";
    }


    // POPULAR PRODUCTS TABLE

    const popularProductsList = document.getElementById(
        "popular-products-list"
    );

    if (popularProductsList) {

        popularProductsList.innerHTML = "";

        if (popularProducts.length === 0) {

            popularProductsList.innerHTML = `
                <tr>
                    <td colspan="4">No products purchased yet.</td>
                </tr>
            `;

        } else {

            popularProducts.forEach((product, index) => {

                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${index + 1}</td>

                    <td>${escapeHTML(product.name)}</td>

                    <td>${product.count}</td>

                    <td>${formatMoney(product.total)}</td>
                `;

                popularProductsList.appendChild(row);
            });
        }
    }


    // TOP BUYING STUDENTS

    const buyerStatistics = {};

    purchaseTransactions.forEach(transaction => {

        const admission = transaction.admission;

        if (!buyerStatistics[admission]) {

            buyerStatistics[admission] = {
                admission: admission,
                name: transaction.studentName || admission,
                count: 0,
                total: 0
            };
        }

        buyerStatistics[admission].count += 1;

        buyerStatistics[admission].total += Number(transaction.amount || 0);
    });


    const topBuyers = Object.values(buyerStatistics).sort((a, b) => {

        return b.count - a.count || b.total - a.total;
    });


    const topBuyersList = document.getElementById("top-buyers-list");

    if (topBuyersList) {

        topBuyersList.innerHTML = "";

        if (topBuyers.length === 0) {

            topBuyersList.innerHTML = `
                <tr>
                    <td colspan="5">No buyers recorded yet.</td>
                </tr>
            `;

        } else {

            topBuyers.forEach((buyer, index) => {

                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${index + 1}</td>

                    <td>${escapeHTML(buyer.admission)}</td>

                    <td>${escapeHTML(buyer.name)}</td>

                    <td>${buyer.count}</td>

                    <td>${formatMoney(buyer.total)}</td>
                `;

                topBuyersList.appendChild(row);
            });
        }
    }
}


// ============================================
// 28. STATISTICS FILTER EVENT
// ============================================

if (statisticsPeriod) {

    statisticsPeriod.addEventListener("change", function() {

        updateStatistics();
    });
}


// ============================================
// 29. REFRESH ALL ADMIN DISPLAYS
// ============================================

function refreshDisplays() {

    displayStudents();

    displayTransactions();

    displayCredits();

    updateReports();

    updateStatistics();
}


// ============================================
// 30. STUDENT PORTAL
// ============================================

async function loadStudentPortal(uid, student) {

    const nameDisplay = document.getElementById(
        "student-name-display"
    );

    const admissionDisplay = document.getElementById(
        "student-admission-display"
    );

    const classDisplay = document.getElementById(
        "student-class-display"
    );

    const balanceDisplay = document.getElementById(
        "student-balance"
    );

    const creditBalanceDisplay = document.getElementById(
        "student-credit-balance"
    );


    if (nameDisplay) {

        nameDisplay.textContent = student.name || "";
    }

    if (admissionDisplay) {

        admissionDisplay.textContent = student.admission || "";
    }

    if (classDisplay) {

        classDisplay.textContent = student.studentClass || "";
    }


    // LOAD PRIVATE WALLET

    const balanceDocument = await getDoc(
        doc(db, "balances", uid)
    );

    let balance = 0;

    let creditBalance = 0;

    if (balanceDocument.exists()) {

        const balanceData = balanceDocument.data();

        balance = Number(balanceData.balance || 0);

        creditBalance = Number(balanceData.creditBalance || 0);
    }


    if (balanceDisplay) {

        balanceDisplay.textContent = formatMoney(balance);
    }

    if (creditBalanceDisplay) {

        creditBalanceDisplay.textContent = formatMoney(creditBalance);
    }


    // LOAD STUDENT PURCHASE HISTORY

    await displayStudentPurchaseHistory(student.admission);


    // LOAD STUDENT DIRECTORY

    await displayStudentDirectory();
}


// ============================================
// 31. STUDENT PURCHASE HISTORY - READ ONLY
// ============================================

async function displayStudentPurchaseHistory(admission) {

    const historyList = document.getElementById(
        "student-purchase-history-list"
    );

    const totalSpentElement = document.getElementById(
        "student-total-spent"
    );

    if (!historyList) return;

    historyList.innerHTML = `
        <tr>
            <td colspan="4">Loading purchase history...</td>
        </tr>
    `;

    try {

        const studentTransactionsQuery = query(
            collection(db, "transactions"),
            where("admission", "==", admission)
        );

        const snapshot = await getDocs(studentTransactionsQuery);

        const studentTransactions = snapshot.docs.map(document => {
            return {
                ...document.data(),
                id: document.id
            };
        });


        // ONLY PURCHASES AND CREDIT PURCHASES

        const purchases = studentTransactions
            .filter(isPurchaseTransaction)
            .sort((a, b) => getDateValue(b) - getDateValue(a));


        historyList.innerHTML = "";

        let totalSpent = 0;

        purchases.forEach(transaction => {

            const amount = Number(transaction.amount || 0);

            totalSpent += amount;

            const purchaseType = isCreditPurchase(transaction)
                ? "Credit Purchase"
                : "Wallet Purchase";

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(getTransactionProduct(transaction))}</td>

                <td>${purchaseType}</td>

                <td>${formatMoney(amount)}</td>

                <td>${escapeHTML(formatDate(transaction))}</td>
            `;

            historyList.appendChild(row);
        });


        if (purchases.length === 0) {

            historyList.innerHTML = `
                <tr>
                    <td colspan="4">You have no recorded purchases yet.</td>
                </tr>
            `;
        }


        if (totalSpentElement) {

            totalSpentElement.textContent = formatMoney(totalSpent);
        }

    } catch (error) {

        console.error("Student purchase history error:", error);

        historyList.innerHTML = `
            <tr>
                <td colspan="4">
                    Unable to load purchase history.
                </td>
            </tr>
        `;
    }
}


// ============================================
// 32. STUDENT DIRECTORY
// ============================================

async function displayStudentDirectory() {

    const directory = document.getElementById(
        "student-directory-list"
    );

    if (!directory) return;

    directory.innerHTML = "";

    try {

        const snapshot = await getDocs(
            collection(db, "students")
        );

        const directoryStudents = snapshot.docs.map(document => {
            return document.data();
        });

        directoryStudents.sort((a, b) => {

            return String(a.name || "").localeCompare(
                String(b.name || "")
            );
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

    } catch (error) {

        console.error("Student directory error:", error);

        directory.innerHTML = `
            <tr>
                <td colspan="3">Unable to load student directory.</td>
            </tr>
        `;
    }
}


// ============================================
// 33. APPLICATION READY
// ============================================

console.log(
    "Smart Canteen Manager Firebase application loaded successfully."
);
```
