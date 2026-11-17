// ============================================
// SMART CANTEEN MANAGER
// FIREBASE VERSION
// STUDENT SELF-REGISTRATION + ACCOUNT LINKING
// STUDENT PURCHASE HISTORY + STATISTICS
// ============================================

import { auth, db } from "./firebase.js";
import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    getAuth,
    inMemoryPersistence,
    setPersistence
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    writeBatch,
    runTransaction,
    updateDoc,
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
const admissionInput = document.getElementById("admission");

const depositForm = document.getElementById("deposit-form");
const purchaseForm = document.getElementById("purchase-form");
const orderItemsContainer = document.getElementById("order-items-container");
const addOrderItemButton = document.getElementById("add-order-item-button");
const orderTotalElement = document.getElementById("order-total");
const pendingOrdersList = document.getElementById("pending-orders-list");
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
const feedbackForm = document.getElementById("feedback-form");
const feedbackList = document.getElementById("feedback-list");
const feedbackStatus = document.getElementById("feedback-status");


// ============================================
// 3. APPLICATION DATA
// ============================================

let students = [];
let balances = {};
let transactions = [];
let orders = [];
let ordersLoadError = false;
let feedbacks = [];

let registrationInProgress = false;
let currentStudentUid = null;
let studentSearchTerm = "";

// A separate in-memory Firebase Auth session verifies the student's password
// without signing the administrator out of the seller dashboard.
const passwordCheckApp = getApps().find(app => app.name === "purchase-password-check") || initializeApp(
    getApp().options,
    "purchase-password-check"
);
const passwordCheckAuth = getAuth(passwordCheckApp);
let passwordCheckPersistenceReady = setPersistence(
    passwordCheckAuth,
    inMemoryPersistence
);


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
    linkScreen.hidden = true;
    adminApp.hidden = true;
    studentApp.hidden = true;
}


function showRegister() {
    loginScreen.hidden = true;
    registerScreen.hidden = false;
    linkScreen.hidden = true;
    adminApp.hidden = true;
    studentApp.hidden = true;
}


function showLink() {
    loginScreen.hidden = true;
    registerScreen.hidden = true;
    linkScreen.hidden = false;
    adminApp.hidden = true;
    studentApp.hidden = true;
}


function showAdmin() {
    loginScreen.hidden = true;
    registerScreen.hidden = true;
    linkScreen.hidden = true;
    adminApp.hidden = false;
    studentApp.hidden = true;
}


function showStudent() {
    loginScreen.hidden = true;
    registerScreen.hidden = true;
    linkScreen.hidden = true;
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
// STUDENT PASSWORD VERIFICATION + MONTHLY BONUS
// ============================================

async function verifyStudentPurchasePassword(student, password) {
    if (!password || password.length < 6) {
        throw new Error("PASSWORD_REQUIRED");
    }

    const invitationSnapshot = await getDoc(
        doc(db, "studentInvitations", student.admission)
    );

    if (!invitationSnapshot.exists()) throw new Error("STUDENT_EMAIL_NOT_FOUND");

    const invitation = invitationSnapshot.data();
    if (!invitation.approved || !invitation.claimed || invitation.authUid !== student.authUid) {
        throw new Error("STUDENT_ACCOUNT_NOT_LINKED");
    }

    await passwordCheckPersistenceReady;
    try {
        await signInWithEmailAndPassword(passwordCheckAuth, invitation.email, password);
        if (passwordCheckAuth.currentUser?.uid !== student.authUid) {
            throw new Error("WRONG_STUDENT_ACCOUNT");
        }
    } finally {
        if (passwordCheckAuth.currentUser) await signOut(passwordCheckAuth);
    }
}
function currentMonthKey(date = new Date()) {
    // Always use Rwanda local calendar months (Africa/Kigali).
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Kigali",
        year: "numeric",
        month: "2-digit"
    }).formatToParts(date);

    const year = parts.find(part => part.type === "year").value;
    const month = parts.find(part => part.type === "month").value;
    return `${year}-${month}`;
}

async function maybeAwardMonthlyPurchaseBonus(student, knownMonthlySpend = null) {
    if (!student?.authUid || !student?.admission) return false;

    const monthKey = currentMonthKey(new Date());
    let monthlySpend = knownMonthlySpend === null || knownMonthlySpend === undefined
        ? Number.NaN
        : Number(knownMonthlySpend);

    // When no pre-calculated total is supplied, calculate this student's
    // completed purchases for the current Rwanda calendar month.
    if (!Number.isFinite(monthlySpend)) {
        const completedOrdersQuery = query(
            collection(db, "orders"),
            where("admission", "==", student.admission),
            where("status", "==", "Completed")
        );
        const completedOrdersSnapshot = await getDocs(completedOrdersQuery);

        // Deposits, credit purchases, pending orders and preparing orders
        // are deliberately excluded.
        monthlySpend = completedOrdersSnapshot.docs.reduce((sum, item) => {
            const order = item.data();
            const completedAt = order.completedAt?.toDate
                ? order.completedAt.toDate()
                : order.completedAt
                    ? new Date(order.completedAt)
                    : null;

            if (!completedAt || Number.isNaN(completedAt.getTime())) return sum;
            if (currentMonthKey(completedAt) !== monthKey) return sum;

            const amount = Number(order.total || 0);
            return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
        }, 0);
    }

    if (monthlySpend < 70000) return false;

    const bonusId = `${student.authUid}_${monthKey}`;
    const bonusReference = doc(db, "monthlyBonuses", bonusId);
    const balanceReference = doc(db, "balances", student.authUid);
    const bonusTransactionReference = doc(collection(db, "transactions"));

    return await runTransaction(db, async function(firebaseTransaction) {
        const bonusSnapshot = await firebaseTransaction.get(bonusReference);
        if (bonusSnapshot.exists()) return false;

        const balanceSnapshot = await firebaseTransaction.get(balanceReference);
        if (!balanceSnapshot.exists()) throw new Error("BALANCE_NOT_FOUND");

        const currentBalance = Number(balanceSnapshot.data().balance || 0);
        const currentCredit = Number(balanceSnapshot.data().creditBalance || 0);

        firebaseTransaction.update(balanceReference, {
            balance: currentBalance + 5000,
            creditBalance: currentCredit
        });
        firebaseTransaction.set(bonusReference, {
            uid: student.authUid,
            admission: student.admission,
            month: monthKey,
            target: 70000,
            purchaseTotal: monthlySpend,
            bonusAmount: 5000,
            acknowledged: false,
            createdAt: serverTimestamp()
        });
        firebaseTransaction.set(bonusTransactionReference, {
            admission: student.admission,
            studentName: student.name,
            type: "Monthly Bonus",
            product: "Monthly purchase target reward",
            amount: 5000,
            month: monthKey,
            date: new Date().toISOString(),
            createdAt: serverTimestamp()
        });
        return true;
    });
}

async function retryPendingMonthlyBonuses() {
    const monthKey = currentMonthKey(new Date());
    const totalsByAdmission = {};

    // Reuse the orders already loaded for the admin dashboard. This avoids
    // making a separate Firestore query for every student on each login.
    orders.forEach(order => {
        if (order.status !== "Completed") return;

        const completedAt = order.completedAt?.toDate
            ? order.completedAt.toDate()
            : order.completedAt
                ? new Date(order.completedAt)
                : null;

        if (!completedAt || Number.isNaN(completedAt.getTime())) return;
        if (currentMonthKey(completedAt) !== monthKey) return;

        const amount = Number(order.total || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;

        totalsByAdmission[order.admission] =
            (totalsByAdmission[order.admission] || 0) + amount;
    });

    let awardedAnyBonus = false;

    for (const student of students) {
        const total = totalsByAdmission[student.admission] || 0;
        if (total < 70000) continue;

        try {
            const awarded = await maybeAwardMonthlyPurchaseBonus(student, total);
            if (awarded) awardedAnyBonus = true;
        } catch (error) {
            // One failed award should not stop other eligible students.
            console.error(`Monthly bonus retry failed for ${student.admission}:`, error);
        }
    }

    return awardedAnyBonus;
}


async function showPendingMonthlyBonus(uid) {
    // Check all months so an unacknowledged message does not disappear
    // merely because the calendar month has changed.
    const bonusQuery = query(
        collection(db, "monthlyBonuses"),
        where("uid", "==", uid)
    );
    const bonusSnapshot = await getDocs(bonusQuery);
    const pendingBonus = bonusSnapshot.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .filter(item => item.acknowledged !== true)
        .sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")))[0];

    if (!pendingBonus) return;

    const bonusReference = doc(db, "monthlyBonuses", pendingBonus.id);
    const modal = document.getElementById("monthly-bonus-modal");
    const okButton = document.getElementById("bonus-modal-ok");
    if (!modal || !okButton) return;

    modal.hidden = false;
    okButton.onclick = async function() {
        okButton.disabled = true;
        try {
            await updateDoc(bonusReference, { acknowledged: true, acknowledgedAt: serverTimestamp() });
            modal.hidden = true;
        } catch (error) {
            console.error("Could not acknowledge bonus:", error);
            alert("The message could not be closed yet. Please try again.");
        } finally {
            okButton.disabled = false;
        }
    };
}


// ============================================
// 5. ADMISSION NUMBER GENERATION
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


function updateAdmissionPreview() {

    if (!admissionInput) return;

    admissionInput.value = generateAdmissionNumber();
}


// ============================================
// 6. LOGIN AND REGISTRATION SCREEN BUTTONS
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
// 7. STUDENT SELF-REGISTRATION
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

            await signOut(auth);

            registrationInProgress = false;

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
// 8. LOGIN AND LOGOUT
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
        orders = [];
        currentStudentUid = null;

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
// 9. LOAD ADMINISTRATOR DATA
// ============================================

async function loadAdminData() {

    const studentSnapshot = await getDocs(
        collection(db, "students")
    );

    students = studentSnapshot.docs.map(document => ({
        ...document.data(),
        documentId: document.id
    }));


    const balanceSnapshot = await getDocs(
        collection(db, "balances")
    );

    balances = {};

    balanceSnapshot.forEach(document => {
        balances[document.id] = document.data();
    });


    const transactionSnapshot = await getDocs(
        collection(db, "transactions")
    );

    transactions = transactionSnapshot.docs.map(document => ({
        ...document.data(),
        id: document.id
    }));


    transactions.sort((a, b) => {
        return getDateValue(b) - getDateValue(a);
    });


    // Load customer orders for the administrator order queue.
    try {
        const orderSnapshot = await getDocs(
            collection(db, "orders")
        );

        orders = orderSnapshot.docs.map(document => ({
            ...document.data(),
            id: document.id
        }));

        orders.sort((a, b) => getDateValue(b) - getDateValue(a));
        ordersLoadError = false;

    } catch (orderError) {
        // Keep the existing dashboard available if the new collection's
        // Firestore rules have not been configured yet.
        console.error("Could not load orders. Check Firestore rules:", orderError);
        orders = [];
        ordersLoadError = true;
    }


    // Load feedback submitted by students
    const feedbackSnapshot = await getDocs(
        collection(db, "feedback")
    );

    feedbacks = feedbackSnapshot.docs.map(document => ({
        ...document.data(),
        id: document.id
    }));

    feedbacks.sort((a, b) => {
        return getDateValue(b) - getDateValue(a);
    });


    updateAdmissionPreview();
}
// ============================================
// 10. CHECK SIGNED-IN USER
// ============================================

onAuthStateChanged(auth, async function(user) {

    if (!user) {
        currentStudentUid = null;
        showLogin();
        return;
    }


    if (user.uid === ADMIN_UID) {

        currentStudentUid = null;

        showAdmin();

        try {

            await loadAdminData();

            // Retry eligible monthly rewards in case a previous award attempt
            // failed after an order was marked Completed.
            const bonusWasAwarded = await retryPendingMonthlyBonuses();
            if (bonusWasAwarded) {
                await loadAdminData();
            }

            refreshDisplays();

        } catch (error) {

            console.error("Admin loading error:", error);

            alert(
                "Could not load administrator data. Check your Firebase rules and connection."
            );
        }

        return;
    }


    if (registrationInProgress) {
        return;
    }


    if (!user.emailVerified) {

        showLogin();

        showError(
            "Please verify your email address before logging in."
        );

        await signOut(auth);

        return;
    }


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

        currentStudentUid = user.uid;

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
// 11. LINK VERIFIED STUDENT ACCOUNT
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

            const updatedStudent = {
                ...student,
                admission: admission,
                authUid: user.uid
            };

            currentStudentUid = user.uid;

            showStudent();

            await loadStudentPortal(user.uid, updatedStudent);

            alert("Your student account is now linked successfully.");

        } catch (error) {

            console.error("Account linking error:", error);

            showLinkMessage(
                "Account linking failed. Check your Firebase security rules and try again."
            );
        }
    });
}


// ============================================
// 12. ADMINISTRATOR STUDENT REGISTRATION
// ============================================

async function findInvitationByEmail(email) {

    const invitationQuery = query(
        collection(db, "studentInvitations"),
        where("email", "==", email)
    );

    const snapshot = await getDocs(invitationQuery);

    return !snapshot.empty;
}


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
// 13. DISPLAY STUDENTS
// ============================================

const studentSearchInput = document.getElementById("student-search");

if (studentSearchInput) {
    studentSearchInput.addEventListener("input", function() {
        studentSearchTerm = studentSearchInput.value.trim();
        displayStudents();
    });
}


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


    const visibleStudents = students.filter(student => {
        const search = studentSearchTerm.toLowerCase();

        return !search ||
            String(student.name || "").toLowerCase().includes(search) ||
            String(student.admission || "").toLowerCase().includes(search);
    });

    if (visibleStudents.length === 0) {
        studentList.innerHTML = `
            <tr><td colspan="6">No matching students found.</td></tr>
        `;
        return;
    }

    visibleStudents.forEach(student => {

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
// 14. DELETE STUDENT
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
// 15. RECORD FINANCIAL TRANSACTION
// ============================================

async function recordFinancialTransaction(
    student,
    type,
    amount,
    product = ""
) {
    if (!student?.authUid) {
        throw new Error("This student has not linked an account yet.");
    }

    const numericAmount = Number(amount);

    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
        throw new Error("Enter a valid whole-number amount.");
    }

    const balanceReference = doc(db, "balances", student.authUid);
    const transactionReference = doc(collection(db, "transactions"));

    // Read the latest balance inside the transaction. This prevents two
    // simultaneous deposits/repayments from overwriting each other's changes.
    await runTransaction(db, async function(firebaseTransaction) {

        const balanceSnapshot = await firebaseTransaction.get(balanceReference);

        const currentData = balanceSnapshot.exists()
            ? balanceSnapshot.data()
            : {};

        let currentBalance = Number(currentData.balance || 0);
        let currentCreditBalance = Number(currentData.creditBalance || 0);

        if (!Number.isFinite(currentBalance) || currentBalance < 0) {
            throw new Error("The student's wallet balance is invalid.");
        }

        if (!Number.isFinite(currentCreditBalance) || currentCreditBalance < 0) {
            throw new Error("The student's credit balance is invalid.");
        }

        if (type === "Deposit") {

            currentBalance += numericAmount;

        } else if (type === "Credit Purchase") {

            currentCreditBalance += numericAmount;

        } else if (type === "Repayment") {

            if (numericAmount > currentCreditBalance) {
                throw new Error("REPAYMENT_EXCEEDS_CREDIT");
            }

            currentCreditBalance -= numericAmount;

        } else {

            throw new Error(`Unsupported financial transaction type: ${type}`);
        }

        firebaseTransaction.set(balanceReference, {
            admission: student.admission,
            balance: currentBalance,
            creditBalance: currentCreditBalance
        });

        const transactionData = {
            admission: student.admission,
            studentName: student.name,
            type,
            amount: numericAmount,
            date: new Date().toISOString(),
            createdAt: serverTimestamp()
        };

        if (product) transactionData.product = product;

        firebaseTransaction.set(transactionReference, transactionData);
    });

    await loadAdminData();

    refreshDisplays();
}


// ============================================
// 16. DEPOSIT MONEY
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

            await recordFinancialTransaction(
                student,
                "Deposit",
                amount
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
// 17. MULTI-ITEM CUSTOMER ORDERS
// ============================================

function addOrderItemRow() {

    if (!orderItemsContainer) return;

    const row = document.createElement("div");
    row.className = "order-item-row";

    row.innerHTML = `
        <div>
            <label>Product name</label>
            <input type="text" class="order-product" placeholder="e.g. Bread" required>
        </div>
        <div>
            <label>Unit price (RWF)</label>
            <input type="number" class="order-unit-price" min="1" step="1" placeholder="e.g. 500" required>
        </div>
        <div>
            <label>Quantity</label>
            <input type="number" class="order-quantity" min="1" step="1" value="1" required>
        </div>
        <button type="button" class="remove-order-item">Remove</button>
    `;

    orderItemsContainer.appendChild(row);
    updateOrderTotal();
}


function readOrderItems() {

    if (!orderItemsContainer) return [];

    const rows = Array.from(
        orderItemsContainer.querySelectorAll(".order-item-row")
    );

    return rows.map(row => {

        const product = row.querySelector(".order-product").value.trim();
        const unitPrice = Number(row.querySelector(".order-unit-price").value);
        const quantity = Number(row.querySelector(".order-quantity").value);

        return {
            product,
            unitPrice,
            quantity,
            lineTotal: unitPrice * quantity
        };
    });
}


function updateOrderTotal() {

    if (!orderTotalElement) return;

    const items = readOrderItems();
    const total = items.reduce((sum, item) => {
        if (Number.isFinite(item.lineTotal) && item.lineTotal > 0) {
            return sum + item.lineTotal;
        }
        return sum;
    }, 0);

    orderTotalElement.textContent = formatMoney(total);
}


if (addOrderItemButton) {
    addOrderItemButton.addEventListener("click", addOrderItemRow);
}


if (orderItemsContainer) {

    orderItemsContainer.addEventListener("input", updateOrderTotal);

    orderItemsContainer.addEventListener("click", function(event) {

        const removeButton = event.target.closest(".remove-order-item");
        if (!removeButton) return;

        const rows = orderItemsContainer.querySelectorAll(".order-item-row");

        if (rows.length <= 1) {
            alert("An order must contain at least one product.");
            return;
        }

        removeButton.closest(".order-item-row").remove();
        updateOrderTotal();
    });

    addOrderItemRow();
}


if (purchaseForm) {

    purchaseForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const admission = getValue("purchase-student-id");
        const studentPassword = document.getElementById("purchase-student-password")?.value || "";
        const student = getStudentByAdmission(admission);
        const items = readOrderItems();

        if (!student) {
            alert("Please enter a valid student admission number.");
            return;
        }

        if (!student.authUid) {
            alert("This student has not linked their account yet.");
            return;
        }

        try {
            await verifyStudentPurchasePassword(student, studentPassword);
        } catch (passwordError) {
            console.error("Purchase password verification failed:", passwordError);
            alert(passwordError.code === "auth/invalid-credential" || passwordError.code === "auth/wrong-password"
                ? "Incorrect student password. The purchase was not submitted."
                : passwordError.message === "PASSWORD_REQUIRED"
                    ? "Ask the student to enter their account password."
                    : "Could not verify this student's account. Check the account link and try again.");
            return;
        }

        if (items.length === 0) {
            alert("Add at least one product to the order.");
            return;
        }

        const invalidItem = items.find(item => (
            !item.product ||
            !Number.isSafeInteger(item.unitPrice) || item.unitPrice <= 0 ||
            !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
            !Number.isSafeInteger(item.lineTotal) || item.lineTotal <= 0
        ));

        if (invalidItem) {
            alert("Check every product name, unit price and quantity. Prices and quantities must be positive whole numbers.");
            return;
        }

        const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

        if (!Number.isSafeInteger(total) || total <= 0) {
            alert("The order total is invalid.");
            return;
        }

        if (!confirm(
            "Submit this order for " + formatMoney(total) +
            "? The amount will be deducted from the student's wallet."
        )) {
            return;
        }

        const balanceReference = doc(db, "balances", student.authUid);
        const orderReference = doc(collection(db, "orders"));
        const transactionReferences = items.map(() => doc(collection(db, "transactions")));

        try {

            const submitButton = document.getElementById("submit-order-button");
            if (submitButton) submitButton.disabled = true;

            await runTransaction(db, async function(firebaseTransaction) {

                const balanceSnapshot = await firebaseTransaction.get(balanceReference);

                if (!balanceSnapshot.exists()) {
                    throw new Error("BALANCE_NOT_FOUND");
                }

                const currentBalanceData = balanceSnapshot.data();
                const currentBalance = Number(currentBalanceData.balance || 0);
                const currentCreditBalance = Number(currentBalanceData.creditBalance || 0);

                if (currentBalance < total) {
                    throw new Error("INSUFFICIENT_BALANCE");
                }

                firebaseTransaction.update(balanceReference, {
                    balance: currentBalance - total,
                    creditBalance: currentCreditBalance,
                    admission: student.admission
                });

                firebaseTransaction.set(orderReference, {
                    admission: student.admission,
                    studentName: student.name,
                    studentUid: student.authUid,
                    items: items.map(item => ({
                        product: item.product,
                        unitPrice: item.unitPrice,
                        quantity: item.quantity,
                        lineTotal: item.lineTotal
                    })),
                    total: total,
                    status: "Pending",
                    date: new Date().toISOString(),
                    createdAt: serverTimestamp()
                });

                items.forEach((item, index) => {

                    firebaseTransaction.set(transactionReferences[index], {
                        admission: student.admission,
                        studentName: student.name,
                        type: "Purchase",
                        product: item.product,
                        quantity: item.quantity,
                        amount: item.lineTotal,
                        orderId: orderReference.id,
                        date: new Date().toISOString(),
                        createdAt: serverTimestamp()
                    });
                });
            });

            await loadAdminData();
            refreshDisplays();

            purchaseForm.reset();
            orderItemsContainer.innerHTML = "";
            addOrderItemRow();
            updateOrderTotal();

            alert("Order submitted. It is now visible in Order Management.");

        } catch (error) {

            console.error("Order submission error:", error);

            if (error.message === "INSUFFICIENT_BALANCE") {
                alert("Insufficient wallet balance. The order was not submitted.");
            } else if (error.message === "BALANCE_NOT_FOUND") {
                alert("This student's wallet could not be found. Check the linked student account.");
            } else {
                alert("Could not submit the order. Check your internet connection and Firestore security rules.");
            }

        } finally {

            const submitButton = document.getElementById("submit-order-button");
            if (submitButton) submitButton.disabled = false;
        }
    });
}


// ============================================
// 17B. ADMINISTRATOR ORDER QUEUE
// ============================================

function displayOrders() {

    if (!pendingOrdersList) return;

    pendingOrdersList.innerHTML = "";

    if (ordersLoadError) {
        pendingOrdersList.innerHTML = `
            <tr><td colspan="6">Orders are unavailable. The Firestore rules must allow the administrator to read the orders collection.</td></tr>
        `;
        return;
    }

    if (orders.length === 0) {
        pendingOrdersList.innerHTML = `
            <tr><td colspan="6">No customer orders yet.</td></tr>
        `;
        return;
    }

    orders.forEach(order => {

        const row = document.createElement("tr");
        const status = String(order.status || "Pending");
        const statusClass = status.toLowerCase();
        const itemSummary = (Array.isArray(order.items) ? order.items : [])
            .map(item => `${escapeHTML(item.product)} × ${Number(item.quantity || 0)}`)
            .join("<br>");

        let action = "—";
        if (status === "Pending") {
            action = `<button type="button" class="order-action-button" data-order-id="${escapeHTML(order.id)}" data-next-status="Preparing">Start preparing</button>`;
        } else if (status === "Preparing") {
            action = `<button type="button" class="order-action-button" data-order-id="${escapeHTML(order.id)}" data-next-status="Completed">Mark handed over</button>`;
        }

        row.innerHTML = `
            <td>${escapeHTML(formatDate(order))}</td>
            <td>${escapeHTML(order.studentName || "")}<br><small>${escapeHTML(order.admission || "")}</small></td>
            <td>${itemSummary || "No item details"}</td>
            <td>${formatMoney(order.total)}</td>
            <td><span class="order-status ${escapeHTML(statusClass)}">${escapeHTML(status)}</span></td>
            <td>${action}</td>
        `;

        pendingOrdersList.appendChild(row);
    });
}


if (pendingOrdersList) {

    pendingOrdersList.addEventListener("click", async function(event) {

        const button = event.target.closest("[data-order-id][data-next-status]");
        if (!button) return;

        const orderId = button.dataset.orderId;
        const nextStatus = button.dataset.nextStatus;
        const order = orders.find(item => item.id === orderId);

        if (!order) return;

        const confirmation = nextStatus === "Completed"
            ? "Confirm that all products have been handed to the customer?"
            : "Move this order to Preparing?";

        if (!confirm(confirmation)) return;

        button.disabled = true;

        try {

            const orderUpdate = {
                status: nextStatus,
                updatedAt: serverTimestamp()
            };

            if (nextStatus === "Completed") {
                orderUpdate.completedAt = serverTimestamp();
            }

            await updateDoc(doc(db, "orders", orderId), orderUpdate);

            if (nextStatus === "Completed") {
                const orderStudent = getStudentByAdmission(order.admission);
                if (orderStudent) {
                    try {
                        await maybeAwardMonthlyPurchaseBonus(orderStudent);
                    } catch (bonusError) {
                        console.error("Monthly bonus calculation failed:", bonusError);
                        alert("The order was marked completed, but the monthly bonus could not be processed. Check Firestore rules.");
                    }
                }
            }

            await loadAdminData();
            refreshDisplays();

        } catch (error) {

            console.error("Order status update error:", error);
            alert("Could not update this order. Check Firestore security rules and try again.");
            button.disabled = false;
        }
    });
}


// ============================================
// ============================================
// 18. RECORD CREDIT PURCHASE
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

            await recordFinancialTransaction(
                student,
                "Credit Purchase",
                amount,
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
// 19. RECORD CREDIT REPAYMENT
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

        try {

            await recordFinancialTransaction(
                student,
                "Repayment",
                amount
            );

            repaymentForm.reset();

            alert("Credit repayment recorded successfully.");

        } catch (error) {

            console.error("Repayment error:", error);

            alert(error.message === "REPAYMENT_EXCEEDS_CREDIT"
                ? "The repayment cannot be greater than the student's current outstanding credit."
                : "Could not record the repayment. Check the connection and try again.");
        }
    });
}


// ============================================
// 20. DISPLAY TRANSACTION HISTORY
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
// 21. SELECT ALL TRANSACTIONS
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
// 22. DELETE SELECTED TRANSACTIONS
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

        if (selectedIds.length > 500) {
            alert("Please select no more than 500 transactions at a time.");
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
// 23. DISPLAY OUTSTANDING CREDIT
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
// 24. DASHBOARD AND FINANCIAL REPORTS
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

        // Total sales includes wallet and credit purchases.
        if (isPurchaseTransaction(transaction)) {
            totalSales += amount;
        }

        if (isCreditPurchase(transaction)) {
            totalCredit += amount;
        }

        if (type === "repayment") {
            totalRepayments += amount;
        }
    });

    const outstandingCredit = students.reduce((total, student) => {

        const financialRecord = getBalanceByUid(student.authUid);

        return total + Number(financialRecord.creditBalance || 0);

    }, 0);

    const totalStudentsElement = document.getElementById("total-students");
    const dashboardDeposits = document.getElementById("dashboard-deposits");
    const dashboardSales = document.getElementById("dashboard-sales");
    const dashboardCredit = document.getElementById("dashboard-credit");

    const reportDeposits = document.getElementById("report-deposits");
    const reportSales = document.getElementById("report-sales");
    const reportCredit = document.getElementById("report-credit");
    const reportRepayments = document.getElementById("report-repayments");

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
        dashboardCredit.textContent = formatMoney(outstandingCredit);
    }

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
// 25. STATISTICS DATE FILTER
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
// 26. CALCULATE STATISTICS
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
// 27. STATISTICS FILTER EVENT
// ============================================

if (statisticsPeriod) {

    statisticsPeriod.addEventListener("change", function() {
        updateStatistics();
    });
}


// ============================================
// STUDENT FEEDBACK SUBMISSION
// ============================================

if (feedbackForm) {
    feedbackForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const user = auth.currentUser;
        const category = getValue("feedback-category");
        const message = getValue("feedback-message");

        if (!user || user.uid === ADMIN_UID || !currentStudentUid || user.uid !== currentStudentUid) {
            if (feedbackStatus) feedbackStatus.textContent = "Please sign in with your student account to submit feedback.";
            return;
        }

        if (!category || !message) {
            if (feedbackStatus) feedbackStatus.textContent = "Please complete all feedback fields.";
            return;
        }

        if (message.length > 2000) {
            if (feedbackStatus) feedbackStatus.textContent = "Feedback must be 2,000 characters or fewer.";
            return;
        }

        const submitButton = feedbackForm.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        if (feedbackStatus) feedbackStatus.textContent = "Submitting feedback...";

        try {
            const studentQuery = query(
                collection(db, "students"),
                where("authUid", "==", user.uid)
            );
            const studentSnapshot = await getDocs(studentQuery);

            if (studentSnapshot.empty) {
                throw new Error("STUDENT_PROFILE_NOT_FOUND");
            }

            const student = studentSnapshot.docs[0].data();
            const feedbackReference = doc(collection(db, "feedback"));

            await runTransaction(db, async function(firebaseTransaction) {
                firebaseTransaction.set(feedbackReference, {
                    uid: user.uid,
                    admission: student.admission,
                    name: student.name || "Student",
                    email: user.email || "",
                    category,
                    message,
                    status: "New",
                    date: new Date().toISOString(),
                    createdAt: serverTimestamp()
                });
            });

            feedbackForm.reset();
            const nameInput = document.getElementById("feedback-name");
            const emailInput = document.getElementById("feedback-email");
            if (nameInput) nameInput.value = student.name || "";
            if (emailInput) emailInput.value = user.email || "";
            if (feedbackStatus) feedbackStatus.textContent = "Thank you. Your feedback was submitted successfully.";

        } catch (error) {
            console.error("Feedback submission error:", error);
            if (feedbackStatus) feedbackStatus.textContent = "Could not submit feedback. Please try again.";
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}


// ============================================
// ADMIN FEEDBACK REVIEW ACTION
// ============================================

if (feedbackList) {
    feedbackList.addEventListener("click", async function(event) {
        const button = event.target.closest(".review-feedback");
        if (!button) return;

        if (auth.currentUser?.uid !== ADMIN_UID) {
            alert("Only the administrator can review feedback.");
            return;
        }

        const feedbackId = button.dataset.id;
        if (!feedbackId) return;

        button.disabled = true;

        try {
            await updateDoc(doc(db, "feedback", feedbackId), {
                status: "Reviewed",
                reviewedAt: serverTimestamp(),
                reviewedBy: ADMIN_UID
            });

            const feedback = feedbacks.find(item => item.id === feedbackId);
            if (feedback) feedback.status = "Reviewed";
            displayFeedback();

        } catch (error) {
            console.error("Feedback review error:", error);
            alert("Could not update feedback status. Check Firestore rules and try again.");
            button.disabled = false;
        }
    });
}


// ============================================
// DISPLAY STUDENT FEEDBACK (ADMIN)
// ============================================

function displayFeedback() {

    if (!feedbackList) return;

    feedbackList.innerHTML = "";

    if (feedbacks.length === 0) {

        feedbackList.innerHTML = `
            <tr>
                <td colspan="7">No feedback received yet.</td>
            </tr>
        `;

        return;
    }

    feedbacks.forEach(feedback => {

        const row = document.createElement("tr");
        const reviewed = feedback.status === "Reviewed";

        row.innerHTML = `
            <td>${escapeHTML(feedback.name || "")}</td>
            <td>${escapeHTML(feedback.email || "")}</td>
            <td>${escapeHTML(feedback.category || "General")}</td>
            <td>${escapeHTML(feedback.message || "")}</td>
            <td>${escapeHTML(formatDate(feedback))}</td>
            <td>${reviewed ? "Reviewed" : "New"}</td>
            <td>
                ${reviewed
                    ? "Completed"
                    : `<button type="button" class="review-feedback" data-id="${escapeHTML(feedback.id)}">Mark as Reviewed</button>`
                }
            </td>
        `;

        feedbackList.appendChild(row);
    });
}
// ============================================
// 28. REFRESH ALL ADMIN DISPLAYS
// ============================================

function refreshDisplays() {

    displayStudents();

    displayTransactions();

    displayOrders();

    displayFeedback();

    displayCredits();

    updateReports();

    updateStatistics();

    updateAdmissionPreview();
}


// ============================================
// 29. STUDENT PORTAL
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

    // These fields are displayed for convenience; the submitted identity is
    // always taken from the authenticated Firebase account and student record.
    const feedbackNameInput = document.getElementById("feedback-name");
    const feedbackEmailInput = document.getElementById("feedback-email");

    if (feedbackNameInput) feedbackNameInput.value = student.name || "";
    if (feedbackEmailInput) feedbackEmailInput.value = auth.currentUser?.email || "";


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


    // Student directory is intentionally not shown in the student portal.
    // Show any unacknowledged bonus announcement for the current month.
    await showPendingMonthlyBonus(uid);
}


// ============================================
// 30. STUDENT PURCHASE HISTORY - READ ONLY
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

        const studentTransactions = snapshot.docs.map(document => ({
            ...document.data(),
            id: document.id
        }));


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
                <td colspan="4">Unable to load purchase history.</td>
            </tr>
        `;
    }
}
